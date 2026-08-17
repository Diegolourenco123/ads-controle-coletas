"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Header from "../components/Header";
import Sidebar from "../components/Sidebar";
import { supabase } from "../lib/supabase";

type Coleta = {
  id: number;
  data_solicitacao: string | null;
  numero_ov: string | null;
  cliente: string | null;
  loja: string | null;
  cidade: string | null;
  estado: string | null;
  numero_nf: string | null;
  data_nf: string | null;
  transportadora: string | null;
  data_envio_transportadora: string | null;
  data_prevista_coleta: string | null;
  data_coleta: string | null;
  data_efetiva_coleta: string | null;
  data_chegada_ads: string | null;
  status: string | null;
  created_at: string | null;

  // Etapa 2 — Financeiro / Transportadora
  conhecimento: string | null;
  valor_frete: number | null;
  vencimento_transportadora: string | null;
  status_pagamento_transportadora: string | null;
  data_pagamento_transportadora: string | null;
  situacao_pagamento_transportadora: string | null;

  // Etapa 3 — Financeiro / ADS
  numero_nf_cobranca_ads: string | null;
  data_emissao_nf_cobranca_ads: string | null;
  valor_nf_cobranca_ads: number | null;
  vencimento_nf_cobranca_ads: string | null;
  status_recebimento_ads: string | null;
  data_recebimento_pagamento_ads: string | null;
  situacao_recebimento: string | null;
};

function formatarData(data: string | null) {
  if (!data) {
    return "—";
  }

  const [ano, mes, dia] = data.split("-");

  return ano && mes && dia
    ? `${dia}/${mes}/${ano}`
    : data;
}

function classeStatus(status: string | null) {
  if (status === "Em transporte") {
    return {
      badge:
        "border-blue-200 bg-blue-50 text-blue-700",
      ponto: "bg-blue-500",
    };
  }

  if (status === "Aguardando NF") {
    return {
      badge:
        "border-amber-200 bg-amber-50 text-amber-700",
      ponto: "bg-amber-500",
    };
  }

  if (
    status === "Aguardando coleta" ||
    status === "Coleta solicitada"
  ) {
    return {
      badge:
        "border-orange-200 bg-orange-50 text-orange-700",
      ponto: "bg-orange-500",
    };
  }

  if (status === "Coleta realizada") {
    return {
      badge:
        "border-blue-200 bg-blue-50 text-blue-700",
      ponto: "bg-blue-500",
    };
  }

  if (
    status === "Finalizado" ||
    status === "Recebido na ADS"
  ) {
    return {
      badge:
        "border-emerald-200 bg-emerald-50 text-emerald-700",
      ponto: "bg-emerald-500",
    };
  }

  return {
    badge:
      "border-slate-200 bg-slate-50 text-slate-600",
    ponto: "bg-slate-400",
  };
}


type VisualStatus = {
  badge: string;
  ponto: string;
};

function dataVencida(data: string | null) {
  if (!data) return false;

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  const vencimento = new Date(`${data}T00:00:00`);
  return vencimento.getTime() < hoje.getTime();
}

function statusCtePago(coleta: Coleta) {
  if (coleta.data_pagamento_transportadora) {
    return true;
  }

  const statusBanco = (
    coleta.status_pagamento_transportadora ||
    coleta.situacao_pagamento_transportadora ||
    ""
  )
    .trim()
    .toLowerCase();

  return (
    statusBanco.includes("pago") ||
    statusBanco.includes("quitado")
  );
}

function cteSeAplica(coleta: Coleta) {
  const transportadora = (coleta.transportadora ?? "")
    .trim()
    .toLowerCase();

  const conhecimento = (coleta.conhecimento ?? "")
    .trim()
    .toLowerCase();

  // Coletas realizadas pela própria ADS não geram CT-e de
  // transportadora terceirizada.
  if (
    transportadora.includes("ads logística") ||
    transportadora === "ads" ||
    conhecimento === "n/a" ||
    conhecimento === "na" ||
    conhecimento === "não se aplica" ||
    conhecimento === "nao se aplica"
  ) {
    return false;
  }

  // Sem transportadora definida, não cobramos CT-e nesta etapa.
  if (!transportadora) {
    return false;
  }

  return true;
}

function statusCobrancaPaga(coleta: Coleta) {
  if (coleta.data_recebimento_pagamento_ads) {
    return true;
  }

  const statusBanco = (
    coleta.status_recebimento_ads ||
    coleta.situacao_recebimento ||
    ""
  )
    .trim()
    .toLowerCase();

  return (
    statusBanco.includes("pago") ||
    statusBanco.includes("paga") ||
    statusBanco.includes("recebido") ||
    statusBanco.includes("recebida")
  );
}

function obterStatusAtual(coleta: Coleta) {
  const statusOperacional = (coleta.status ?? "").trim();

  /*
   * STATUS CONSOLIDADO
   *
   * A regra aqui é sempre dar prioridade para a etapa mais avançada
   * que já possui informação preenchida no sistema.
   *
   * Exemplo:
   * - se a coleta ainda está apenas na operação, mostramos o status operacional;
   * - se já existe cobrança da transportadora, mostramos o status do CT-e;
   * - se já existe NF de cobrança da ADS, essa etapa passa a ter prioridade;
   * - quando tudo estiver pago, mostramos Finalizado.
   */

  const temNfCobranca =
    Boolean(coleta.numero_nf_cobranca_ads) ||
    Boolean(coleta.data_emissao_nf_cobranca_ads) ||
    coleta.valor_nf_cobranca_ads !== null ||
    Boolean(coleta.vencimento_nf_cobranca_ads);

  /*
   * ETAPA 3 — FINANCEIRO ADS
   * Se a NF de cobrança já foi emitida/preenchida, ela é a etapa
   * mais avançada e deve prevalecer sobre "Coleta realizada".
   */
  if (temNfCobranca) {
    if (statusCobrancaPaga(coleta)) {
      return "Finalizado";
    }

    if (
      coleta.vencimento_nf_cobranca_ads &&
      dataVencida(coleta.vencimento_nf_cobranca_ads)
    ) {
      return "NF vencida";
    }

    return "NF de cobrança emitida";
  }

  /*
   * ETAPA 1 — OPERAÇÃO
   * Enquanto a operação física ainda não terminou e ainda não existe
   * uma NF de cobrança da ADS, mantemos o status operacional.
   */
  if (
    statusOperacional &&
    statusOperacional !== "Recebido na ADS" &&
    statusOperacional !== "Finalizado"
  ) {
    return statusOperacional;
  }

  /*
   * ETAPA 2 — FINANCEIRO TRANSPORTADORA
   * Depois do recebimento/finalização operacional, verificamos o CT-e.
   */
  if (cteSeAplica(coleta) && !statusCtePago(coleta)) {
    if (
      coleta.vencimento_transportadora &&
      dataVencida(coleta.vencimento_transportadora)
    ) {
      return "CT-e vencido";
    }

    return "CT-e não pago";
  }

  /*
   * Se a operação já terminou, o CT-e está pago ou não se aplica,
   * e ainda não existe NF de cobrança da ADS.
   */
  return "NF de cobrança não emitida";
}

function classeStatusAtual(status: string): VisualStatus {
  if (
    status === "Finalizado" ||
    status === "Recebido na ADS"
  ) {
    return {
      badge:
        "border-emerald-200 bg-emerald-50 text-emerald-700",
      ponto: "bg-emerald-500",
    };
  }

  if (
    status === "CT-e vencido" ||
    status === "NF vencida"
  ) {
    return {
      badge: "border-red-200 bg-red-50 text-red-700",
      ponto: "bg-red-500",
    };
  }

  if (
    status === "CT-e não pago" ||
    status === "NF de cobrança não emitida" ||
    status === "NF de cobrança emitida" ||
    status === "Aguardando pagamento do cliente"
  ) {
    return {
      badge:
        "border-orange-200 bg-orange-50 text-orange-700",
      ponto: "bg-orange-500",
    };
  }

  return classeStatus(status);
}

function BadgeStatus({
  texto,
  visual,
}: {
  texto: string;
  visual: VisualStatus;
}) {
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[11px] font-bold ${visual.badge}`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${visual.ponto}`}
      />
      {texto}
    </span>
  );
}

function IconePesquisar() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

function IconeEditar() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
      aria-hidden="true"
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z" />
    </svg>
  );
}

function IconeExcluir() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
      aria-hidden="true"
    >
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M19 6l-1 14H6L5 6" />
      <path d="M10 11v5" />
      <path d="M14 11v5" />
    </svg>
  );
}

function IconeMais() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      className="h-4 w-4"
      aria-hidden="true"
    >
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  );
}


function normalizarTexto(texto: string | null | undefined) {
  return (texto ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

const nomesIndicadores: Record<string, string> = {
  total: "Todas as coletas",
  "aguardando-nf": "Aguardando NF",
  "aguardando-coleta": "Aguardando coleta",
  "coleta-realizada": "Coleta realizada",
  "recebidos-ads": "Resíduos recebidos na ADS",
  "cte-aguardando-pagamento": "CT-es aguardando pagamento",
  "cte-pagos": "CT-es pagos",
  "cte-vencidos": "CT-es vencidos",
  "nf-ads-emitidas": "NFs de cobrança emitidas",
  "nf-ads-aguardando": "Aguardando recebimento",
  "nf-ads-pagas": "NFs pagas",
  "nf-ads-vencidas": "NFs vencidas",
};

function pertenceAoIndicador(
  coleta: Coleta,
  indicador: string,
) {
  if (!indicador || indicador === "total") {
    return true;
  }

  const statusOperacional = normalizarTexto(coleta.status);

  const statusTransportadora = normalizarTexto(
    coleta.status_pagamento_transportadora,
  );

  const pagamentoTransportadoraConcluido =
    statusTransportadora === "pago";

  const pagamentoTransportadoraVencido =
    !pagamentoTransportadoraConcluido &&
    dataVencida(coleta.vencimento_transportadora);

  const possuiCobrancaTransportadora =
    Boolean(coleta.conhecimento) ||
    Boolean(coleta.vencimento_transportadora) ||
    statusTransportadora === "aguardando pagamento" ||
    statusTransportadora === "vencido";

  const statusAds = normalizarTexto(
    coleta.status_recebimento_ads,
  );

  const nfAdsEmitida =
    Boolean(coleta.numero_nf_cobranca_ads) ||
    Boolean(coleta.data_emissao_nf_cobranca_ads) ||
    statusAds === "emitida" ||
    statusAds === "aguardando recebimento" ||
    statusAds === "paga" ||
    statusAds === "vencida";

  const nfAdsPaga = statusAds === "paga";

  const nfAdsVencida =
    !nfAdsPaga &&
    dataVencida(coleta.vencimento_nf_cobranca_ads);

  switch (indicador) {
    case "aguardando-nf":
      return statusOperacional === "aguardando nf";

    case "aguardando-coleta":
      return statusOperacional === "aguardando coleta";

    case "coleta-realizada":
      return statusOperacional === "coleta realizada";

    case "recebidos-ads":
      return (
        statusOperacional === "recebido na ads" ||
        statusOperacional === "finalizado"
      );

    case "cte-pagos":
      return pagamentoTransportadoraConcluido;

    case "cte-vencidos":
      return pagamentoTransportadoraVencido;

    case "cte-aguardando-pagamento":
      return (
        !pagamentoTransportadoraConcluido &&
        !pagamentoTransportadoraVencido &&
        possuiCobrancaTransportadora
      );

    case "nf-ads-emitidas":
      return nfAdsEmitida;

    case "nf-ads-pagas":
      return nfAdsPaga;

    case "nf-ads-vencidas":
      return nfAdsVencida;

    case "nf-ads-aguardando":
      return (
        nfAdsEmitida &&
        !nfAdsPaga &&
        !nfAdsVencida &&
        statusAds !== "cancelada"
      );

    default:
      return true;
  }
}

function TodasAsColetasContent() {
  const searchParams = useSearchParams();
  const indicador = searchParams.get("indicador") ?? "";

  const [coletas, setColetas] = useState<Coleta[]>([]);
  const [pesquisa, setPesquisa] = useState("");
  const [status, setStatus] = useState("");
  const [carregando, setCarregando] =
    useState(true);
  const [erro, setErro] = useState("");
  const [excluindoId, setExcluindoId] =
    useState<number | null>(null);

  useEffect(() => {
    let componenteAtivo = true;

    async function carregarColetas(
      mostrarCarregamento = true,
    ) {
      if (mostrarCarregamento) {
        setCarregando(true);
      }

      setErro("");

      const { data, error } = await supabase
        .from("coletas")
        .select(
          "id, data_solicitacao, numero_ov, cliente, loja, cidade, estado, numero_nf, data_nf, transportadora, data_envio_transportadora, data_prevista_coleta, data_coleta, data_efetiva_coleta, data_chegada_ads, status, created_at, conhecimento, valor_frete, vencimento_transportadora, status_pagamento_transportadora, data_pagamento_transportadora, situacao_pagamento_transportadora, numero_nf_cobranca_ads, data_emissao_nf_cobranca_ads, valor_nf_cobranca_ads, vencimento_nf_cobranca_ads, status_recebimento_ads, data_recebimento_pagamento_ads, situacao_recebimento",
        )
        .order("created_at", {
          ascending: false,
        });

      if (!componenteAtivo) {
        return;
      }

      if (error) {
        console.error(
          "Erro ao carregar coletas:",
          error,
        );

        setErro(
          "Não foi possível carregar as coletas.",
        );

        setCarregando(false);
        return;
      }

      setColetas((data ?? []) as Coleta[]);
      setCarregando(false);
    }

    // Carrega os dados mais recentes ao abrir a página.
    carregarColetas();

    // Atualiza automaticamente quando qualquer coleta for
    // criada, alterada ou excluída no Supabase.
    const canal = supabase
      .channel("todas-as-coletas-tempo-real")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "coletas",
        },
        () => {
          carregarColetas(false);
        },
      )
      .subscribe();

    // Também força uma atualização ao voltar para esta aba/janela.
    function atualizarAoVoltar() {
      carregarColetas(false);
    }

    function atualizarAoMudarVisibilidade() {
      if (document.visibilityState === "visible") {
        carregarColetas(false);
      }
    }

    window.addEventListener(
      "focus",
      atualizarAoVoltar,
    );

    window.addEventListener(
      "pageshow",
      atualizarAoVoltar,
    );

    document.addEventListener(
      "visibilitychange",
      atualizarAoMudarVisibilidade,
    );

    return () => {
      componenteAtivo = false;

      window.removeEventListener(
        "focus",
        atualizarAoVoltar,
      );

      window.removeEventListener(
        "pageshow",
        atualizarAoVoltar,
      );

      document.removeEventListener(
        "visibilitychange",
        atualizarAoMudarVisibilidade,
      );

      supabase.removeChannel(canal);
    };
  }, []);

  async function excluirColeta(coleta: Coleta) {
    const identificacao =
      coleta.numero_ov ||
      coleta.loja ||
      `#${coleta.id}`;

    const confirmou = window.confirm(
      `Tem certeza que deseja excluir a coleta ${identificacao}?\n\nEsta ação não poderá ser desfeita.`,
    );

    if (!confirmou) {
      return;
    }

    setErro("");
    setExcluindoId(coleta.id);

    const { error } = await supabase
      .from("coletas")
      .delete()
      .eq("id", coleta.id);

    if (error) {
      console.error(
        "Erro ao excluir coleta:",
        error,
      );

      setErro(
        `Não foi possível excluir a coleta: ${error.message}`,
      );

      setExcluindoId(null);

      return;
    }

    setColetas((listaAtual) =>
      listaAtual.filter(
        (item) => item.id !== coleta.id,
      ),
    );

    setExcluindoId(null);
  }

  const coletasFiltradas = useMemo(() => {
    const termo = pesquisa.trim().toLowerCase();

    return coletas.filter((coleta) => {
      if (!pertenceAoIndicador(coleta, indicador)) {
        return false;
      }

      const statusAtual = obterStatusAtual(coleta);

      const correspondeStatus =
        !status || statusAtual === status;

      const conteudo = [
        coleta.numero_ov,
        coleta.cliente,
        coleta.loja,
        coleta.cidade,
        coleta.estado,
        coleta.numero_nf,
        coleta.transportadora,
        coleta.status,
        coleta.conhecimento,
        coleta.numero_nf_cobranca_ads,
        statusAtual,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const correspondePesquisa =
        !termo || conteudo.includes(termo);

      return correspondeStatus && correspondePesquisa;
    });
  }, [coletas, pesquisa, status, indicador]);

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <Header />

      <div className="mx-auto grid max-w-[1600px] grid-cols-1 lg:grid-cols-[230px_1fr]">
        <Sidebar />

        <section className="min-w-0 px-5 py-7 md:px-8 lg:px-8">

          {/* CABEÇALHO */}
          <div className="mb-7 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
            <div>
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />

                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-700">
                  Controle operacional
                </p>
              </div>

              <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950">
                {indicador
                  ? nomesIndicadores[indicador] ?? "Todas as coletas"
                  : "Todas as coletas"}
              </h2>

              <p className="mt-1.5 text-sm text-slate-500">
                {indicador
                  ? "Lista filtrada pelo indicador selecionado no painel."
                  : "Consulte, acompanhe e atualize todas as operações cadastradas."}
              </p>

              {indicador && (
                <Link
                  href="/coletas"
                  className="mt-2 inline-flex text-xs font-bold text-blue-600 transition hover:text-blue-700"
                >
                  ← Limpar filtro do painel
                </Link>
              )}
            </div>

            <Link
              href="/coletas/nova"
              className="inline-flex w-fit items-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-700"
            >
              <IconeMais />
              Nova coleta
            </Link>
          </div>

          {/* RESUMO */}
          <div className="mb-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-white px-3 py-3 shadow-sm">
              <p className="text-xs font-semibold text-slate-500">
                Total de registros
              </p>

              <p className="mt-1 text-2xl font-black text-slate-900">
                {String(coletas.length).padStart(
                  2,
                  "0",
                )}
              </p>
            </div>

            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 px-3 py-3 shadow-sm">
              <p className="text-xs font-semibold text-emerald-700">
                Registros exibidos
              </p>

              <p className="mt-1 text-2xl font-black text-emerald-800">
                {String(
                  coletasFiltradas.length,
                ).padStart(2, "0")}
              </p>
            </div>

            <div className="rounded-2xl border border-blue-200 bg-blue-50/70 px-3 py-3 shadow-sm">
              <p className="text-xs font-semibold text-blue-700">
                Filtro atual
              </p>

              <p className="mt-1 truncate text-sm font-bold text-blue-900">
                {indicador
                  ? nomesIndicadores[indicador] ?? indicador
                  : status ||
                    (pesquisa
                      ? `Busca: ${pesquisa}`
                      : "Todos os registros")}
              </p>
            </div>
          </div>

          {/* TABELA */}
          <article className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm">

            {/* FILTROS */}
            <div className="border-b border-slate-200 bg-white p-5">
              <div className="grid gap-3 md:grid-cols-[1fr_280px]">
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-slate-400">
                    <IconePesquisar />
                  </div>

                  <input
                    type="search"
                    value={pesquisa}
                    onChange={(evento) =>
                      setPesquisa(evento.target.value)
                    }
                    placeholder="Pesquisar cliente, OV, NF, cidade, transportadora..."
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10"
                  />
                </div>

                <select
                  value={status}
                  onChange={(evento) =>
                    setStatus(evento.target.value)
                  }
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700 outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10"
                >
                  <option value="">Todos os status</option>
                  <option value="Aguardando NF">Aguardando NF</option>
                  <option value="Aguardando coleta">Aguardando coleta</option>
                  <option value="Coleta realizada">Coleta realizada</option>
                  <option value="Em transporte">Em transporte</option>
                  <option value="Recebido na ADS">Recebido na ADS</option>
                  <option value="CT-e não pago">CT-e não pago</option>
                  <option value="CT-e vencido">CT-e vencido</option>
                  <option value="NF de cobrança não emitida">NF de cobrança não emitida</option>
                  <option value="NF de cobrança emitida">NF de cobrança emitida</option>
                  <option value="Aguardando pagamento do cliente">Aguardando pagamento do cliente</option>
                  <option value="NF vencida">NF vencida</option>
                  <option value="Finalizado">Finalizado</option>
                </select>
              </div>
            </div>

            {erro && (
              <div className="m-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                {erro}
              </div>
            )}

            <div className="w-full overflow-x-auto">
              <table className="w-full min-w-[1120px] table-auto text-left">
                <thead className="border-b border-slate-200 bg-slate-50/80">
                  <tr>
                    <th className="whitespace-nowrap px-3 py-3 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                      Solicitação
                    </th>

                    <th className="whitespace-nowrap px-3 py-3 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                      OV
                    </th>

                    <th className="px-3 py-3 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                      Cliente / Unidade
                    </th>

                    <th className="whitespace-nowrap px-3 py-3 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                      NF
                    </th>

                    <th className="px-3 py-3 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                      Transportadora
                    </th>

                    <th className="whitespace-nowrap px-3 py-3 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                      Coleta
                    </th>

                    <th className="px-3 py-3 text-[10px] font-bold uppercase leading-4 tracking-wide text-slate-500">
                      Status atual
                    </th>

                    <th className="whitespace-nowrap px-3 py-3 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                      Ações
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {carregando && (
                    <tr>
                      <td
                        colSpan={8}
                        className="px-5 py-16 text-center"
                      >
                        <div className="mx-auto flex max-w-xs flex-col items-center">
                          <span className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-emerald-600" />

                          <p className="mt-4 text-sm font-medium text-slate-500">
                            Carregando coletas...
                          </p>
                        </div>
                      </td>
                    </tr>
                  )}

                  {!carregando &&
                    coletasFiltradas.length ===
                      0 && (
                      <tr>
                        <td
                          colSpan={8}
                          className="px-5 py-16 text-center"
                        >
                          <div className="mx-auto max-w-sm">
                            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                              <IconePesquisar />
                            </div>

                            <p className="mt-4 font-bold text-slate-700">
                              Nenhuma coleta encontrada
                            </p>

                            <p className="mt-1 text-sm text-slate-500">
                              Tente alterar a pesquisa
                              ou o filtro selecionado.
                            </p>
                          </div>
                        </td>
                      </tr>
                    )}

                  {!carregando &&
                    coletasFiltradas.map(
                      (coleta) => {
                        const statusAtual =
                          obterStatusAtual(coleta);
                        const visualStatusAtual =
                          classeStatusAtual(statusAtual);

                        return (
                          <tr
                            key={coleta.id}
                            className="group transition-colors hover:bg-slate-50/80"
                          >
                            <td className="whitespace-nowrap px-3 py-3 text-sm text-slate-600">
                              {formatarData(
                                coleta.data_solicitacao,
                              )}
                            </td>

                            <td className="whitespace-nowrap px-3 py-3">
                              <div className="inline-flex rounded-lg bg-emerald-50 px-2.5 py-1.5 text-sm font-black text-emerald-700">
                                {coleta.numero_ov ||
                                  `#${coleta.id}`}
                              </div>
                            </td>

                            <td className="max-w-[250px] px-3 py-3">
                              <p className="font-bold text-slate-800">
                                {coleta.cliente ||
                                  "Cliente não informado"}
                              </p>

                              <p className="mt-1 max-w-[320px] text-xs leading-5 text-slate-500">
                                {[
                                  coleta.loja,
                                  coleta.cidade,
                                  coleta.estado,
                                ]
                                  .filter(Boolean)
                                  .join(" • ") ||
                                  "Unidade não informada"}
                              </p>
                            </td>

                            <td className="whitespace-nowrap px-3 py-3 text-sm font-medium text-slate-700">
                              {coleta.numero_nf ||
                                "Aguardando"}
                            </td>

                            <td className="max-w-[180px] px-3 py-3 text-sm font-medium leading-5 text-slate-700">
                              {coleta.transportadora ||
                                "Não definida"}
                            </td>

                            <td className="whitespace-nowrap px-3 py-3 text-sm text-slate-600">
                              {formatarData(
                                coleta.data_coleta ||
                                  coleta.data_prevista_coleta,
                              )}
                            </td>

                            <td className="whitespace-nowrap px-3 py-3">
                              <BadgeStatus
                                texto={statusAtual}
                                visual={visualStatusAtual}
                              />
                            </td>

                            <td className="whitespace-nowrap px-3 py-3">
                              <div className="flex items-center gap-2">
                                <Link
                                  href={`/coletas/${coleta.id}`}
                                  className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-[11px] font-bold text-blue-700 transition hover:border-blue-300 hover:bg-blue-100"
                                >
                                  <IconeEditar />
                                  Editar
                                </Link>

                                <button
                                  type="button"
                                  onClick={() =>
                                    excluirColeta(
                                      coleta,
                                    )
                                  }
                                  disabled={
                                    excluindoId ===
                                    coleta.id
                                  }
                                  className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-[11px] font-bold text-red-700 transition hover:border-red-300 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  <IconeExcluir />

                                  {excluindoId ===
                                  coleta.id
                                    ? "Excluindo..."
                                    : "Excluir"}
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      },
                    )}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col justify-between gap-2 border-t border-slate-200 bg-slate-50/50 px-3 py-3 text-xs text-slate-500 sm:flex-row sm:items-center">
              <p>
                <span className="font-bold text-slate-700">
                  {coletasFiltradas.length}
                </span>{" "}
                coleta(s) exibida(s)
              </p>

              <p>
                Total no banco:{" "}
                <span className="font-bold text-slate-700">
                  {coletas.length}
                </span>
              </p>
            </div>
          </article>
        </section>
      </div>
    </main>
  );
}

function CarregandoTodasAsColetas() {
  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <Header />

      <div className="mx-auto grid max-w-[1600px] grid-cols-1 lg:grid-cols-[230px_1fr]">
        <Sidebar />

        <section className="min-w-0 px-5 py-7 md:px-8 lg:px-8">
          <div className="mb-7">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-700">
                Controle operacional
              </p>
            </div>

            <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950">
              Todas as coletas
            </h2>

            <p className="mt-1.5 text-sm text-slate-500">
              Carregando operações cadastradas...
            </p>
          </div>

          <article className="rounded-[24px] border border-slate-200 bg-white px-5 py-16 text-center shadow-sm">
            <span className="mx-auto block h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-emerald-600" />
            <p className="mt-4 text-sm font-medium text-slate-500">
              Carregando coletas...
            </p>
          </article>
        </section>
      </div>
    </main>
  );
}

export default function TodasAsColetasPage() {
  return (
    <Suspense fallback={<CarregandoTodasAsColetas />}>
      <TodasAsColetasContent />
    </Suspense>
  );
}