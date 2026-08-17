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
  }, [alertas, filtro, pesquisa]);

  const filtros = [
    {
      id: "todos" as Filtro,
      titulo: "Todos",
      valor: contadores.total,
    },
    {
      id: "criticos" as Filtro,
      titulo: "Críticos",
      valor: contadores.criticos,
    },
    {
      id: "operacao" as Filtro,
      titulo: "Operação",
      valor: contadores.operacao,
    },
    {
      id: "transportadora" as Filtro,
      titulo: "Transportadoras",
      valor: contadores.transportadora,
    },
    {
      id: "financeiroAds" as Filtro,
      titulo: "Financeiro ADS",
      valor: contadores.financeiroAds,
    },
  ];

  return (
    <section className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-red-600">
              Centro de inteligência operacional
            </p>

            <h2 className="mt-2 text-3xl font-black text-slate-900">
              Central de Alertas
            </h2>

            <p className="mt-2 max-w-2xl text-sm text-slate-500">
              Pendências operacionais e financeiras que exigem
              acompanhamento da equipe.
            </p>
          </div>

          <input
            type="search"
            value={pesquisa}
            onChange={(evento) =>
              setPesquisa(evento.target.value)
            }
            placeholder="Pesquisar OV, cliente ou alerta..."
            className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-emerald-600 lg:w-80"
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {filtros.map((item) => {
          const ativo = filtro === item.id;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setFiltro(item.id)}
              className={[
                "rounded-2xl border p-4 text-left shadow-sm transition",
                ativo
                  ? "border-emerald-600 bg-emerald-600 text-white"
                  : "border-slate-200 bg-white text-slate-700 hover:border-emerald-300",
              ].join(" ")}
            >
              <p className="text-sm font-semibold">
                {item.titulo}
              </p>

              <p className="mt-2 text-3xl font-black">
                {carregando
                  ? "..."
                  : String(item.valor).padStart(2, "0")}
              </p>
            </button>
          );
        })}
      </div>

      {erro && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm font-medium text-red-700">
          {erro}
        </div>
      )}

      {carregando && (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500 shadow-sm">
          Carregando alertas...
        </div>
      )}

      {!carregando &&
        !erro &&
        alertasFiltrados.length === 0 && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-8 text-center shadow-sm">
            <p className="text-lg font-bold text-emerald-800">
              Nenhum alerta encontrado
            </p>

            <p className="mt-2 text-sm text-emerald-700">
              Não existem pendências correspondentes ao filtro
              selecionado.
            </p>
          </div>
        )}

      {!carregando &&
        !erro &&
        alertasFiltrados.length > 0 && (
          <div className="grid gap-4 xl:grid-cols-2">
            {alertasFiltrados.map((alerta) => {
              const visual = configurarPrioridade(
                alerta.prioridade,
              );

              return (
                <article
                  key={alerta.id}
                  className={`relative overflow-hidden rounded-2xl border p-5 shadow-sm ${visual.card}`}
                >
                  <div
                    className={`absolute bottom-0 left-0 top-0 w-1.5 ${visual.faixa}`}
                  />

                  <div className="pl-3">
                    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-bold ${visual.selo}`}
                          >
                            {visual.nome}
                          </span>

                          <span className="rounded-full bg-white/70 px-3 py-1 text-xs font-semibold text-slate-600">
                            {alerta.categoria}
                          </span>
                        </div>

                        <h3
                          className={`mt-3 text-lg font-bold ${visual.titulo}`}
                        >
                          {alerta.titulo}
                        </h3>
                      </div>

                      <div
                        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-black ${visual.circulo}`}
                      >
                        !
                      </div>
                    </div>

                    <p className="mt-3 text-sm leading-6 text-slate-700">
                      {alerta.descricao}
                    </p>

                    <div className="mt-4 rounded-xl border border-white/70 bg-white/60 p-4">
                      <p className="font-bold text-slate-900">
                        {alerta.numeroOv}
                      </p>

                      <p className="mt-1 text-sm font-medium text-slate-700">
                        {alerta.cliente}
                      </p>

                      <p className="mt-1 text-xs text-slate-500">
                        {alerta.localizacao}
                      </p>
                    </div>

                    <div className="mt-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                      <p className="text-xs font-semibold text-slate-500">
                        Referência:{" "}
                        {formatarData(alerta.dataReferencia)}
                      </p>

                      <Link
                        href={`/coletas/${alerta.coletaId}/editar`}
                        className="rounded-xl bg-slate-900 px-4 py-2.5 text-center text-xs font-bold text-white transition hover:bg-slate-700"
                      >
                        Abrir coleta
                      </Link>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
    </section>
  );
}