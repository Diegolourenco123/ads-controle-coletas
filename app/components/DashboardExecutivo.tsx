"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

type Coleta = {
  id: number;
  created_at: string | null;
  data_solicitacao: string | null;
  data_prevista_coleta: string | null;
  data_efetiva_coleta: string | null;
  data_coleta: string | null;
  data_chegada_ads: string | null;
  cliente: string | null;
  transportadora: string | null;
  status: string | null;
  valor_frete: number | null;
  status_pagamento_transportadora: string | null;
  data_pagamento_transportadora: string | null;
  valor_nf_cobranca_ads: number | null;
  numero_nf_cobranca_ads: string | null;
  vencimento_nf_cobranca_ads: string | null;
  status_recebimento_ads: string | null;
  data_recebimento_pagamento_ads: string | null;
};

type Ranking = {
  nome: string;
  quantidade: number;
  percentual: number;
};

function normalizarTexto(texto: string | null | undefined) {
  return (texto ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function criarDataLocal(data: string | null) {
  if (!data) return null;

  const dataPura = data.includes("T") ? data.split("T")[0] : data;
  const [ano, mes, dia] = dataPura.split("-").map(Number);

  if (!ano || !mes || !dia) return null;

  const resultado = new Date(ano, mes - 1, dia);
  resultado.setHours(0, 0, 0, 0);

  return resultado;
}

function formatarMoeda(valor: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(valor);
}

function mesmoDia(data: string | null, referencia: Date) {
  const convertida = criarDataLocal(data);
  return convertida?.getTime() === referencia.getTime();
}

function dentroDoMesAtual(data: string | null) {
  const convertida = criarDataLocal(data);

  if (!convertida) return false;

  const hoje = new Date();

  return (
    convertida.getMonth() === hoje.getMonth() &&
    convertida.getFullYear() === hoje.getFullYear()
  );
}

function dataVencida(data: string | null) {
  const vencimento = criarDataLocal(data);

  if (!vencimento) return false;

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  return vencimento < hoje;
}

function diferencaEmDias(inicio: string | null, fim: string | null) {
  const dataInicio = criarDataLocal(inicio);
  const dataFim = criarDataLocal(fim);

  if (!dataInicio || !dataFim) return null;

  return Math.max(
    0,
    Math.round(
      (dataFim.getTime() - dataInicio.getTime()) /
        (1000 * 60 * 60 * 24),
    ),
  );
}

function criarRanking(
  registros: Coleta[],
  obterNome: (coleta: Coleta) => string | null,
): Ranking[] {
  const contagem = new Map<string, number>();

  registros.forEach((coleta) => {
    const nome = obterNome(coleta)?.trim();

    if (!nome) return;

    contagem.set(nome, (contagem.get(nome) ?? 0) + 1);
  });

  const ordenado = [...contagem.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const maior = ordenado[0]?.[1] ?? 1;

  return ordenado.map(([nome, quantidade]) => ({
    nome,
    quantidade,
    percentual: Math.round((quantidade / maior) * 100),
  }));
}

export default function DashboardExecutivo() {
  const [coletas, setColetas] = useState<Coleta[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  useEffect(() => {
    async function carregarDados() {
      setCarregando(true);
      setErro("");

      const { data, error } = await supabase
        .from("coletas")
        .select(`
          id,
          created_at,
          data_solicitacao,
          data_prevista_coleta,
          data_efetiva_coleta,
          data_coleta,
          data_chegada_ads,
          cliente,
          transportadora,
          status,
          valor_frete,
          status_pagamento_transportadora,
          data_pagamento_transportadora,
          valor_nf_cobranca_ads,
          numero_nf_cobranca_ads,
          vencimento_nf_cobranca_ads,
          status_recebimento_ads,
          data_recebimento_pagamento_ads
        `)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Erro ao carregar Dashboard Executivo:", error);
        setErro("Não foi possível carregar o Dashboard Executivo.");
        setCarregando(false);
        return;
      }

      setColetas((data ?? []) as Coleta[]);
      setCarregando(false);
    }

    carregarDados();

    const canal = supabase
      .channel("dashboard-executivo-resumo")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "coletas",
        },
        carregarDados,
      )
      .subscribe();

    return () => {
      supabase.removeChannel(canal);
    };
  }, []);

  const resumo = useMemo(() => {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const amanha = new Date(hoje);
    amanha.setDate(amanha.getDate() + 1);

    const fimSemana = new Date(hoje);
    fimSemana.setDate(fimSemana.getDate() + 7);

    let concluidas = 0;
    let atrasadas = 0;
    let recebidasHoje = 0;
    let previstasHoje = 0;
    let previstasAmanha = 0;
    let previstasSemana = 0;

    let valorFretesPagos = 0;
    let valorFretesPendentes = 0;
    let valorAdsRecebido = 0;
    let valorAdsPendente = 0;
    let valorAdsVencido = 0;

    let nfsAdsEmitidas = 0;
    let nfsAdsPagas = 0;
    let nfsAdsPendentes = 0;
    let nfsAdsVencidas = 0;
    let coletasAdsAFaturar = 0;

    const tempos: number[] = [];

    coletas.forEach((coleta) => {
      const status = normalizarTexto(coleta.status);

      const statusTransp = normalizarTexto(
        coleta.status_pagamento_transportadora,
      );

      const statusAds = normalizarTexto(coleta.status_recebimento_ads);

      const dataEfetiva =
        coleta.data_efetiva_coleta ?? coleta.data_coleta;

      const finalizada =
        status === "finalizado" ||
        statusAds === "paga" ||
        Boolean(coleta.data_recebimento_pagamento_ads);

      if (finalizada) {
        concluidas += 1;

        const tempo = diferencaEmDias(
          coleta.data_solicitacao,
          coleta.data_recebimento_pagamento_ads ??
            coleta.data_chegada_ads,
        );

        if (tempo !== null) {
          tempos.push(tempo);
        }
      }

      if (
        coleta.data_prevista_coleta &&
        !dataEfetiva &&
        dataVencida(coleta.data_prevista_coleta)
      ) {
        atrasadas += 1;
      }

      if (mesmoDia(coleta.data_chegada_ads, hoje)) {
        recebidasHoje += 1;
      }

      if (
        !dataEfetiva &&
        mesmoDia(coleta.data_prevista_coleta, hoje)
      ) {
        previstasHoje += 1;
      }

      if (
        !dataEfetiva &&
        mesmoDia(coleta.data_prevista_coleta, amanha)
      ) {
        previstasAmanha += 1;
      }

      const dataPrevista = criarDataLocal(
        coleta.data_prevista_coleta,
      );

      if (
        !dataEfetiva &&
        dataPrevista &&
        dataPrevista >= hoje &&
        dataPrevista <= fimSemana
      ) {
        previstasSemana += 1;
      }

      const valorFrete = Number(coleta.valor_frete ?? 0);

      if (
        statusTransp === "pago" ||
        Boolean(coleta.data_pagamento_transportadora)
      ) {
        valorFretesPagos += valorFrete;
      } else if (valorFrete > 0) {
        valorFretesPendentes += valorFrete;
      }

      const valorAds = Number(
        coleta.valor_nf_cobranca_ads ?? 0,
      );

      const ehColetaAds =
        normalizarTexto(coleta.transportadora) ===
        "ads logistica ambiental";

      const temNfAds = Boolean(
        coleta.numero_nf_cobranca_ads?.trim(),
      );

      const nfAdsPaga =
        statusAds === "paga" ||
        Boolean(coleta.data_recebimento_pagamento_ads);

      const nfAdsCancelada = statusAds === "cancelada";

      const nfAdsVencida =
        temNfAds &&
        !nfAdsPaga &&
        !nfAdsCancelada &&
        dataVencida(coleta.vencimento_nf_cobranca_ads);

      if (ehColetaAds) {
        if (!temNfAds) {
          coletasAdsAFaturar += 1;
        } else {
          nfsAdsEmitidas += 1;

          if (nfAdsPaga) {
            nfsAdsPagas += 1;
            valorAdsRecebido += valorAds;
          } else if (nfAdsVencida) {
            nfsAdsVencidas += 1;
            valorAdsVencido += valorAds;
          } else if (!nfAdsCancelada) {
            nfsAdsPendentes += 1;
            valorAdsPendente += valorAds;
          }
        }
      }
    });

    const tempoMedio = tempos.length
      ? Math.round(
          tempos.reduce((a, b) => a + b, 0) /
            tempos.length,
        )
      : 0;

    const coletasMes = coletas.filter((coleta) =>
      dentroDoMesAtual(
        coleta.data_solicitacao ?? coleta.created_at,
      ),
    ).length;

    const taxaConclusao = coletas.length
      ? Math.round(
          (concluidas / coletas.length) * 100,
        )
      : 0;

    return {
      concluidas,
      atrasadas,
      recebidasHoje,
      previstasHoje,
      previstasAmanha,
      previstasSemana,
      valorFretesPagos,
      valorFretesPendentes,
      valorAdsRecebido,
      valorAdsPendente,
      valorAdsVencido,
      nfsAdsEmitidas,
      nfsAdsPagas,
      nfsAdsPendentes,
      nfsAdsVencidas,
      coletasAdsAFaturar,
      tempoMedio,
      coletasMes,
      taxaConclusao,
    };
  }, [coletas]);

  const rankingClientes = useMemo(
    () =>
      criarRanking(
        coletas,
        (coleta) => coleta.cliente,
      ),
    [coletas],
  );

  const rankingTransportadoras = useMemo(
    () =>
      criarRanking(
        coletas,
        (coleta) => coleta.transportadora,
      ),
    [coletas],
  );

  const mensagemExecutiva = resumo.atrasadas
    ? `${resumo.atrasadas} ${
        resumo.atrasadas === 1
          ? "coleta exige"
          : "coletas exigem"
      } atenção imediata por atraso.`
    : resumo.previstasHoje
      ? `Hoje existem ${resumo.previstasHoje} ${
          resumo.previstasHoje === 1
            ? "coleta prevista"
            : "coletas previstas"
        } para acompanhamento.`
      : "A operação está dentro do fluxo esperado e não possui atrasos críticos neste momento.";

  return (
    <section className="mb-10 space-y-5">
      {erro && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-medium text-red-700">
          {erro}
        </div>
      )}

      {/* CENTRO DE INTELIGÊNCIA */}
      <article className="overflow-hidden rounded-[26px] border border-slate-800 bg-slate-950 text-white shadow-lg shadow-slate-900/10">
        <div className="h-1 bg-emerald-500" />

        <div className="grid gap-8 p-6 lg:grid-cols-[1.35fr_1fr] lg:p-7">
          <div className="flex flex-col justify-between">
            <div>
              <div className="mb-4 flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />

                <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-emerald-400">
                  Centro de Inteligência Operacional
                </p>
              </div>

              <h3 className="text-2xl font-black tracking-tight md:text-[28px]">
                Visão executiva da operação
              </h3>

              <p className="mt-2 max-w-xl text-sm leading-6 text-slate-400">
                {carregando
                  ? "Analisando os dados operacionais e financeiros..."
                  : mensagemExecutiva}
              </p>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/alertas"
                className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-500"
              >
                Central de Alertas
              </Link>

              <Link
                href="/coletas"
                className="rounded-xl border border-slate-700 bg-slate-900/80 px-5 py-2.5 text-sm font-semibold text-slate-200 transition hover:border-slate-600 hover:bg-slate-800"
              >
                Todas as coletas
              </Link>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <ResumoEscuro
              titulo="Fretes pendentes"
              valor={formatarMoeda(
                resumo.valorFretesPendentes,
              )}
              carregando={carregando}
              classe="text-orange-300"
              marcador="bg-orange-400"
            />

            <ResumoEscuro
              titulo="A receber pela ADS"
              valor={formatarMoeda(
                resumo.valorAdsPendente,
              )}
              carregando={carregando}
              classe="text-orange-300"
              marcador="bg-orange-400"
            />

            <ResumoEscuro
              titulo="Recebidas hoje"
              valor={String(
                resumo.recebidasHoje,
              ).padStart(2, "0")}
              carregando={carregando}
              classe="text-emerald-300"
              marcador="bg-emerald-400"
            />

            <ResumoEscuro
              titulo="Previstas hoje"
              valor={String(
                resumo.previstasHoje,
              ).padStart(2, "0")}
              carregando={carregando}
              classe="text-blue-300"
              marcador="bg-blue-400"
            />
          </div>
        </div>
      </article>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          titulo="Coletas no mês"
          valor={String(resumo.coletasMes).padStart(
            2,
            "0",
          )}
          detalhe="Solicitações registradas"
          carregando={carregando}
          classe="border-slate-200 bg-white"
          marcador="bg-slate-400"
          valorClasse="text-slate-900"
        />

        <Kpi
          titulo="Taxa de conclusão"
          valor={`${resumo.taxaConclusao}%`}
          detalhe={`${resumo.concluidas} processos concluídos`}
          carregando={carregando}
          classe="border-emerald-200 bg-emerald-50/70"
          marcador="bg-emerald-500"
          valorClasse="text-emerald-800"
        />

        <Kpi
          titulo="Tempo médio"
          valor={`${resumo.tempoMedio} dias`}
          detalhe="Solicitação até encerramento"
          carregando={carregando}
          classe="border-blue-200 bg-blue-50/70"
          marcador="bg-blue-500"
          valorClasse="text-blue-800"
        />

        <Kpi
          titulo="Operações atrasadas"
          valor={String(resumo.atrasadas).padStart(
            2,
            "0",
          )}
          detalhe="Previsões ultrapassadas"
          carregando={carregando}
          classe="border-red-200 bg-red-50/70"
          marcador="bg-red-500"
          valorClasse="text-red-800"
        />
      </div>

      {/* OPERAÇÃO + FINANCEIRO */}
      <div className="grid gap-5 xl:grid-cols-2">
        <article className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm">
          <CabecalhoSecao
            categoria="Agenda operacional"
            titulo="Próximas coletas"
          />

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <AgendaItem
              titulo="Hoje"
              valor={resumo.previstasHoje}
              carregando={carregando}
            />

            <AgendaItem
              titulo="Amanhã"
              valor={resumo.previstasAmanha}
              carregando={carregando}
            />

            <AgendaItem
              titulo="Próximos 7 dias"
              valor={resumo.previstasSemana}
              carregando={carregando}
            />
          </div>
        </article>

        <article className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm">
          <CabecalhoSecao
            categoria="Resumo financeiro"
            titulo="Pagamentos e recebimentos"
          />

          <div className="mt-5 space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Financeiro
                titulo="Fretes pagos"
                valor={resumo.valorFretesPagos}
                carregando={carregando}
                tipo="positivo"
              />

              <Financeiro
                titulo="Fretes pendentes"
                valor={resumo.valorFretesPendentes}
                carregando={carregando}
                tipo="pendente"
              />
            </div>

            <div>
              <div className="mb-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
                  Financeiro ADS
                </p>

                <h4 className="mt-1 text-sm font-bold text-slate-900">
                  Cobranças e recebimentos
                </h4>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                <IndicadorFinanceiroAds
                  titulo="NFs emitidas"
                  valor={resumo.nfsAdsEmitidas}
                  carregando={carregando}
                  tipo="neutro"
                />

                <IndicadorFinanceiroAds
                  titulo="Pagas"
                  valor={resumo.nfsAdsPagas}
                  carregando={carregando}
                  tipo="positivo"
                />

                <IndicadorFinanceiroAds
                  titulo="Aguardando"
                  valor={resumo.nfsAdsPendentes}
                  carregando={carregando}
                  tipo="pendente"
                />

                <IndicadorFinanceiroAds
                  titulo="Vencidas"
                  valor={resumo.nfsAdsVencidas}
                  carregando={carregando}
                  tipo="vencido"
                />

                <IndicadorFinanceiroAds
                  titulo="A faturar"
                  valor={resumo.coletasAdsAFaturar}
                  carregando={carregando}
                  tipo="informativo"
                />
              </div>

              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <Financeiro
                  titulo="Recebido pela ADS"
                  valor={resumo.valorAdsRecebido}
                  carregando={carregando}
                  tipo="positivo"
                />

                <Financeiro
                  titulo="A receber pela ADS"
                  valor={resumo.valorAdsPendente}
                  carregando={carregando}
                  tipo="pendente"
                />

                <Financeiro
                  titulo="Valor vencido"
                  valor={resumo.valorAdsVencido}
                  carregando={carregando}
                  tipo="vencido"
                />
              </div>
            </div>
          </div>
        </article>
      </div>

      {/* RANKINGS */}
      <div className="grid gap-5 xl:grid-cols-2">
        <RankingCard
          titulo="Ranking de clientes"
          subtitulo="Clientes com maior volume de coletas"
          ranking={rankingClientes}
          carregando={carregando}
        />

        <RankingCard
          titulo="Ranking de transportadoras"
          subtitulo="Transportadoras mais utilizadas"
          ranking={rankingTransportadoras}
          carregando={carregando}
        />
      </div>
    </section>
  );
}

/* =========================================================
   COMPONENTES VISUAIS
========================================================= */

function ResumoEscuro({
  titulo,
  valor,
  carregando,
  classe,
  marcador,
}: {
  titulo: string;
  valor: string;
  carregando: boolean;
  classe: string;
  marcador: string;
}) {
  return (
    <div className="group rounded-2xl border border-slate-800 bg-slate-900/90 p-4 transition hover:border-slate-700">
      <div className="flex items-center gap-2">
        <span
          className={`h-1.5 w-1.5 rounded-full ${marcador}`}
        />

        <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
          {titulo}
        </p>
      </div>

      <p
        className={`mt-2 text-xl font-black tracking-tight ${classe}`}
      >
        {carregando ? "..." : valor}
      </p>
    </div>
  );
}

function Kpi({
  titulo,
  valor,
  detalhe,
  carregando,
  classe,
  marcador,
  valorClasse,
}: {
  titulo: string;
  valor: string;
  detalhe: string;
  carregando: boolean;
  classe: string;
  marcador: string;
  valorClasse: string;
}) {
  return (
    <article
      className={`relative overflow-hidden rounded-[20px] border p-5 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md ${classe}`}
    >
      <div
        className={`absolute left-0 top-0 h-full w-1 ${marcador}`}
      />

      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-semibold text-slate-600">
          {titulo}
        </p>

        <span
          className={`mt-1 h-2 w-2 shrink-0 rounded-full ${marcador}`}
        />
      </div>

      <p
        className={`mt-3 text-[30px] font-black leading-none tracking-tight ${valorClasse}`}
      >
        {carregando ? "..." : valor}
      </p>

      <p className="mt-2 text-xs text-slate-500">
        {detalhe}
      </p>
    </article>
  );
}

function CabecalhoSecao({
  categoria,
  titulo,
}: {
  categoria: string;
  titulo: string;
}) {
  return (
    <div>
      <div className="flex items-center gap-2">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />

        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
          {categoria}
        </p>
      </div>

      <h3 className="mt-1.5 text-lg font-bold tracking-tight text-slate-900">
        {titulo}
      </h3>
    </div>
  );
}

function AgendaItem({
  titulo,
  valor,
  carregando,
}: {
  titulo: string;
  valor: number;
  carregando: boolean;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 transition hover:border-blue-200 hover:bg-blue-50/60">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-slate-500">
          {titulo}
        </p>

        <span className="h-2 w-2 rounded-full bg-blue-500" />
      </div>

      <p className="mt-3 text-3xl font-black leading-none tracking-tight text-blue-900">
        {carregando
          ? "..."
          : String(valor).padStart(2, "0")}
      </p>

      <p className="mt-2 text-[11px] text-slate-400">
        coletas previstas
      </p>
    </div>
  );
}

function Financeiro({
  titulo,
  valor,
  carregando,
  tipo,
}: {
  titulo: string;
  valor: number;
  carregando: boolean;
  tipo: "positivo" | "pendente" | "vencido";
}) {
  const classes =
    tipo === "positivo"
      ? {
          caixa: "border-emerald-200 bg-emerald-50/70",
          titulo: "text-emerald-800",
          ponto: "bg-emerald-500",
          valor: "text-emerald-900",
        }
      : tipo === "vencido"
        ? {
            caixa: "border-red-200 bg-red-50/70",
            titulo: "text-red-800",
            ponto: "bg-red-500",
            valor: "text-red-900",
          }
        : {
            caixa: "border-orange-200 bg-orange-50/70",
            titulo: "text-orange-800",
            ponto: "bg-orange-500",
            valor: "text-orange-900",
          };

  return (
    <div
      className={`rounded-2xl border p-4 transition ${classes.caixa}`}
    >
      <div className="flex items-center justify-between gap-3">
        <p className={`text-xs font-semibold ${classes.titulo}`}>
          {titulo}
        </p>

        <span className={`h-2 w-2 rounded-full ${classes.ponto}`} />
      </div>

      <p
        className={`mt-3 text-xl font-black tracking-tight ${classes.valor}`}
      >
        {carregando
          ? "..."
          : formatarMoeda(valor)}
      </p>
    </div>
  );
}


function IndicadorFinanceiroAds({
  titulo,
  valor,
  carregando,
  tipo,
}: {
  titulo: string;
  valor: number;
  carregando: boolean;
  tipo:
    | "neutro"
    | "positivo"
    | "pendente"
    | "vencido"
    | "informativo";
}) {
  const classes =
    tipo === "positivo"
      ? {
          caixa: "border-emerald-200 bg-emerald-50/70",
          titulo: "text-emerald-800",
          valor: "text-emerald-900",
          ponto: "bg-emerald-500",
        }
      : tipo === "pendente"
        ? {
            caixa: "border-orange-200 bg-orange-50/70",
            titulo: "text-orange-800",
            valor: "text-orange-900",
            ponto: "bg-orange-500",
          }
        : tipo === "vencido"
          ? {
              caixa: "border-red-200 bg-red-50/70",
              titulo: "text-red-800",
              valor: "text-red-900",
              ponto: "bg-red-500",
            }
          : tipo === "informativo"
            ? {
                caixa: "border-blue-200 bg-blue-50/70",
                titulo: "text-blue-800",
                valor: "text-blue-900",
                ponto: "bg-blue-500",
              }
            : {
                caixa: "border-slate-200 bg-slate-50/70",
                titulo: "text-slate-700",
                valor: "text-slate-900",
                ponto: "bg-slate-500",
              };

  return (
    <div
      className={`rounded-2xl border p-4 transition hover:-translate-y-0.5 hover:shadow-sm ${classes.caixa}`}
    >
      <div className="flex items-center justify-between gap-3">
        <p className={`text-[11px] font-semibold ${classes.titulo}`}>
          {titulo}
        </p>

        <span className={`h-2 w-2 rounded-full ${classes.ponto}`} />
      </div>

      <p className={`mt-3 text-2xl font-black tracking-tight ${classes.valor}`}>
        {carregando ? "..." : String(valor).padStart(2, "0")}
      </p>
    </div>
  );
}

function RankingCard({
  titulo,
  subtitulo,
  ranking,
  carregando,
}: {
  titulo: string;
  subtitulo: string;
  ranking: Ranking[];
  carregando: boolean;
}) {
  return (
    <article className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold tracking-tight text-slate-900">
            {titulo}
          </h3>

          <p className="mt-1 text-xs text-slate-500">
            {subtitulo}
          </p>
        </div>

        <div className="rounded-lg bg-slate-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">
          Top 5
        </div>
      </div>

      {carregando && (
        <div className="rounded-2xl bg-slate-50 p-5 text-sm text-slate-500">
          Carregando ranking...
        </div>
      )}

      {!carregando && ranking.length === 0 && (
        <div className="rounded-2xl bg-slate-50 p-5 text-sm text-slate-500">
          Nenhum dado disponível.
        </div>
      )}

      {!carregando && ranking.length > 0 && (
        <div className="space-y-4">
          {ranking.map((item, indice) => (
            <div
              key={item.nome}
              className="rounded-xl p-1 transition hover:bg-slate-50"
            >
              <div className="mb-2 flex items-center justify-between gap-4">
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[11px] font-black ${
                      indice === 0
                        ? "bg-emerald-600 text-white"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {indice + 1}
                  </span>

                  <p className="truncate text-sm font-semibold text-slate-800">
                    {item.nome}
                  </p>
                </div>

                <p className="shrink-0 text-xs font-bold text-slate-600">
                  <span className="text-emerald-700">
                    {item.quantidade}
                  </span>{" "}
                  {item.quantidade === 1
                    ? "coleta"
                    : "coletas"}
                </p>
              </div>

              <div className="ml-10 h-1.5 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all duration-700"
                  style={{
                    width: `${item.percentual}%`,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </article>
  );
}