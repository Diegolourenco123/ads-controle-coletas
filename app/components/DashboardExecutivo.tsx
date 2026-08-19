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

      // "A faturar" mantém a regra original:
      // considera apenas coletas realizadas pela própria ADS sem NF de cobrança.
      if (ehColetaAds && !temNfAds) {
        coletasAdsAFaturar += 1;
      }

      // O Financeiro ADS deve considerar TODA NF de cobrança emitida pela ADS,
      // independentemente da transportadora que realizou a coleta.
      if (temNfAds) {
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

      {/* CENTRO DE INTELIGÊNCIA — VISUAL PREMIUM */}
      <article className="relative overflow-hidden rounded-[30px] border border-slate-800/90 bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.10),transparent_30%),linear-gradient(135deg,#020617_0%,#071426_55%,#08111f_100%)] text-white shadow-[0_28px_70px_-38px_rgba(2,6,23,0.9)]">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-400/80 to-transparent" />
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 left-0 h-72 w-72 rounded-full bg-blue-500/10 blur-3xl" />

        <div className="relative grid gap-7 p-6 lg:grid-cols-[1.05fr_1fr] lg:p-8">
          {/* LADO ESQUERDO */}
          <div className="flex flex-col justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3.5 py-1.5">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-30" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                </span>

                <p className="text-[10px] font-extrabold uppercase tracking-[0.23em] text-emerald-300">
                  Centro de Inteligência Operacional
                </p>
              </div>

              <h3 className="mt-5 max-w-xl text-[30px] font-black leading-[1.05] tracking-[-0.035em] text-white md:text-[38px]">
                Central de Controle
                <span className="block text-white">Operacional</span>
              </h3>

              <div className="mt-4 h-1 w-14 rounded-full bg-emerald-400" />

              <p className="mt-5 max-w-xl text-sm leading-6 text-slate-300">
                Acompanhe em tempo real o andamento das coletas, faturamentos,
                pagamentos, documentos e recebimentos da operação.
              </p>

              <div
                className={[
                  "mt-6 flex max-w-xl items-center justify-between gap-4 rounded-2xl border px-4 py-4 transition",
                  resumo.atrasadas > 0
                    ? "border-red-500/30 bg-red-500/10"
                    : "border-emerald-500/20 bg-emerald-500/10",
                ].join(" ")}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div
                    className={[
                      "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border",
                      resumo.atrasadas > 0
                        ? "border-red-400/20 bg-red-500/15 text-red-300"
                        : "border-emerald-400/20 bg-emerald-500/15 text-emerald-300",
                    ].join(" ")}
                  >
                    {resumo.atrasadas > 0 ? (
                      <IconeAlertaPainel className="h-5 w-5" />
                    ) : (
                      <IconeCheckPainel className="h-5 w-5" />
                    )}
                  </div>

                  <p
                    className={[
                      "text-sm font-semibold leading-5",
                      resumo.atrasadas > 0 ? "text-red-100" : "text-emerald-100",
                    ].join(" ")}
                  >
                    {carregando
                      ? "Analisando os dados operacionais e financeiros..."
                      : mensagemExecutiva}
                  </p>
                </div>

                <Link
                  href="/alertas"
                  aria-label="Abrir Central de Alertas"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-slate-300 transition hover:bg-white/10 hover:text-white"
                >
                  <IconeSetaPainel className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </div>

          {/* LADO DIREITO */}
          <div className="grid gap-4 sm:grid-cols-2">
            <ResumoEscuro
              titulo="Fretes pendentes"
              valor={formatarMoeda(resumo.valorFretesPendentes)}
              carregando={carregando}
              classe="text-emerald-300"
              marcador="bg-emerald-400"
              detalhe={`${resumo.valorFretesPendentes > 0 ? "Cobranças em aberto" : "Nenhum valor pendente"}`}
              variante="emerald"
              icone="caminhao"
            />

            <ResumoEscuro
              titulo="A vencer"
              valor={formatarMoeda(resumo.valorAdsPendente)}
              carregando={carregando}
              classe="text-orange-300"
              marcador="bg-orange-400"
              detalhe={`${resumo.nfsAdsPendentes} ${resumo.nfsAdsPendentes === 1 ? "título em aberto" : "títulos em aberto"}`}
              variante="orange"
              icone="dinheiro"
            />

            <ResumoEscuro
              titulo="Recebidas hoje"
              valor={String(resumo.recebidasHoje).padStart(2, "0")}
              carregando={carregando}
              classe="text-emerald-300"
              marcador="bg-emerald-400"
              detalhe="Concluídas hoje"
              variante="emerald"
              icone="caixa"
            />

            <ResumoEscuro
              titulo="Previstas hoje"
              valor={String(resumo.previstasHoje).padStart(2, "0")}
              carregando={carregando}
              classe="text-blue-300"
              marcador="bg-blue-400"
              detalhe="Programadas para hoje"
              variante="blue"
              icone="calendario"
            />
          </div>
        </div>

        {/* ATALHOS INFERIORES */}
        <div className="relative border-t border-slate-800/80 bg-slate-950/35 px-6 py-4 lg:px-8">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <AtalhoExecutivo
              href="/alertas"
              titulo="Central de Alertas"
              descricao="Ver alertas e pendências"
              variante="emerald"
              icone="alerta"
            />

            <AtalhoExecutivo
              href="/coletas"
              titulo="Todas as coletas"
              descricao="Consultar e gerenciar"
              variante="blue"
              icone="lista"
            />

            <AtalhoExecutivo
              href="/documentos"
              titulo="Central de Documentos"
              descricao="NF, CT-e e cobranças"
              variante="violet"
              icone="documento"
            />

            <AtalhoExecutivo
              href="/relatorios"
              titulo="Relatórios"
              descricao="Análises e indicadores"
              variante="orange"
              icone="grafico"
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
        <article className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm shadow-slate-200/50">
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

        <article className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm shadow-slate-200/50">
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
                  href="/coletas?financeiroAds=emitidas"
                />

                <IndicadorFinanceiroAds
                  titulo="Pagas"
                  valor={resumo.nfsAdsPagas}
                  carregando={carregando}
                  tipo="positivo"
                  href="/coletas?financeiroAds=pagas"
                />

                <IndicadorFinanceiroAds
                  titulo="Aguardando"
                  valor={resumo.nfsAdsPendentes}
                  carregando={carregando}
                  tipo="pendente"
                  href="/coletas?financeiroAds=aguardando"
                />

                <IndicadorFinanceiroAds
                  titulo="Vencidas"
                  valor={resumo.nfsAdsVencidas}
                  carregando={carregando}
                  tipo="vencido"
                  href="/coletas?financeiroAds=vencidas"
                />

                <IndicadorFinanceiroAds
                  titulo="A faturar"
                  valor={resumo.coletasAdsAFaturar}
                  carregando={carregando}
                  tipo="informativo"
                  href="/coletas?financeiroAds=a-faturar"
                />
              </div>

              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <Financeiro
                  titulo="Recebido pela ADS"
                  valor={resumo.valorAdsRecebido}
                  carregando={carregando}
                  tipo="positivo"
                  href="/coletas?financeiroAds=pagas"
                />

                <Financeiro
                  titulo="A receber pela ADS"
                  valor={resumo.valorAdsPendente}
                  carregando={carregando}
                  tipo="pendente"
                  href="/coletas?financeiroAds=aguardando"
                />

                <Financeiro
                  titulo="Valor vencido"
                  valor={resumo.valorAdsVencido}
                  carregando={carregando}
                  tipo="vencido"
                  href="/coletas?financeiroAds=vencidas"
                />

                <Financeiro
                  titulo="Total a receber"
                  valor={resumo.valorAdsPendente + resumo.valorAdsVencido}
                  carregando={carregando}
                  tipo="total"
                  href="/coletas?financeiroAds=em-aberto"
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

type IconePainelProps = {
  className?: string;
};

function IconeCaminhaoPainel({ className }: IconePainelProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M3 6h11v10H3z" />
      <path d="M14 9h4l3 3v4h-7z" />
      <circle cx="7" cy="18" r="2" />
      <circle cx="18" cy="18" r="2" />
    </svg>
  );
}

function IconeDinheiroPainel({ className }: IconePainelProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M15 8.5c-.8-.9-2-1.4-3.2-1.4-1.8 0-3.1.9-3.1 2.3 0 1.3 1 2 3.3 2.5 2.2.5 3.3 1.2 3.3 2.6 0 1.5-1.4 2.5-3.4 2.5-1.5 0-2.8-.6-3.8-1.6" />
      <path d="M12 5.8v12.4" />
    </svg>
  );
}

function IconeCaixaPainel({ className }: IconePainelProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="m21 8-9 5-9-5" />
      <path d="M3 8l9-5 9 5v8l-9 5-9-5Z" />
      <path d="M12 13v8" />
    </svg>
  );
}

function IconeCalendarioPainel({ className }: IconePainelProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M16 3v4" />
      <path d="M8 3v4" />
      <path d="M3 10h18" />
    </svg>
  );
}

function IconeAlertaPainel({ className }: IconePainelProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M10.3 4.3 2.7 17.5A2 2 0 0 0 4.4 20h15.2a2 2 0 0 0 1.7-2.5L13.7 4.3a2 2 0 0 0-3.4 0Z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </svg>
  );
}

function IconeCheckPainel({ className }: IconePainelProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="m8.5 12 2.2 2.2 4.8-5" />
    </svg>
  );
}

function IconeSetaPainel({ className }: IconePainelProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

function IconeListaPainel({ className }: IconePainelProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M9 6h11" />
      <path d="M9 12h11" />
      <path d="M9 18h11" />
      <path d="M4 6h.01" />
      <path d="M4 12h.01" />
      <path d="M4 18h.01" />
    </svg>
  );
}

function IconeDocumentoPainel({ className }: IconePainelProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
      <path d="M14 2v6h6" />
      <path d="M8 13h8" />
      <path d="M8 17h8" />
    </svg>
  );
}

function IconeGraficoPainel({ className }: IconePainelProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M4 19V9" />
      <path d="M10 19V5" />
      <path d="M16 19v-7" />
      <path d="M22 19H2" />
    </svg>
  );
}

function ResumoEscuro({
  titulo,
  valor,
  carregando,
  classe,
  marcador,
  detalhe,
  variante,
  icone,
}: {
  titulo: string;
  valor: string;
  carregando: boolean;
  classe: string;
  marcador: string;
  detalhe: string;
  variante: "emerald" | "orange" | "blue";
  icone: "caminhao" | "dinheiro" | "caixa" | "calendario";
}) {
  const configuracao =
    variante === "orange"
      ? {
          caixa:
            "border-orange-500/25 bg-[linear-gradient(145deg,rgba(249,115,22,0.10),rgba(15,23,42,0.72))]",
          icone:
            "border-orange-400/20 bg-orange-500/15 text-orange-300",
          pill:
            "border-orange-400/10 bg-orange-500/10 text-orange-200",
        }
      : variante === "blue"
        ? {
            caixa:
              "border-blue-500/25 bg-[linear-gradient(145deg,rgba(59,130,246,0.10),rgba(15,23,42,0.72))]",
            icone:
              "border-blue-400/20 bg-blue-500/15 text-blue-300",
            pill:
              "border-blue-400/10 bg-blue-500/10 text-blue-200",
          }
        : {
            caixa:
              "border-emerald-500/25 bg-[linear-gradient(145deg,rgba(16,185,129,0.10),rgba(15,23,42,0.72))]",
            icone:
              "border-emerald-400/20 bg-emerald-500/15 text-emerald-300",
            pill:
              "border-emerald-400/10 bg-emerald-500/10 text-emerald-200",
          };

  const Icone =
    icone === "dinheiro"
      ? IconeDinheiroPainel
      : icone === "caixa"
        ? IconeCaixaPainel
        : icone === "calendario"
          ? IconeCalendarioPainel
          : IconeCaminhaoPainel;

  return (
    <div
      className={`group relative overflow-hidden rounded-[22px] border p-5 shadow-[0_18px_38px_-28px_rgba(0,0,0,0.85)] transition duration-200 hover:-translate-y-0.5 ${configuracao.caixa}`}
    >
      <div className="flex items-start gap-4">
        <div
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border ${configuracao.icone}`}
        >
          <Icone className="h-6 w-6" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${marcador}`} />
              <p className="truncate text-[10px] font-extrabold uppercase tracking-[0.16em] text-slate-400">
                {titulo}
              </p>
            </div>

            <span className="flex h-5 w-5 items-center justify-center rounded-full border border-white/10 text-[10px] font-bold text-slate-500">
              i
            </span>
          </div>

          <p className={`mt-3 text-[24px] font-black leading-none tracking-[-0.03em] ${classe}`}>
            {carregando ? "..." : valor}
          </p>

          <div
            className={`mt-4 inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold ${configuracao.pill}`}
          >
            {carregando ? "Atualizando..." : detalhe}
          </div>
        </div>
      </div>
    </div>
  );
}

function AtalhoExecutivo({
  href,
  titulo,
  descricao,
  variante,
  icone,
}: {
  href: string;
  titulo: string;
  descricao: string;
  variante: "emerald" | "blue" | "violet" | "orange";
  icone: "alerta" | "lista" | "documento" | "grafico";
}) {
  const configuracao =
    variante === "blue"
      ? {
          caixa: "hover:border-blue-500/35 hover:bg-blue-500/[0.05]",
          icone: "bg-blue-500/15 text-blue-300",
          titulo: "text-blue-300",
        }
      : variante === "violet"
        ? {
            caixa: "hover:border-violet-500/35 hover:bg-violet-500/[0.05]",
            icone: "bg-violet-500/15 text-violet-300",
            titulo: "text-violet-300",
          }
        : variante === "orange"
          ? {
              caixa: "hover:border-orange-500/35 hover:bg-orange-500/[0.05]",
              icone: "bg-orange-500/15 text-orange-300",
              titulo: "text-orange-300",
            }
          : {
              caixa: "hover:border-emerald-500/35 hover:bg-emerald-500/[0.05]",
              icone: "bg-emerald-500/15 text-emerald-300",
              titulo: "text-emerald-300",
            };

  const Icone =
    icone === "lista"
      ? IconeListaPainel
      : icone === "documento"
        ? IconeDocumentoPainel
        : icone === "grafico"
          ? IconeGraficoPainel
          : IconeAlertaPainel;

  return (
    <Link
      href={href}
      className={`group flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900/55 p-3.5 transition ${configuracao.caixa}`}
    >
      <div
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${configuracao.icone}`}
      >
        <Icone className="h-5 w-5" />
      </div>

      <div className="min-w-0 flex-1">
        <p className={`truncate text-sm font-bold ${configuracao.titulo}`}>
          {titulo}
        </p>
        <p className="mt-0.5 truncate text-[11px] text-slate-400">
          {descricao}
        </p>
      </div>

      <IconeSetaPainel className="h-4 w-4 shrink-0 text-slate-600 transition group-hover:translate-x-0.5 group-hover:text-slate-300" />
    </Link>
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
      className={`relative overflow-hidden rounded-[22px] border p-5 shadow-sm shadow-slate-200/50 transition duration-200 hover:-translate-y-0.5 hover:shadow-md ${classe}`}
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
  href,
}: {
  titulo: string;
  valor: number;
  carregando: boolean;
  tipo: "positivo" | "pendente" | "vencido" | "total";
  href?: string;
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
        : tipo === "total"
          ? {
              caixa: "border-blue-200 bg-blue-50/70",
              titulo: "text-blue-800",
              ponto: "bg-blue-500",
              valor: "text-blue-950",
            }
          : {
              caixa: "border-orange-200 bg-orange-50/70",
              titulo: "text-orange-800",
              ponto: "bg-orange-500",
              valor: "text-orange-900",
            };

  const conteudo = (
    <div
      className={[
        "rounded-2xl border p-4 transition",
        classes.caixa,
        href
          ? "cursor-pointer hover:-translate-y-0.5 hover:shadow-md"
          : "",
      ].join(" ")}
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

      {href && (
        <p className="mt-2 text-[10px] font-semibold text-slate-500">
          Clique para ver os registros
        </p>
      )}
    </div>
  );

  if (!href) {
    return conteudo;
  }

  return (
    <Link href={href} className="block">
      {conteudo}
    </Link>
  );
}

function IndicadorFinanceiroAds({
  titulo,
  valor,
  carregando,
  tipo,
  href,
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
  href?: string;
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

  const conteudo = (
    <div
      className={[
        "rounded-2xl border p-4 transition",
        classes.caixa,
        href
          ? "cursor-pointer hover:-translate-y-0.5 hover:shadow-md"
          : "hover:-translate-y-0.5 hover:shadow-sm",
      ].join(" ")}
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

      {href && (
        <p className="mt-2 text-[10px] font-semibold text-slate-500">
          Ver registros
        </p>
      )}
    </div>
  );

  if (!href) {
    return conteudo;
  }

  return (
    <Link href={href} className="block">
      {conteudo}
    </Link>
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