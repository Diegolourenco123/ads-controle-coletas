"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type Coleta = {
  status: string | null;
  numero_nf: string | null;
  data_nf: string | null;
  data_envio_transportadora: string | null;
  data_efetiva_coleta: string | null;
  data_chegada_ads: string | null;
  conhecimento: string | null;

  status_pagamento_transportadora: string | null;
  vencimento_transportadora: string | null;

  numero_nf_cobranca_ads: string | null;
  data_emissao_nf_cobranca_ads: string | null;
  status_recebimento_ads: string | null;
  vencimento_nf_cobranca_ads: string | null;
};

type Indicadores = {
  operacao: {
    total: number;
    aguardandoNf: number;
    aguardandoColeta: number;
    coletaRealizada: number;
    recebidosAds: number;
  };

  transportadoras: {
    aguardandoPagamento: number;
    pagos: number;
    vencidos: number;
  };

  financeiroAds: {
    emitidas: number;
    aguardandoRecebimento: number;
    pagas: number;
    vencidas: number;
  };
};

const inicial: Indicadores = {
  operacao: {
    total: 0,
    aguardandoNf: 0,
    aguardandoColeta: 0,
    coletaRealizada: 0,
    recebidosAds: 0,
  },

  transportadoras: {
    aguardandoPagamento: 0,
    pagos: 0,
    vencidos: 0,
  },

  financeiroAds: {
    emitidas: 0,
    aguardandoRecebimento: 0,
    pagas: 0,
    vencidas: 0,
  },
};

function normalizarTexto(texto: string | null | undefined) {
  return (texto ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function dataVencida(data: string | null) {
  if (!data) {
    return false;
  }

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  const [ano, mes, dia] = data.split("-").map(Number);

  const vencimento = new Date(
    ano,
    mes - 1,
    dia,
  );

  vencimento.setHours(0, 0, 0, 0);

  return vencimento < hoje;
}

export default function DashboardCards() {
  const [indicadores, setIndicadores] =
    useState<Indicadores>(inicial);

  const [carregando, setCarregando] =
    useState(true);

  const [erro, setErro] = useState("");

  useEffect(() => {
    async function carregarIndicadores() {
      setCarregando(true);
      setErro("");

      const { data, error } = await supabase
        .from("coletas")
        .select(`
          status,
          numero_nf,
          data_nf,
          data_envio_transportadora,
          data_efetiva_coleta,
          data_chegada_ads,
          conhecimento,
          status_pagamento_transportadora,
          vencimento_transportadora,
          numero_nf_cobranca_ads,
          data_emissao_nf_cobranca_ads,
          status_recebimento_ads,
          vencimento_nf_cobranca_ads
        `);

      if (error) {
        console.error(
          "Erro ao carregar indicadores:",
          error,
        );

        setErro(
          "Não foi possível carregar os indicadores.",
        );

        setCarregando(false);

        return;
      }

      const registros = (data ?? []) as Coleta[];

      const novosIndicadores =
        registros.reduce<Indicadores>(
          (acumulador, coleta) => {
            acumulador.operacao.total += 1;

            const statusOperacional =
              normalizarTexto(
                coleta.status,
              );

            // -------------------------
            // OPERAÇÃO
            // Fonte principal: status salvo da coleta
            // -------------------------

            if (
              statusOperacional ===
              "aguardando nf"
            ) {
              acumulador.operacao.aguardandoNf += 1;
            }

            if (
              statusOperacional ===
              "aguardando coleta"
            ) {
              acumulador.operacao.aguardandoColeta += 1;
            }

            if (
              statusOperacional ===
              "coleta realizada"
            ) {
              acumulador.operacao.coletaRealizada += 1;
            }

            if (
              statusOperacional ===
                "recebido na ads" ||
              statusOperacional ===
                "finalizado"
            ) {
              acumulador.operacao.recebidosAds += 1;
            }

            // -------------------------
            // FINANCEIRO TRANSPORTADORA
            // -------------------------

            const statusTransportadora =
              normalizarTexto(
                coleta.status_pagamento_transportadora,
              );

            const pagamentoTransportadoraConcluido =
              statusTransportadora === "pago";

            const pagamentoTransportadoraVencido =
              !pagamentoTransportadoraConcluido &&
              dataVencida(
                coleta.vencimento_transportadora,
              );

            const possuiCobrancaTransportadora =
              Boolean(coleta.conhecimento) ||
              Boolean(
                coleta.vencimento_transportadora,
              ) ||
              statusTransportadora ===
                "aguardando pagamento" ||
              statusTransportadora === "vencido";

            if (
              pagamentoTransportadoraConcluido
            ) {
              acumulador.transportadoras.pagos += 1;
            } else if (
              pagamentoTransportadoraVencido
            ) {
              acumulador.transportadoras.vencidos += 1;
            } else if (
              possuiCobrancaTransportadora
            ) {
              acumulador.transportadoras
                .aguardandoPagamento += 1;
            }

            // -------------------------
            // FINANCEIRO ADS
            // -------------------------

            const statusAds =
              normalizarTexto(
                coleta.status_recebimento_ads,
              );

            const nfAdsEmitida =
              Boolean(
                coleta.numero_nf_cobranca_ads,
              ) ||
              Boolean(
                coleta.data_emissao_nf_cobranca_ads,
              ) ||
              statusAds === "emitida" ||
              statusAds ===
                "aguardando recebimento" ||
              statusAds === "paga" ||
              statusAds === "vencida";

            const nfAdsPaga =
              statusAds === "paga";

            const nfAdsVencida =
              !nfAdsPaga &&
              dataVencida(
                coleta.vencimento_nf_cobranca_ads,
              );

            if (nfAdsEmitida) {
              acumulador.financeiroAds.emitidas += 1;
            }

            if (nfAdsPaga) {
              acumulador.financeiroAds.pagas += 1;
            } else if (nfAdsVencida) {
              acumulador.financeiroAds.vencidas += 1;
            } else if (
              nfAdsEmitida &&
              statusAds !== "cancelada"
            ) {
              acumulador.financeiroAds
                .aguardandoRecebimento += 1;
            }

            return acumulador;
          },
          {
            operacao: {
              ...inicial.operacao,
            },
            transportadoras: {
              ...inicial.transportadoras,
            },
            financeiroAds: {
              ...inicial.financeiroAds,
            },
          },
        );

      setIndicadores(novosIndicadores);
      setCarregando(false);
    }

    carregarIndicadores();

    const canal = supabase
      .channel("dashboard-executivo")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "coletas",
        },
        carregarIndicadores,
      )
      .subscribe();

    return () => {
      supabase.removeChannel(canal);
    };
  }, []);

  // =========================================================
  // CARDS DA OPERAÇÃO
  // =========================================================

  const operacao = [
    {
      titulo: "Total de coletas",
      valor: indicadores.operacao.total,
      detalhe: "Registros no sistema",
      borda: "border-slate-200",
      fundo: "bg-white",
      texto: "text-slate-900",
      faixa: "bg-slate-500",
      filtro: "total",
    },

    {
      titulo: "Aguardando NF",
      valor: indicadores.operacao.aguardandoNf,
      detalhe: "Nota fiscal pendente",
      borda: "border-amber-200",
      fundo: "bg-amber-50",
      texto: "text-amber-900",
      faixa: "bg-amber-500",
      filtro: "aguardando-nf",
    },

    {
      titulo: "Aguardando coleta",
      valor: indicadores.operacao.aguardandoColeta,
      detalhe: "Transportadora ainda não coletou",
      borda: "border-orange-200",
      fundo: "bg-orange-50",
      texto: "text-orange-900",
      faixa: "bg-orange-500",
      filtro: "aguardando-coleta",
    },

    {
      titulo: "Coleta realizada",
      valor: indicadores.operacao.coletaRealizada,
      detalhe: "Aguardando recebimento na ADS",
      borda: "border-blue-200",
      fundo: "bg-blue-50",
      texto: "text-blue-900",
      faixa: "bg-blue-500",
      filtro: "coleta-realizada",
    },

    {
      titulo: "Resíduos recebidos na ADS",
      valor: indicadores.operacao.recebidosAds,
      detalhe: "Entregas confirmadas",
      borda: "border-emerald-200",
      fundo: "bg-emerald-50",
      texto: "text-emerald-900",
      faixa: "bg-emerald-500",
      filtro: "recebidos-ads",
    },
  ];

  // =========================================================
  // CARDS FINANCEIRO — TRANSPORTADORAS
  // =========================================================

  const transportadoras = [
    {
      titulo: "CT-es aguardando pagamento",
      filtro: "cte-aguardando-pagamento",
      valor:
        indicadores.transportadoras
          .aguardandoPagamento,
      detalhe: "Cobranças pendentes",

      borda: "border-orange-200",
      fundo: "bg-orange-50",
      texto: "text-orange-900",
      faixa: "bg-orange-500",
    },

    {
      titulo: "CT-es pagos",
      filtro: "cte-pagos",
      valor: indicadores.transportadoras.pagos,
      detalhe: "Pagamentos concluídos",

      borda: "border-emerald-200",
      fundo: "bg-emerald-50",
      texto: "text-emerald-900",
      faixa: "bg-emerald-500",
    },

    {
      titulo: "CT-es vencidos",
      filtro: "cte-vencidos",
      valor: indicadores.transportadoras.vencidos,
      detalhe: "Necessitam de atenção",

      borda: "border-red-200",
      fundo: "bg-red-50",
      texto: "text-red-900",
      faixa: "bg-red-500",
    },
  ];

  // =========================================================
  // CARDS FINANCEIRO — ADS
  // =========================================================

  const financeiroAds = [
    {
      titulo: "NFs de cobrança emitidas",
      filtro: "nf-ads-emitidas",
      valor: indicadores.financeiroAds.emitidas,
      detalhe: "Cobranças geradas pela ADS",

      borda: "border-blue-200",
      fundo: "bg-blue-50",
      texto: "text-blue-900",
      faixa: "bg-blue-500",
    },

    {
      titulo: "Aguardando recebimento",
      filtro: "nf-ads-aguardando",
      valor:
        indicadores.financeiroAds
          .aguardandoRecebimento,
      detalhe: "Pagamentos pendentes",

      borda: "border-orange-200",
      fundo: "bg-orange-50",
      texto: "text-orange-900",
      faixa: "bg-orange-500",
    },

    {
      titulo: "NFs pagas",
      filtro: "nf-ads-pagas",
      valor: indicadores.financeiroAds.pagas,
      detalhe: "Recebimentos concluídos",

      borda: "border-emerald-200",
      fundo: "bg-emerald-50",
      texto: "text-emerald-900",
      faixa: "bg-emerald-500",
    },

    {
      titulo: "NFs vencidas",
      filtro: "nf-ads-vencidas",
      valor: indicadores.financeiroAds.vencidas,
      detalhe: "Cobranças em atraso",

      borda: "border-red-200",
      fundo: "bg-red-50",
      texto: "text-red-900",
      faixa: "bg-red-500",
    },
  ];

  function renderizarCards(
    cards: {
      titulo: string;
      filtro: string;
      valor: number;
      detalhe: string;
      borda: string;
      fundo: string;
      texto: string;
      faixa: string;
    }[],
    colunas: string,
  ) {
    return (
      <div className={`grid gap-4 ${colunas}`}>
        {cards.map((card) => (
          <Link
            key={card.titulo}
            href={`/coletas?indicador=${encodeURIComponent(card.filtro)}`}
            title={`Ver coletas: ${card.titulo}`}
            className={`group relative block overflow-hidden rounded-2xl border p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 ${card.borda} ${card.fundo}`}
          >
            <div
              className={`absolute bottom-0 left-0 top-0 w-1.5 ${card.faixa}`}
            />

            <div className="pl-2">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-semibold text-slate-600">
                  {card.titulo}
                </p>

                <span className="text-xs font-bold text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-slate-600">
                  Ver →
                </span>
              </div>

              <p
                className={`mt-2 text-3xl font-bold ${card.texto}`}
              >
                {carregando
                  ? "..."
                  : String(card.valor).padStart(
                      2,
                      "0",
                    )}
              </p>

              <p className="mt-1 text-xs text-slate-500">
                {card.detalhe}
              </p>
            </div>
          </Link>
        ))}
      </div>
    );
  }

  return (
    <section className="space-y-7">
      {erro && (
        <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">
          {erro}
        </p>
      )}

      {/* OPERAÇÃO */}

      <div>
        <div className="mb-4">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">
            Operação
          </p>

          <h3 className="mt-1 text-lg font-bold text-slate-900">
            Acompanhamento das coletas
          </h3>
        </div>

        {renderizarCards(
          operacao,
          "sm:grid-cols-2 xl:grid-cols-5",
        )}
      </div>

      {/* FINANCEIRO TRANSPORTADORAS */}

      <div>
        <div className="mb-4">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-700">
            Financeiro — Transportadoras
          </p>

          <h3 className="mt-1 text-lg font-bold text-slate-900">
            Pagamentos de fretes e CT-es
          </h3>
        </div>

        {renderizarCards(
          transportadoras,
          "sm:grid-cols-2 xl:grid-cols-3",
        )}
      </div>

      {/* FINANCEIRO ADS */}

      <div>
        <div className="mb-4">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-700">
            Financeiro — ADS
          </p>

          <h3 className="mt-1 text-lg font-bold text-slate-900">
            Cobranças emitidas aos clientes
          </h3>
        </div>

        {renderizarCards(
          financeiroAds,
          "sm:grid-cols-2 xl:grid-cols-4",
        )}
      </div>
    </section>
  );
}