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
  numero_nf: string | null;
  data_nf: string | null;
  transportadora: string | null;
  data_envio_transportadora: string | null;
  data_coleta: string | null;
  data_efetiva_coleta: string | null;
  data_chegada_ads: string | null;
  data_prevista_coleta: string | null;
  conhecimento: string | null;
  status: string | null;
  status_pagamento_transportadora: string | null;
  vencimento_transportadora: string | null;
  numero_nf_cobranca_ads: string | null;
  data_emissao_nf_cobranca_ads: string | null;
  status_recebimento_ads: string | null;
  vencimento_nf_cobranca_ads: string | null;
  created_at: string | null;
};

function normalizarTexto(texto: string | null | undefined) {
  return (texto ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function dataVencida(data: string | null) {
  if (!data) return false;

  const [ano, mes, dia] = data.split("-").map(Number);

  if (!ano || !mes || !dia) return false;

  const vencimento = new Date(ano, mes - 1, dia);
  vencimento.setHours(0, 0, 0, 0);

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  return vencimento < hoje;
}

function classeStatus(status: string | null) {
  if (status === "Em transporte" || status === "Coleta realizada") {
    return "bg-blue-100 text-blue-700";
  }

  if (status === "Aguardando NF") {
    return "bg-amber-100 text-amber-700";
  }

  if (status === "Aguardando coleta") {
    return "bg-orange-100 text-orange-700";
  }

  if (status === "Finalizado" || status === "Recebido na ADS") {
    return "bg-emerald-100 text-emerald-700";
  }

  return "bg-violet-100 text-violet-700";
}

function formatarData(data: string | null) {
  if (!data) return "—";

  const [ano, mes, dia] = data.split("-");

  if (!ano || !mes || !dia) return data;

  return `${dia}/${mes}/${ano}`;
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

export default function ColetasTable() {
  const [indicador, setIndicador] = useState("");

  const [coletas, setColetas] = useState<Coleta[]>([]);
  const [pesquisa, setPesquisa] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [excluindoId, setExcluindoId] = useState<number | null>(null);

  useEffect(() => {
    const parametros = new URLSearchParams(window.location.search);

    setIndicador(parametros.get("indicador") ?? "");
  }, []);

  useEffect(() => {
    async function carregarColetas() {
      setCarregando(true);
      setErro("");

      const { data, error } = await supabase
        .from("coletas")
        .select(
          "id, numero_ov, cliente, loja, cidade, estado, numero_nf, data_nf, transportadora, data_envio_transportadora, data_coleta, data_efetiva_coleta, data_chegada_ads, data_prevista_coleta, conhecimento, status, status_pagamento_transportadora, vencimento_transportadora, numero_nf_cobranca_ads, data_emissao_nf_cobranca_ads, status_recebimento_ads, vencimento_nf_cobranca_ads, created_at",
        )
        .order("created_at", { ascending: false });

      if (error) {
        console.error(error);
        setErro("Não foi possível carregar as coletas.");
        setCarregando(false);
        return;
      }

      setColetas((data ?? []) as Coleta[]);
      setCarregando(false);
    }

    carregarColetas();
  }, []);

  async function excluirColeta(coleta: Coleta) {
    const identificacao =
      coleta.numero_ov ||
      coleta.loja ||
      `#${coleta.id}`;

    const confirmou = window.confirm(
      `Tem certeza que deseja excluir a coleta ${identificacao}?\n\nEsta ação não poderá ser desfeita.`,
    );

    if (!confirmou) return;

    setErro("");
    setExcluindoId(coleta.id);

    const { error } = await supabase
      .from("coletas")
      .delete()
      .eq("id", coleta.id);

    if (error) {
      console.error("Erro ao excluir coleta:", error);
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

  function pertenceAoIndicador(coleta: Coleta) {
    if (!indicador || indicador === "total") {
      return true;
    }

    const statusOperacional =
      normalizarTexto(
        coleta.status,
      );

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
      Boolean(coleta.vencimento_transportadora) ||
      statusTransportadora ===
        "aguardando pagamento" ||
      statusTransportadora === "vencido";

    const statusAds =
      normalizarTexto(
        coleta.status_recebimento_ads,
      );

    const nfAdsEmitida =
      Boolean(coleta.numero_nf_cobranca_ads) ||
      Boolean(
        coleta.data_emissao_nf_cobranca_ads,
      ) ||
      statusAds === "emitida" ||
      statusAds === "aguardando recebimento" ||
      statusAds === "paga" ||
      statusAds === "vencida";

    const nfAdsPaga =
      statusAds === "paga";

    const nfAdsVencida =
      !nfAdsPaga &&
      dataVencida(
        coleta.vencimento_nf_cobranca_ads,
      );

    switch (indicador) {
      case "aguardando-nf":
        return (
          statusOperacional ===
          "aguardando nf"
        );

      case "aguardando-coleta":
        return (
          statusOperacional ===
          "aguardando coleta"
        );

      case "coleta-realizada":
        return (
          statusOperacional ===
          "coleta realizada"
        );

      case "recebidos-ads":
        return (
          statusOperacional ===
            "recebido na ads" ||
          statusOperacional ===
            "finalizado"
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

  const coletasFiltradas = useMemo(() => {
    const termo = pesquisa
      .trim()
      .toLowerCase();

    return coletas.filter((coleta) => {
      if (!pertenceAoIndicador(coleta)) {
        return false;
      }

      if (!termo) {
        return true;
      }

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
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return conteudo.includes(termo);
    });
  }, [coletas, pesquisa, indicador]);

  const tituloFiltro =
    nomesIndicadores[indicador] ??
    "Coletas recentes";

  return (
    <article className="mt-7 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col justify-between gap-4 border-b border-slate-200 p-5 md:flex-row md:items-center">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-bold">
              {indicador
                ? tituloFiltro
                : "Coletas recentes"}
            </h3>

            {indicador && (
              <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-bold text-emerald-700">
                {coletasFiltradas.length} registros
              </span>
            )}
          </div>

          <p className="mt-1 text-sm text-slate-500">
            {indicador
              ? "Lista filtrada pelo indicador selecionado no painel."
              : "Dados reais cadastrados no Supabase"}
          </p>

          {indicador && (
            <Link
              href="/coletas"
              className="mt-2 inline-flex text-xs font-semibold text-blue-600 hover:text-blue-700"
            >
              ← Limpar filtro e ver todas
            </Link>
          )}
        </div>

        <input
          type="search"
          value={pesquisa}
          onChange={(evento) =>
            setPesquisa(evento.target.value)
          }
          placeholder="Pesquisar OV, NF, cliente ou unidade..."
          className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm outline-none focus:border-emerald-600 md:w-80"
        />
      </div>

      {erro && (
        <p className="m-5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {erro}
        </p>
      )}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[1050px] text-left">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-5 py-4">OV</th>
              <th className="px-5 py-4">
                Cliente / Unidade
              </th>
              <th className="px-5 py-4">
                Nota fiscal
              </th>
              <th className="px-5 py-4">
                Transportadora
              </th>
              <th className="px-5 py-4">
                Data da coleta
              </th>
              <th className="px-5 py-4">
                Status
              </th>
              <th className="px-5 py-4">
                Ações
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100 text-sm">
            {carregando && (
              <tr>
                <td
                  className="px-5 py-8 text-center text-slate-500"
                  colSpan={7}
                >
                  Carregando coletas...
                </td>
              </tr>
            )}

            {!carregando &&
              coletasFiltradas.length === 0 && (
                <tr>
                  <td
                    className="px-5 py-8 text-center text-slate-500"
                    colSpan={7}
                  >
                    Nenhuma coleta encontrada para
                    este indicador.
                  </td>
                </tr>
              )}

            {!carregando &&
              coletasFiltradas.map((coleta) => (
                <tr
                  key={coleta.id}
                  className="transition hover:bg-slate-50"
                >
                  <td className="px-5 py-4 font-semibold text-emerald-700">
                    {coleta.numero_ov ||
                      `#${coleta.id}`}
                  </td>

                  <td className="px-5 py-4">
                    <p className="font-medium">
                      {coleta.cliente ||
                        "Cliente não informado"}
                    </p>

                    <p className="text-xs text-slate-500">
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

                  <td className="px-5 py-4">
                    {coleta.numero_nf ||
                      "Aguardando"}
                  </td>

                  <td className="px-5 py-4">
                    {coleta.transportadora ||
                      "Não definida"}
                  </td>

                  <td className="px-5 py-4">
                    {formatarData(
                      coleta.data_efetiva_coleta ||
                        coleta.data_coleta ||
                        coleta.data_prevista_coleta,
                    )}
                  </td>

                  <td className="px-5 py-4">
                    <span
                      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${classeStatus(
                        coleta.status,
                      )}`}
                    >
                      {coleta.status ||
                        "Sem status"}
                    </span>
                  </td>

                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/coletas/${coleta.id}/editar`}
                        className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-blue-700"
                      >
                        Editar
                      </Link>

                      <button
                        type="button"
                        onClick={() =>
                          excluirColeta(coleta)
                        }
                        disabled={
                          excluindoId === coleta.id
                        }
                        className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {excluindoId === coleta.id
                          ? "Excluindo..."
                          : "Excluir"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </article>
  );
}