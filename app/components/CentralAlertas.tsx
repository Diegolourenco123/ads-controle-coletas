"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

type Coleta = {
  id: number;
  numero_ov: string | null;
  cliente: string | null;
  loja: string | null;
  cidade: string | null;
  estado: string | null;

  data_solicitacao: string | null;

  data_nf: string | null;
  numero_nf: string | null;

  transportadora: string | null;
  data_envio_transportadora: string | null;
  data_prevista_coleta: string | null;
  data_efetiva_coleta: string | null;
  data_coleta: string | null;
  data_chegada_ads: string | null;

  status: string | null;

  conhecimento: string | null;

  vencimento_transportadora: string | null;
  status_pagamento_transportadora: string | null;
  data_pagamento_transportadora: string | null;

  vencimento_nf_cobranca_ads: string | null;
  status_recebimento_ads: string | null;
  data_recebimento_pagamento_ads: string | null;
};

type Prioridade = "critica" | "alta" | "media" | "informativa";

type Alerta = {
  id: string;
  coletaId: number;
  numeroOv: string;
  cliente: string;
  localizacao: string;
  titulo: string;
  descricao: string;
  prioridade: Prioridade;
  categoria: "Operação" | "Transportadora" | "Financeiro ADS";
  dataReferencia: string | null;
};

type Filtro =
  | "todos"
  | "criticos"
  | "operacao"
  | "transportadora"
  | "financeiroAds";

function normalizarTexto(texto: string | null | undefined) {
  return (texto ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function criarDataLocal(data: string | null) {
  if (!data) {
    return null;
  }

  const [ano, mes, dia] = data.split("-").map(Number);

  if (!ano || !mes || !dia) {
    return null;
  }

  const resultado = new Date(ano, mes - 1, dia);
  resultado.setHours(0, 0, 0, 0);

  return resultado;
}

function formatarData(data: string | null) {
  if (!data) {
    return "Data não informada";
  }

  const [ano, mes, dia] = data.split("-");

  if (!ano || !mes || !dia) {
    return data;
  }

  return `${dia}/${mes}/${ano}`;
}

function diferencaEmDias(dataInicial: string | null) {
  const inicio = criarDataLocal(dataInicial);

  if (!inicio) {
    return 0;
  }

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  return Math.floor(
    (hoje.getTime() - inicio.getTime()) /
      (1000 * 60 * 60 * 24),
  );
}

function diasAteData(data: string | null) {
  const dataFinal = criarDataLocal(data);

  if (!dataFinal) {
    return null;
  }

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  return Math.ceil(
    (dataFinal.getTime() - hoje.getTime()) /
      (1000 * 60 * 60 * 24),
  );
}

function coletaFinalizada(coleta: Coleta) {
  const status = normalizarTexto(coleta.status);
  const recebimentoAds = normalizarTexto(
    coleta.status_recebimento_ads,
  );

  return (
    status === "finalizado" ||
    recebimentoAds === "paga" ||
    Boolean(coleta.data_recebimento_pagamento_ads)
  );
}

function configurarPrioridade(prioridade: Prioridade) {
  if (prioridade === "critica") {
    return {
      card: "border-red-200 bg-red-50",
      faixa: "bg-red-600",
      selo: "bg-red-100 text-red-700",
      circulo: "bg-red-600 text-white",
      titulo: "text-red-900",
      nome: "Crítica",
    };
  }

  if (prioridade === "alta") {
    return {
      card: "border-orange-200 bg-orange-50",
      faixa: "bg-orange-500",
      selo: "bg-orange-100 text-orange-700",
      circulo: "bg-orange-500 text-white",
      titulo: "text-orange-900",
      nome: "Alta",
    };
  }

  if (prioridade === "media") {
    return {
      card: "border-amber-200 bg-amber-50",
      faixa: "bg-amber-500",
      selo: "bg-amber-100 text-amber-700",
      circulo: "bg-amber-500 text-white",
      titulo: "text-amber-900",
      nome: "Média",
    };
  }

  return {
    card: "border-blue-200 bg-blue-50",
    faixa: "bg-blue-500",
    selo: "bg-blue-100 text-blue-700",
    circulo: "bg-blue-500 text-white",
    titulo: "text-blue-900",
    nome: "Informativa",
  };
}

function gerarAlertas(coletas: Coleta[]) {
  const alertas: Alerta[] = [];

  coletas.forEach((coleta) => {
    if (coletaFinalizada(coleta)) {
      return;
    }

    const numeroOv =
      coleta.numero_ov || `Coleta #${coleta.id}`;

    const cliente =
      [coleta.cliente, coleta.loja]
        .filter(Boolean)
        .join(" • ") || "Cliente não informado";

    const localizacao =
      [coleta.cidade, coleta.estado]
        .filter(Boolean)
        .join(" / ") || "Localização não informada";

    const dataEfetiva =
      coleta.data_efetiva_coleta ?? coleta.data_coleta;

    const pagamentoTransportadora = normalizarTexto(
      coleta.status_pagamento_transportadora,
    );

    const recebimentoAds = normalizarTexto(
      coleta.status_recebimento_ads,
    );

    const diasOperacao = diferencaEmDias(
      coleta.data_solicitacao,
    );

    const diasParaColeta = diasAteData(
      coleta.data_prevista_coleta,
    );

    const diasParaPagamentoTransportadora = diasAteData(
      coleta.vencimento_transportadora,
    );

    const diasParaRecebimentoAds = diasAteData(
      coleta.vencimento_nf_cobranca_ads,
    );

    if (
      diasParaColeta !== null &&
      diasParaColeta < 0 &&
      !dataEfetiva
    ) {
      const diasAtraso = Math.abs(diasParaColeta);

      alertas.push({
        id: `coleta-atrasada-${coleta.id}`,
        coletaId: coleta.id,
        numeroOv,
        cliente,
        localizacao,
        titulo: "Coleta atrasada",
        descricao: `A coleta estava prevista para ${formatarData(
          coleta.data_prevista_coleta,
        )} e está atrasada há ${diasAtraso} ${
          diasAtraso === 1 ? "dia" : "dias"
        }.`,
        prioridade: diasAtraso >= 3 ? "critica" : "alta",
        categoria: "Operação",
        dataReferencia: coleta.data_prevista_coleta,
      });
    }

    if (diasParaColeta === 0 && !dataEfetiva) {
      alertas.push({
        id: `coleta-hoje-${coleta.id}`,
        coletaId: coleta.id,
        numeroOv,
        cliente,
        localizacao,
        titulo: "Coleta prevista para hoje",
        descricao:
          "Acompanhe a transportadora e confirme a realização da coleta.",
        prioridade: "informativa",
        categoria: "Operação",
        dataReferencia: coleta.data_prevista_coleta,
      });
    }

    if (!coleta.data_nf || !coleta.numero_nf) {
      alertas.push({
        id: `nf-pendente-${coleta.id}`,
        coletaId: coleta.id,
        numeroOv,
        cliente,
        localizacao,
        titulo: "Nota Fiscal pendente",
        descricao:
          "A data ou o número da Nota Fiscal do cliente ainda não foi registrado.",
        prioridade: diasOperacao >= 3 ? "alta" : "media",
        categoria: "Operação",
        dataReferencia: coleta.data_solicitacao,
      });
    }

    if (
      coleta.data_nf &&
      coleta.numero_nf &&
      !coleta.transportadora
    ) {
      alertas.push({
        id: `transportadora-pendente-${coleta.id}`,
        coletaId: coleta.id,
        numeroOv,
        cliente,
        localizacao,
        titulo: "Transportadora não definida",
        descricao:
          "A Nota Fiscal está disponível, mas nenhuma transportadora foi selecionada.",
        prioridade: "alta",
        categoria: "Operação",
        dataReferencia: coleta.data_nf,
      });
    }

    if (
      coleta.transportadora &&
      !coleta.data_envio_transportadora &&
      !dataEfetiva
    ) {
      alertas.push({
        id: `solicitacao-pendente-${coleta.id}`,
        coletaId: coleta.id,
        numeroOv,
        cliente,
        localizacao,
        titulo: "Solicitação ainda não enviada",
        descricao: `A transportadora ${coleta.transportadora} foi definida, mas a data de envio da solicitação não foi informada.`,
        prioridade: "alta",
        categoria: "Operação",
        dataReferencia: coleta.data_nf,
      });
    }

    if (
      diasParaPagamentoTransportadora !== null &&
      diasParaPagamentoTransportadora < 0 &&
      pagamentoTransportadora !== "pago" &&
      !coleta.data_pagamento_transportadora
    ) {
      const diasAtraso = Math.abs(
        diasParaPagamentoTransportadora,
      );

      alertas.push({
        id: `cte-vencido-${coleta.id}`,
        coletaId: coleta.id,
        numeroOv,
        cliente,
        localizacao,
        titulo: "CT-e vencido",
        descricao: `O pagamento da transportadora venceu em ${formatarData(
          coleta.vencimento_transportadora,
        )} e está atrasado há ${diasAtraso} ${
          diasAtraso === 1 ? "dia" : "dias"
        }.`,
        prioridade: "critica",
        categoria: "Transportadora",
        dataReferencia: coleta.vencimento_transportadora,
      });
    }

    if (
      diasParaPagamentoTransportadora !== null &&
      diasParaPagamentoTransportadora >= 0 &&
      diasParaPagamentoTransportadora <= 2 &&
      pagamentoTransportadora !== "pago" &&
      !coleta.data_pagamento_transportadora
    ) {
      alertas.push({
        id: `cte-vencendo-${coleta.id}`,
        coletaId: coleta.id,
        numeroOv,
        cliente,
        localizacao,
        titulo:
          diasParaPagamentoTransportadora === 0
            ? "CT-e vence hoje"
            : "CT-e próximo do vencimento",
        descricao: `Vencimento previsto para ${formatarData(
          coleta.vencimento_transportadora,
        )}.`,
        prioridade:
          diasParaPagamentoTransportadora === 0
            ? "alta"
            : "media",
        categoria: "Transportadora",
        dataReferencia: coleta.vencimento_transportadora,
      });
    }

    if (
      diasParaRecebimentoAds !== null &&
      diasParaRecebimentoAds < 0 &&
      recebimentoAds !== "paga" &&
      !coleta.data_recebimento_pagamento_ads
    ) {
      const diasAtraso = Math.abs(diasParaRecebimentoAds);

      alertas.push({
        id: `ads-vencida-${coleta.id}`,
        coletaId: coleta.id,
        numeroOv,
        cliente,
        localizacao,
        titulo: "Cobrança ADS vencida",
        descricao: `A cobrança venceu em ${formatarData(
          coleta.vencimento_nf_cobranca_ads,
        )} e está atrasada há ${diasAtraso} ${
          diasAtraso === 1 ? "dia" : "dias"
        }.`,
        prioridade: "critica",
        categoria: "Financeiro ADS",
        dataReferencia: coleta.vencimento_nf_cobranca_ads,
      });
    }

    if (
      diasParaRecebimentoAds !== null &&
      diasParaRecebimentoAds >= 0 &&
      diasParaRecebimentoAds <= 2 &&
      recebimentoAds !== "paga" &&
      !coleta.data_recebimento_pagamento_ads
    ) {
      alertas.push({
        id: `ads-vencendo-${coleta.id}`,
        coletaId: coleta.id,
        numeroOv,
        cliente,
        localizacao,
        titulo:
          diasParaRecebimentoAds === 0
            ? "Cobrança ADS vence hoje"
            : "Cobrança ADS próxima do vencimento",
        descricao: `Vencimento previsto para ${formatarData(
          coleta.vencimento_nf_cobranca_ads,
        )}.`,
        prioridade:
          diasParaRecebimentoAds === 0 ? "alta" : "media",
        categoria: "Financeiro ADS",
        dataReferencia: coleta.vencimento_nf_cobranca_ads,
      });
    }

    if (diasOperacao >= 7) {
      alertas.push({
        id: `operacao-longa-${coleta.id}`,
        coletaId: coleta.id,
        numeroOv,
        cliente,
        localizacao,
        titulo: "Operação aberta há muitos dias",
        descricao: `A coleta permanece aberta há ${diasOperacao} dias.`,
        prioridade: diasOperacao >= 15 ? "alta" : "media",
        categoria: "Operação",
        dataReferencia: coleta.data_solicitacao,
      });
    }
  });

  const ordemPrioridade: Record<Prioridade, number> = {
    critica: 1,
    alta: 2,
    media: 3,
    informativa: 4,
  };

  const ordemCategoria: Record<Alerta["categoria"], number> = {
    "Financeiro ADS": 1,
    Transportadora: 2,
    Operação: 3,
  };

  // Ordena todos os alertas pela urgência.
  // Em caso de mesma prioridade, prioriza a etapa mais avançada
  // do fluxo: Financeiro ADS -> Transportadora -> Operação.
  const alertasOrdenados = [...alertas].sort((a, b) => {
    const prioridade =
      ordemPrioridade[a.prioridade] -
      ordemPrioridade[b.prioridade];

    if (prioridade !== 0) {
      return prioridade;
    }

    const categoria =
      ordemCategoria[a.categoria] -
      ordemCategoria[b.categoria];

    if (categoria !== 0) {
      return categoria;
    }

    const dataA =
      criarDataLocal(a.dataReferencia)?.getTime() ?? 0;
    const dataB =
      criarDataLocal(b.dataReferencia)?.getTime() ?? 0;

    return dataA - dataB;
  });

  // Cada coleta aparece apenas uma vez na Central de Alertas.
  // Como a lista já está ordenada, mantemos somente o alerta
  // mais importante de cada coleta.
  const coletasJaIncluidas = new Set<number>();

  return alertasOrdenados.filter((alerta) => {
    if (coletasJaIncluidas.has(alerta.coletaId)) {
      return false;
    }

    coletasJaIncluidas.add(alerta.coletaId);
    return true;
  });
}

export default function CentralAlertas() {
  const [coletas, setColetas] = useState<Coleta[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [pesquisa, setPesquisa] = useState("");
  const [prioridadeFiltro, setPrioridadeFiltro] = useState<
    "todas" | Prioridade
  >("todas");
  const [pagina, setPagina] = useState(1);

  const ITENS_POR_PAGINA = 8;

  useEffect(() => {
    async function carregarColetas() {
      setCarregando(true);
      setErro("");

      const { data, error } = await supabase
        .from("coletas")
        .select(`
          id,
          numero_ov,
          cliente,
          loja,
          cidade,
          estado,
          data_solicitacao,
          data_nf,
          numero_nf,
          transportadora,
          data_envio_transportadora,
          data_prevista_coleta,
          data_efetiva_coleta,
          data_coleta,
          data_chegada_ads,
          status,
          conhecimento,
          vencimento_transportadora,
          status_pagamento_transportadora,
          data_pagamento_transportadora,
          vencimento_nf_cobranca_ads,
          status_recebimento_ads,
          data_recebimento_pagamento_ads
        `)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Erro ao carregar alertas:", error);
        setErro(
          "Não foi possível carregar a Central de Alertas.",
        );
        setCarregando(false);
        return;
      }

      setColetas((data ?? []) as Coleta[]);
      setCarregando(false);
    }

    carregarColetas();

    const canal = supabase
      .channel("central-alertas-global")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "coletas",
        },
        carregarColetas,
      )
      .subscribe();

    return () => {
      supabase.removeChannel(canal);
    };
  }, []);

  const alertas = useMemo(
    () => gerarAlertas(coletas),
    [coletas],
  );

  const contadores = useMemo(
    () => ({
      total: alertas.length,
      criticos: alertas.filter(
        (alerta) => alerta.prioridade === "critica",
      ).length,
      operacao: alertas.filter(
        (alerta) => alerta.categoria === "Operação",
      ).length,
      transportadora: alertas.filter(
        (alerta) => alerta.categoria === "Transportadora",
      ).length,
      financeiroAds: alertas.filter(
        (alerta) => alerta.categoria === "Financeiro ADS",
      ).length,
    }),
    [alertas],
  );

  const alertasFiltrados = useMemo(() => {
    const termo = pesquisa.trim().toLowerCase();

    return alertas.filter((alerta) => {
      const atendeFiltro =
        filtro === "todos" ||
        (filtro === "criticos" &&
          alerta.prioridade === "critica") ||
        (filtro === "operacao" &&
          alerta.categoria === "Operação") ||
        (filtro === "transportadora" &&
          alerta.categoria === "Transportadora") ||
        (filtro === "financeiroAds" &&
          alerta.categoria === "Financeiro ADS");

      if (!atendeFiltro) {
        return false;
      }

      if (
        prioridadeFiltro !== "todas" &&
        alerta.prioridade !== prioridadeFiltro
      ) {
        return false;
      }

      if (!termo) {
        return true;
      }

      const conteudo = [
        alerta.numeroOv,
        alerta.cliente,
        alerta.localizacao,
        alerta.titulo,
        alerta.descricao,
        alerta.categoria,
      ]
        .join(" ")
        .toLowerCase();

      return conteudo.includes(termo);
    });
  }, [
    alertas,
    filtro,
    pesquisa,
    prioridadeFiltro,
  ]);

  useEffect(() => {
    setPagina(1);
  }, [filtro, pesquisa, prioridadeFiltro]);

  const totalPaginas = Math.max(
    1,
    Math.ceil(
      alertasFiltrados.length / ITENS_POR_PAGINA,
    ),
  );

  const alertasPaginados = useMemo(() => {
    const inicio = (pagina - 1) * ITENS_POR_PAGINA;

    return alertasFiltrados.slice(
      inicio,
      inicio + ITENS_POR_PAGINA,
    );
  }, [alertasFiltrados, pagina]);

  function limparFiltros() {
    setFiltro("todos");
    setPrioridadeFiltro("todas");
    setPesquisa("");
    setPagina(1);
  }

  function atrasoDoAlerta(alerta: Alerta) {
    const titulo = normalizarTexto(alerta.titulo);

    if (
      !titulo.includes("vencid") &&
      !titulo.includes("atrasad")
    ) {
      return "—";
    }

    const dias = diferencaEmDias(alerta.dataReferencia);

    if (dias <= 0) {
      return "Hoje";
    }

    return `+${dias} ${dias === 1 ? "dia" : "dias"}`;
  }

  function classeCategoria(
    categoria: Alerta["categoria"],
  ) {
    if (categoria === "Financeiro ADS") {
      return "border-amber-200 bg-amber-50 text-amber-700";
    }

    if (categoria === "Transportadora") {
      return "border-violet-200 bg-violet-50 text-violet-700";
    }

    return "border-blue-200 bg-blue-50 text-blue-700";
  }

  const filtros = [
    {
      id: "todos" as Filtro,
      titulo: "Todos",
      valor: contadores.total,
      detalhe: "Pendências ativas",
      cor:
        "border-emerald-100 bg-emerald-50/60 text-emerald-900",
      bolinha: "bg-emerald-500",
    },
    {
      id: "criticos" as Filtro,
      titulo: "Críticos",
      valor: contadores.criticos,
      detalhe: "Atenção imediata",
      cor: "border-red-100 bg-red-50/60 text-red-900",
      bolinha: "bg-red-500",
    },
    {
      id: "operacao" as Filtro,
      titulo: "Operação",
      valor: contadores.operacao,
      detalhe: "Pendências operacionais",
      cor: "border-blue-100 bg-blue-50/60 text-blue-900",
      bolinha: "bg-blue-500",
    },
    {
      id: "transportadora" as Filtro,
      titulo: "Transportadoras",
      valor: contadores.transportadora,
      detalhe: "CT-es em acompanhamento",
      cor:
        "border-violet-100 bg-violet-50/60 text-violet-900",
      bolinha: "bg-violet-500",
    },
    {
      id: "financeiroAds" as Filtro,
      titulo: "Financeiro ADS",
      valor: contadores.financeiroAds,
      detalhe: "Cobranças em aberto",
      cor:
        "border-amber-100 bg-amber-50/60 text-amber-900",
      bolinha: "bg-amber-500",
    },
  ];

  const inicioExibicao =
    alertasFiltrados.length === 0
      ? 0
      : (pagina - 1) * ITENS_POR_PAGINA + 1;

  const fimExibicao = Math.min(
    pagina * ITENS_POR_PAGINA,
    alertasFiltrados.length,
  );

  return (
    <section className="space-y-5">
      {/* CABEÇALHO */}
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />

            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-700">
              Centro de inteligência operacional
            </p>
          </div>

          <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950">
            Central de Alertas
          </h2>

          <p className="mt-1.5 text-sm text-slate-500">
            Pendências operacionais e financeiras que exigem
            acompanhamento da equipe.
          </p>
        </div>

        <div className="relative w-full lg:w-[340px]">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>

          <input
            type="search"
            value={pesquisa}
            onChange={(evento) =>
              setPesquisa(evento.target.value)
            }
            placeholder="Pesquisar OV, cliente ou alerta..."
            className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-11 pr-4 text-sm text-slate-700 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10"
          />
        </div>
      </div>

      {/* INDICADORES */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {filtros.map((item) => {
          const ativo = filtro === item.id;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setFiltro(item.id)}
              className={[
                "group rounded-2xl border p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md",
                item.cor,
                ativo
                  ? "ring-2 ring-emerald-500 ring-offset-2"
                  : "",
              ].join(" ")}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`h-2 w-2 rounded-full ${item.bolinha}`}
                    />
                    <p className="text-xs font-bold text-slate-700">
                      {item.titulo}
                    </p>
                  </div>

                  <p className="mt-2 text-3xl font-black text-slate-900">
                    {carregando
                      ? "..."
                      : String(item.valor).padStart(2, "0")}
                  </p>

                  <p className="mt-1 text-[11px] font-medium text-slate-500">
                    {item.detalhe}
                  </p>
                </div>

                {ativo && (
                  <span className="rounded-full bg-white px-2 py-1 text-[10px] font-bold text-emerald-700 shadow-sm">
                    Ativo
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* PAINEL DE FILTROS + TABELA */}
      <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col justify-between gap-3 border-b border-slate-200 bg-slate-50/50 px-5 py-4 lg:flex-row lg:items-center">
          <div className="flex flex-col gap-3 sm:flex-row">
            <select
              value={filtro}
              onChange={(evento) =>
                setFiltro(evento.target.value as Filtro)
              }
              className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 outline-none transition focus:border-emerald-500"
            >
              <option value="todos">Todos os tipos</option>
              <option value="criticos">Somente críticos</option>
              <option value="operacao">Operação</option>
              <option value="transportadora">
                Transportadoras
              </option>
              <option value="financeiroAds">
                Financeiro ADS
              </option>
            </select>

            <select
              value={prioridadeFiltro}
              onChange={(evento) =>
                setPrioridadeFiltro(
                  evento.target.value as
                    | "todas"
                    | Prioridade,
                )
              }
              className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 outline-none transition focus:border-emerald-500"
            >
              <option value="todas">
                Todas as prioridades
              </option>
              <option value="critica">Crítica</option>
              <option value="alta">Alta</option>
              <option value="media">Média</option>
              <option value="informativa">
                Informativa
              </option>
            </select>
          </div>

          <button
            type="button"
            onClick={limparFiltros}
            className="w-fit text-xs font-bold text-slate-500 transition hover:text-slate-900"
          >
            Limpar filtros
          </button>
        </div>

        {erro && (
          <div className="m-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {erro}
          </div>
        )}

        {carregando && (
          <div className="px-5 py-16 text-center">
            <span className="mx-auto block h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-emerald-600" />
            <p className="mt-4 text-sm font-medium text-slate-500">
              Carregando alertas...
            </p>
          </div>
        )}

        {!carregando &&
          !erro &&
          alertasFiltrados.length === 0 && (
            <div className="px-5 py-16 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                ✓
              </div>

              <p className="mt-4 font-bold text-slate-800">
                Nenhum alerta encontrado
              </p>

              <p className="mt-1 text-sm text-slate-500">
                Não existem pendências correspondentes aos
                filtros selecionados.
              </p>
            </div>
          )}

        {!carregando &&
          !erro &&
          alertasFiltrados.length > 0 && (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1120px] text-left">
                  <thead className="border-b border-slate-200 bg-white">
                    <tr>
                      <th className="px-5 py-3.5 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                        Prioridade
                      </th>
                      <th className="px-5 py-3.5 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                        Tipo
                      </th>
                      <th className="px-5 py-3.5 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                        Alerta
                      </th>
                      <th className="px-5 py-3.5 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                        Referência
                      </th>
                      <th className="px-5 py-3.5 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                        Data
                      </th>
                      <th className="px-5 py-3.5 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                        Atraso
                      </th>
                      <th className="px-5 py-3.5 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                        Ações
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">
                    {alertasPaginados.map((alerta) => {
                      const visual =
                        configurarPrioridade(
                          alerta.prioridade,
                        );

                      const atraso =
                        atrasoDoAlerta(alerta);

                      return (
                        <tr
                          key={alerta.id}
                          className="transition hover:bg-slate-50/70"
                        >
                          <td className="whitespace-nowrap px-5 py-4">
                            <span
                              className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold ${visual.selo}`}
                            >
                              {visual.nome}
                            </span>
                          </td>

                          <td className="whitespace-nowrap px-5 py-4">
                            <span
                              className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-bold ${classeCategoria(
                                alerta.categoria,
                              )}`}
                            >
                              {alerta.categoria}
                            </span>
                          </td>

                          <td className="px-5 py-4">
                            <p className="text-sm font-bold text-slate-800">
                              {alerta.titulo}
                            </p>

                            <p className="mt-1 max-w-[320px] text-xs leading-5 text-slate-500">
                              {alerta.descricao}
                            </p>
                          </td>

                          <td className="px-5 py-4">
                            <p className="text-sm font-black text-slate-800">
                              {alerta.numeroOv}
                            </p>

                            <p className="mt-1 max-w-[270px] text-xs leading-5 text-slate-500">
                              {alerta.cliente}
                            </p>

                            <p className="mt-0.5 text-[11px] text-slate-400">
                              {alerta.localizacao}
                            </p>
                          </td>

                          <td className="whitespace-nowrap px-5 py-4 text-xs font-semibold text-slate-600">
                            {formatarData(
                              alerta.dataReferencia,
                            )}
                          </td>

                          <td className="whitespace-nowrap px-5 py-4">
                            <span
                              className={[
                                "text-xs font-black",
                                atraso !== "—"
                                  ? "text-red-600"
                                  : "text-slate-400",
                              ].join(" ")}
                            >
                              {atraso}
                            </span>
                          </td>

                          <td className="whitespace-nowrap px-5 py-4">
                            <Link
                              href={`/coletas/${alerta.coletaId}/editar`}
                              className="inline-flex rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] font-bold text-slate-700 shadow-sm transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700"
                            >
                              Abrir coleta
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-col justify-between gap-3 border-t border-slate-200 bg-slate-50/50 px-5 py-4 sm:flex-row sm:items-center">
                <p className="text-xs text-slate-500">
                  Mostrando{" "}
                  <span className="font-bold text-slate-700">
                    {inicioExibicao}
                  </span>{" "}
                  a{" "}
                  <span className="font-bold text-slate-700">
                    {fimExibicao}
                  </span>{" "}
                  de{" "}
                  <span className="font-bold text-slate-700">
                    {alertasFiltrados.length}
                  </span>{" "}
                  alerta(s)
                </p>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      setPagina((atual) =>
                        Math.max(1, atual - 1),
                      )
                    }
                    disabled={pagina === 1}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-sm font-bold text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    ‹
                  </button>

                  {Array.from(
                    { length: totalPaginas },
                    (_, indice) => indice + 1,
                  )
                    .filter(
                      (numero) =>
                        numero === 1 ||
                        numero === totalPaginas ||
                        Math.abs(numero - pagina) <= 1,
                    )
                    .map((numero, indice, lista) => {
                      const anterior =
                        lista[indice - 1];

                      return (
                        <div
                          key={numero}
                          className="flex items-center gap-1.5"
                        >
                          {anterior &&
                            numero - anterior > 1 && (
                              <span className="px-1 text-xs text-slate-400">
                                …
                              </span>
                            )}

                          <button
                            type="button"
                            onClick={() =>
                              setPagina(numero)
                            }
                            className={[
                              "flex h-8 min-w-8 items-center justify-center rounded-lg border px-2 text-xs font-bold transition",
                              pagina === numero
                                ? "border-slate-900 bg-slate-900 text-white"
                                : "border-slate-200 bg-white text-slate-600 hover:bg-slate-100",
                            ].join(" ")}
                          >
                            {numero}
                          </button>
                        </div>
                      );
                    })}

                  <button
                    type="button"
                    onClick={() =>
                      setPagina((atual) =>
                        Math.min(
                          totalPaginas,
                          atual + 1,
                        ),
                      )
                    }
                    disabled={pagina === totalPaginas}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-sm font-bold text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    ›
                  </button>
                </div>
              </div>
            </>
          )}
      </article>
    </section>
  );
}