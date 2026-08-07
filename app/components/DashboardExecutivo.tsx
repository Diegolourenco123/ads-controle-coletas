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
        { event: "*", schema: "public", table: "coletas" },
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
        if (tempo !== null) tempos.push(tempo);
      }

      if (
        coleta.data_prevista_coleta &&
        !dataEfetiva &&
        dataVencida(coleta.data_prevista_coleta)
      ) {
        atrasadas += 1;
      }

      if (mesmoDia(coleta.data_chegada_ads, hoje)) recebidasHoje += 1;
      if (!dataEfetiva && mesmoDia(coleta.data_prevista_coleta, hoje))
        previstasHoje += 1;
      if (!dataEfetiva && mesmoDia(coleta.data_prevista_coleta, amanha))
        previstasAmanha += 1;

      const dataPrevista = criarDataLocal(coleta.data_prevista_coleta);
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

      const valorAds = Number(coleta.valor_nf_cobranca_ads ?? 0);
      if (
        statusAds === "paga" ||
        Boolean(coleta.data_recebimento_pagamento_ads)
      ) {
        valorAdsRecebido += valorAds;
      } else if (valorAds > 0 && statusAds !== "cancelada") {
        valorAdsPendente += valorAds;
      }
    });

    const tempoMedio = tempos.length
      ? Math.round(tempos.reduce((a, b) => a + b, 0) / tempos.length)
      : 0;

    const coletasMes = coletas.filter((coleta) =>
      dentroDoMesAtual(coleta.data_solicitacao ?? coleta.created_at),
    ).length;

    const taxaConclusao = coletas.length
      ? Math.round((concluidas / coletas.length) * 100)
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
      tempoMedio,
      coletasMes,
      taxaConclusao,
    };
  }, [coletas]);

  const rankingClientes = useMemo(
    () => criarRanking(coletas, (coleta) => coleta.cliente),
    [coletas],
  );

  const rankingTransportadoras = useMemo(
    () => criarRanking(coletas, (coleta) => coleta.transportadora),
    [coletas],
  );

  const mensagemExecutiva = resumo.atrasadas
    ? `${resumo.atrasadas} ${
        resumo.atrasadas === 1 ? "coleta exige" : "coletas exigem"
      } atenção imediata por atraso.`
    : resumo.previstasHoje
      ? `Hoje existem ${resumo.previstasHoje} ${
          resumo.previstasHoje === 1
            ? "coleta prevista"
            : "coletas previstas"
        } para acompanhamento.`
      : "A operação não possui atrasos críticos identificados neste momento.";

  return (
    <section className="mb-8 space-y-6">
      {erro && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
          {erro}
        </div>
      )}

      <article className="overflow-hidden rounded-3xl border border-slate-200 bg-slate-950 text-white shadow-sm">
        <div className="h-1.5 bg-emerald-500" />

        <div className="grid gap-7 p-6 lg:grid-cols-[1.3fr_1fr] lg:p-8">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-emerald-400">
              Centro de Inteligência Operacional
            </p>

            <h3 className="mt-3 text-2xl font-black md:text-3xl">
              Visão executiva da operação
            </h3>

            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
              {carregando
                ? "Analisando os dados operacionais e financeiros..."
                : mensagemExecutiva}
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/alertas"
                className="rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-emerald-500"
              >
                Abrir Central de Alertas
              </Link>

              <Link
                href="/coletas"
                className="rounded-xl border border-slate-700 bg-slate-900 px-5 py-3 text-sm font-bold text-slate-200 transition hover:bg-slate-800"
              >
                Ver todas as coletas
              </Link>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <ResumoEscuro
              titulo="Fretes pendentes"
              valor={formatarMoeda(resumo.valorFretesPendentes)}
              carregando={carregando}
              classe="text-amber-300"
            />
            <ResumoEscuro
              titulo="A receber pela ADS"
              valor={formatarMoeda(resumo.valorAdsPendente)}
              carregando={carregando}
              classe="text-violet-300"
            />
            <ResumoEscuro
              titulo="Recebidas hoje"
              valor={String(resumo.recebidasHoje).padStart(2, "0")}
              carregando={carregando}
              classe="text-emerald-300"
            />
            <ResumoEscuro
              titulo="Previstas hoje"
              valor={String(resumo.previstasHoje).padStart(2, "0")}
              carregando={carregando}
              classe="text-blue-300"
            />
          </div>
        </div>
      </article>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi titulo="Coletas no mês" valor={String(resumo.coletasMes).padStart(2, "0")} detalhe="Solicitações registradas no período" carregando={carregando} classe="border-blue-200 bg-blue-50 text-blue-900" />
        <Kpi titulo="Taxa de conclusão" valor={`${resumo.taxaConclusao}%`} detalhe={`${resumo.concluidas} processos concluídos`} carregando={carregando} classe="border-emerald-200 bg-emerald-50 text-emerald-900" />
        <Kpi titulo="Tempo médio" valor={`${resumo.tempoMedio} dias`} detalhe="Da solicitação ao encerramento" carregando={carregando} classe="border-violet-200 bg-violet-50 text-violet-900" />
        <Kpi titulo="Operações atrasadas" valor={String(resumo.atrasadas).padStart(2, "0")} detalhe="Coletas com previsão ultrapassada" carregando={carregando} classe="border-red-200 bg-red-50 text-red-900" />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-700">
              Agenda operacional
            </p>
            <h3 className="mt-1 text-xl font-bold text-slate-900">
              Próximas coletas
            </h3>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <AgendaItem titulo="Hoje" valor={resumo.previstasHoje} carregando={carregando} />
            <AgendaItem titulo="Amanhã" valor={resumo.previstasAmanha} carregando={carregando} />
            <AgendaItem titulo="Próximos 7 dias" valor={resumo.previstasSemana} carregando={carregando} />
          </div>
        </article>

        <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-violet-700">
              Resumo financeiro
            </p>
            <h3 className="mt-1 text-xl font-bold text-slate-900">
              Pagamentos e recebimentos
            </h3>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Financeiro titulo="Fretes pagos" valor={resumo.valorFretesPagos} carregando={carregando} classe="border-emerald-200 bg-emerald-50 text-emerald-900" />
            <Financeiro titulo="Fretes pendentes" valor={resumo.valorFretesPendentes} carregando={carregando} classe="border-amber-200 bg-amber-50 text-amber-900" />
            <Financeiro titulo="Recebido pela ADS" valor={resumo.valorAdsRecebido} carregando={carregando} classe="border-blue-200 bg-blue-50 text-blue-900" />
            <Financeiro titulo="A receber pela ADS" valor={resumo.valorAdsPendente} carregando={carregando} classe="border-violet-200 bg-violet-50 text-violet-900" />
          </div>
        </article>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <RankingCard titulo="Ranking de clientes" subtitulo="Clientes com maior volume de coletas" ranking={rankingClientes} carregando={carregando} />
        <RankingCard titulo="Ranking de transportadoras" subtitulo="Transportadoras mais utilizadas" ranking={rankingTransportadoras} carregando={carregando} />
      </div>
    </section>
  );
}

function ResumoEscuro({ titulo, valor, carregando, classe }: { titulo: string; valor: string; carregando: boolean; classe: string }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
      <p className="text-xs font-bold uppercase text-slate-400">{titulo}</p>
      <p className={`mt-2 text-xl font-black ${classe}`}>{carregando ? "..." : valor}</p>
    </div>
  );
}

function Kpi({ titulo, valor, detalhe, carregando, classe }: { titulo: string; valor: string; detalhe: string; carregando: boolean; classe: string }) {
  return (
    <article className={`rounded-2xl border p-5 shadow-sm ${classe}`}>
      <p className="text-sm font-semibold opacity-75">{titulo}</p>
      <p className="mt-2 text-3xl font-black">{carregando ? "..." : valor}</p>
      <p className="mt-1 text-xs opacity-70">{detalhe}</p>
    </article>
  );
}

function AgendaItem({ titulo, valor, carregando }: { titulo: string; valor: number; carregando: boolean }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
      <p className="text-sm font-semibold text-slate-600">{titulo}</p>
      <p className="mt-2 text-3xl font-black text-slate-900">{carregando ? "..." : String(valor).padStart(2, "0")}</p>
    </div>
  );
}

function Financeiro({ titulo, valor, carregando, classe }: { titulo: string; valor: number; carregando: boolean; classe: string }) {
  return (
    <div className={`rounded-2xl border p-5 ${classe}`}>
      <p className="text-sm font-semibold">{titulo}</p>
      <p className="mt-2 text-2xl font-black">{carregando ? "..." : formatarMoeda(valor)}</p>
    </div>
  );
}

function RankingCard({ titulo, subtitulo, ranking, carregando }: { titulo: string; subtitulo: string; ranking: Ranking[]; carregando: boolean }) {
  return (
    <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-5">
        <h3 className="text-xl font-bold text-slate-900">{titulo}</h3>
        <p className="mt-1 text-sm text-slate-500">{subtitulo}</p>
      </div>

      {carregando && <div className="rounded-2xl bg-slate-50 p-5 text-sm text-slate-500">Carregando ranking...</div>}

      {!carregando && ranking.length === 0 && <div className="rounded-2xl bg-slate-50 p-5 text-sm text-slate-500">Nenhum dado disponível.</div>}

      {!carregando && ranking.length > 0 && (
        <div className="space-y-4">
          {ranking.map((item, indice) => (
            <div key={item.nome}>
              <div className="mb-2 flex items-center justify-between gap-4">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-black text-white">
                    {indice + 1}
                  </span>
                  <p className="truncate text-sm font-bold text-slate-800">{item.nome}</p>
                </div>
                <p className="shrink-0 text-sm font-black text-emerald-700">
                  {item.quantidade} {item.quantidade === 1 ? "coleta" : "coletas"}
                </p>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                <div className="h-full rounded-full bg-emerald-600 transition-all duration-700" style={{ width: `${item.percentual}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </article>
  );
}