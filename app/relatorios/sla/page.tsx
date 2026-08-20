"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import Header from "../../components/Header";
import Sidebar from "../../components/Sidebar";
import { supabase } from "../../lib/supabase";

type Coleta = {
  id: number;
  data_solicitacao: string | null;
  numero_ov: string | null;
  cliente: string | null;
  loja: string | null;
  cidade: string | null;
  estado: string | null;
  numero_nf: string | null;
  transportadora: string | null;
  data_coleta: string | null;
  data_chegada_ads: string | null;
  data_emissao_nf_cobranca_ads: string | null;
};

type ColetaSla = Coleta & {
  slaSolicitacaoColeta: number | null;
  slaColetaAds: number | null;
  slaAdsNf: number | null;
  slaCicloTotal: number | null;
};

function formatarData(data: string | null) {
  if (!data) return "—";

  const valor = data.includes("T") ? data.split("T")[0] : data;
  const [ano, mes, dia] = valor.split("-");

  return ano && mes && dia ? `${dia}/${mes}/${ano}` : data;
}

function diasEntreDatas(dataInicial: string | null, dataFinal: string | null) {
  if (!dataInicial || !dataFinal) return null;

  const inicioTexto = dataInicial.includes("T")
    ? dataInicial.split("T")[0]
    : dataInicial;

  const fimTexto = dataFinal.includes("T")
    ? dataFinal.split("T")[0]
    : dataFinal;

  const [anoInicio, mesInicio, diaInicio] = inicioTexto.split("-").map(Number);
  const [anoFim, mesFim, diaFim] = fimTexto.split("-").map(Number);

  if (
    !anoInicio ||
    !mesInicio ||
    !diaInicio ||
    !anoFim ||
    !mesFim ||
    !diaFim
  ) {
    return null;
  }

  const inicio = Date.UTC(anoInicio, mesInicio - 1, diaInicio);
  const fim = Date.UTC(anoFim, mesFim - 1, diaFim);
  const diferenca = Math.round((fim - inicio) / 86_400_000);

  return diferenca >= 0 ? diferenca : null;
}

function classePrazo(dias: number | null, tipo: "curto" | "transporte" | "ciclo") {
  if (dias === null) return "bg-slate-100 text-slate-500";

  if (tipo === "curto") {
    if (dias <= 2) return "bg-emerald-50 text-emerald-700";
    if (dias <= 5) return "bg-amber-50 text-amber-700";
    return "bg-red-50 text-red-700";
  }

  if (tipo === "transporte") {
    if (dias <= 7) return "bg-emerald-50 text-emerald-700";
    if (dias <= 15) return "bg-amber-50 text-amber-700";
    return "bg-red-50 text-red-700";
  }

  if (dias <= 10) return "bg-emerald-50 text-emerald-700";
  if (dias <= 20) return "bg-amber-50 text-amber-700";
  return "bg-red-50 text-red-700";
}

function TextoPrazo({
  dias,
  tipo,
}: {
  dias: number | null;
  tipo: "curto" | "transporte" | "ciclo";
}) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-black ${classePrazo(
        dias,
        tipo,
      )}`}
    >
      {dias === null ? "—" : `${dias} dias`}
    </span>
  );
}

export default function SlaPorColetaPage() {
  const [coletas, setColetas] = useState<Coleta[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  const [pesquisa, setPesquisa] = useState("");
  const [transportadora, setTransportadora] = useState("");
  const [estado, setEstado] = useState("");
  const [ordenacao, setOrdenacao] = useState("ciclo_desc");

  useEffect(() => {
    async function carregar() {
      setCarregando(true);
      setErro("");

      const { data, error } = await supabase
        .from("coletas")
        .select(
          "id, data_solicitacao, numero_ov, cliente, loja, cidade, estado, numero_nf, transportadora, data_coleta, data_chegada_ads, data_emissao_nf_cobranca_ads",
        )
        .gte("data_solicitacao", "2026-01-01")
        .lte("data_solicitacao", "2026-12-31")
        .order("data_solicitacao", { ascending: false });

      if (error) {
        console.error(error);
        setErro(`Não foi possível carregar os SLAs: ${error.message}`);
        setColetas([]);
      } else {
        setColetas((data ?? []) as Coleta[]);
      }

      setCarregando(false);
    }

    carregar();

    const canal = supabase
      .channel("sla-por-coleta-2026")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "coletas",
        },
        carregar,
      )
      .subscribe();

    return () => {
      supabase.removeChannel(canal);
    };
  }, []);

  const transportadoras = useMemo(
    () =>
      Array.from(
        new Set(coletas.map((item) => item.transportadora).filter(Boolean)),
      )
        .map(String)
        .sort((a, b) => a.localeCompare(b, "pt-BR")),
    [coletas],
  );

  const estados = useMemo(
    () =>
      Array.from(new Set(coletas.map((item) => item.estado).filter(Boolean)))
        .map(String)
        .sort(),
    [coletas],
  );

  const baseSla = useMemo<ColetaSla[]>(() => {
    return coletas.map((coleta) => ({
      ...coleta,
      slaSolicitacaoColeta: diasEntreDatas(
        coleta.data_solicitacao,
        coleta.data_coleta,
      ),
      slaColetaAds: diasEntreDatas(
        coleta.data_coleta,
        coleta.data_chegada_ads,
      ),
      slaAdsNf: diasEntreDatas(
        coleta.data_chegada_ads,
        coleta.data_emissao_nf_cobranca_ads,
      ),
      slaCicloTotal: diasEntreDatas(
        coleta.data_solicitacao,
        coleta.data_chegada_ads,
      ),
    }));
  }, [coletas]);

  const coletasFiltradas = useMemo(() => {
    const termo = pesquisa.trim().toLowerCase();

    return [...baseSla]
      .filter((coleta) => {
        const texto = [
          coleta.loja,
          coleta.numero_ov,
          coleta.cidade,
          coleta.estado,
          coleta.numero_nf,
          coleta.transportadora,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return (
          (!termo || texto.includes(termo)) &&
          (!transportadora || coleta.transportadora === transportadora) &&
          (!estado || coleta.estado === estado)
        );
      })
      .sort((a, b) => {
        const valor = (
          coleta: ColetaSla,
          campo:
            | "slaSolicitacaoColeta"
            | "slaColetaAds"
            | "slaAdsNf"
            | "slaCicloTotal",
        ) => coleta[campo] ?? -1;

        if (ordenacao === "solicitacao_desc") {
          return (
            valor(b, "slaSolicitacaoColeta") -
            valor(a, "slaSolicitacaoColeta")
          );
        }

        if (ordenacao === "transporte_desc") {
          return valor(b, "slaColetaAds") - valor(a, "slaColetaAds");
        }

        if (ordenacao === "nf_desc") {
          return valor(b, "slaAdsNf") - valor(a, "slaAdsNf");
        }

        if (ordenacao === "loja_asc") {
          return (a.loja ?? "").localeCompare(b.loja ?? "", "pt-BR");
        }

        return valor(b, "slaCicloTotal") - valor(a, "slaCicloTotal");
      });
  }, [baseSla, pesquisa, transportadora, estado, ordenacao]);

  const indicadores = useMemo(() => {
    function resumo(campo: keyof Pick<
      ColetaSla,
      | "slaSolicitacaoColeta"
      | "slaColetaAds"
      | "slaAdsNf"
      | "slaCicloTotal"
    >) {
      const valores = baseSla
        .map((item) => item[campo])
        .filter((valor): valor is number => valor !== null);

      if (valores.length === 0) {
        return { media: 0, maior: 0, registros: 0 };
      }

      return {
        media: valores.reduce((soma, valor) => soma + valor, 0) / valores.length,
        maior: Math.max(...valores),
        registros: valores.length,
      };
    }

    return {
      solicitacao: resumo("slaSolicitacaoColeta"),
      transporte: resumo("slaColetaAds"),
      faturamento: resumo("slaAdsNf"),
      ciclo: resumo("slaCicloTotal"),
    };
  }, [baseSla]);

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <Header />

      <div className="mx-auto grid max-w-[1500px] grid-cols-1 lg:grid-cols-[230px_1fr]">
        <Sidebar />

        <section className="min-w-0 p-5 md:p-8">
          <div className="mb-6 rounded-3xl bg-slate-950 p-6 text-white shadow-sm lg:p-8">
            <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-blue-400">
                  Eficiência operacional • 2026
                </p>

                <h1 className="mt-2 text-2xl font-black tracking-tight lg:text-3xl">
                  SLA por coleta
                </h1>

                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
                  Detalhamento individual dos tempos entre as principais etapas
                  da operação. Use esta tela para identificar quais coletas estão
                  elevando as médias dos indicadores de SLA.
                </p>
              </div>

              <Link
                href="/relatorios"
                className="inline-flex shrink-0 items-center justify-center gap-2 self-start rounded-xl border border-white/15 bg-white/10 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-white/20"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-4 w-4"
                  aria-hidden="true"
                >
                  <path d="m15 18-6-6 6-6" />
                </svg>
                Voltar para Relatórios
              </Link>
            </div>
          </div>

          {erro && (
            <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
              {erro}
            </div>
          )}

          <section className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {([
              [
                "Solicitação → Coleta",
                indicadores.solicitacao,
                "Tempo até a coleta",
              ],
              [
                "Coleta → Chegada ADS",
                indicadores.transporte,
                "Tempo de transporte",
              ],
              [
                "Chegada ADS → NF ADS",
                indicadores.faturamento,
                "Tempo até faturamento",
              ],
              ["Ciclo operacional total", indicadores.ciclo, "Solicitação → ADS"],
            ] as const).map(([titulo, resumo, detalhe]) => {
              const dado = resumo as {
                media: number;
                maior: number;
                registros: number;
              };

              return (
                <article
                  key={String(titulo)}
                  className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                >
                  <p className="text-xs font-semibold text-slate-500">{titulo}</p>

                  <p className="mt-2 text-2xl font-black text-slate-950">
                    {dado.registros > 0
                      ? `${dado.media.toLocaleString("pt-BR", {
                          minimumFractionDigits: 1,
                          maximumFractionDigits: 1,
                        })} dias`
                      : "—"}
                  </p>

                  <p className="mt-1 text-[11px] text-slate-400">
                    {detalhe} • maior: {dado.maior} dias
                  </p>
                </article>
              );
            })}
          </section>

          <article className="mb-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex flex-col justify-between gap-3 lg:flex-row lg:items-end">
              <div>
                <h2 className="text-sm font-black text-slate-950">
                  Filtros do SLA
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  Pesquise uma coleta ou filtre por transportadora e estado.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setPesquisa("");
                  setTransportadora("");
                  setEstado("");
                  setOrdenacao("ciclo_desc");
                }}
                className="text-xs font-bold text-blue-700 hover:text-blue-800"
              >
                Limpar filtros
              </button>
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <input
                type="search"
                value={pesquisa}
                onChange={(evento) => setPesquisa(evento.target.value)}
                placeholder="Pesquisar loja, OV, cidade, NF..."
                className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:bg-white"
              />

              <select
                value={transportadora}
                onChange={(evento) => setTransportadora(evento.target.value)}
                className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:bg-white"
              >
                <option value="">Todas as transportadoras</option>
                {transportadoras.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>

              <select
                value={estado}
                onChange={(evento) => setEstado(evento.target.value)}
                className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:bg-white"
              >
                <option value="">Todos os estados</option>
                {estados.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>

              <select
                value={ordenacao}
                onChange={(evento) => setOrdenacao(evento.target.value)}
                className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:bg-white"
              >
                <option value="ciclo_desc">Maior ciclo total</option>
                <option value="solicitacao_desc">
                  Maior Solicitação → Coleta
                </option>
                <option value="transporte_desc">
                  Maior Coleta → Chegada ADS
                </option>
                <option value="nf_desc">Maior Chegada ADS → NF</option>
                <option value="loja_asc">Loja A → Z</option>
              </select>
            </div>
          </article>

          <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col justify-between gap-3 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center">
              <div>
                <h2 className="text-sm font-black text-slate-950">
                  Detalhamento por coleta
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  {coletasFiltradas.length} coleta(s) encontrada(s)
                </p>
              </div>

              <div className="flex flex-wrap gap-3 text-[10px] font-bold">
                <span className="text-emerald-700">● Dentro do esperado</span>
                <span className="text-amber-700">● Atenção</span>
                <span className="text-red-700">● Prazo elevado</span>
              </div>
            </div>

            <div className="max-h-[680px] overflow-auto">
              <table className="w-full min-w-[1550px] text-left">
                <thead className="sticky top-0 z-10 bg-slate-50 text-[10px] uppercase tracking-wide text-slate-400">
                  <tr>
                    <th className="px-4 py-3">Loja / Unidade</th>
                    <th className="px-4 py-3">OV</th>
                    <th className="px-4 py-3">Transportadora</th>
                    <th className="px-4 py-3">Solicitação</th>
                    <th className="px-4 py-3">Coleta</th>
                    <th className="px-4 py-3">Chegada ADS</th>
                    <th className="px-4 py-3">Emissão NF ADS</th>
                    <th className="px-4 py-3 text-right">Solic. → Coleta</th>
                    <th className="px-4 py-3 text-right">Coleta → ADS</th>
                    <th className="px-4 py-3 text-right">ADS → NF</th>
                    <th className="px-4 py-3 text-right">Ciclo total</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100 text-xs">
                  {carregando ? (
                    <tr>
                      <td
                        colSpan={11}
                        className="px-5 py-12 text-center text-slate-500"
                      >
                        Carregando SLAs...
                      </td>
                    </tr>
                  ) : coletasFiltradas.length === 0 ? (
                    <tr>
                      <td
                        colSpan={11}
                        className="px-5 py-12 text-center text-slate-400"
                      >
                        Nenhuma coleta encontrada.
                      </td>
                    </tr>
                  ) : (
                    coletasFiltradas.map((coleta) => (
                      <tr key={coleta.id} className="hover:bg-slate-50/70">
                        <td className="px-4 py-3">
                          <p className="font-bold text-slate-900">
                            {coleta.loja || "Unidade não informada"}
                          </p>
                          <p className="mt-0.5 text-[10px] text-slate-400">
                            {[coleta.cidade, coleta.estado]
                              .filter(Boolean)
                              .join("/") || "—"}
                          </p>
                        </td>

                        <td className="whitespace-nowrap px-4 py-3 font-black text-blue-700">
                          {coleta.numero_ov || `#${coleta.id}`}
                        </td>

                        <td className="max-w-[220px] px-4 py-3 text-slate-600">
                          {coleta.transportadora || "Não definida"}
                        </td>

                        <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                          {formatarData(coleta.data_solicitacao)}
                        </td>

                        <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                          {formatarData(coleta.data_coleta)}
                        </td>

                        <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                          {formatarData(coleta.data_chegada_ads)}
                        </td>

                        <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                          {formatarData(coleta.data_emissao_nf_cobranca_ads)}
                        </td>

                        <td className="whitespace-nowrap px-4 py-3 text-right">
                          <TextoPrazo
                            dias={coleta.slaSolicitacaoColeta}
                            tipo="curto"
                          />
                        </td>

                        <td className="whitespace-nowrap px-4 py-3 text-right">
                          <TextoPrazo
                            dias={coleta.slaColetaAds}
                            tipo="transporte"
                          />
                        </td>

                        <td className="whitespace-nowrap px-4 py-3 text-right">
                          <TextoPrazo dias={coleta.slaAdsNf} tipo="curto" />
                        </td>

                        <td className="whitespace-nowrap px-4 py-3 text-right">
                          <TextoPrazo
                            dias={coleta.slaCicloTotal}
                            tipo="ciclo"
                          />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </article>
        </section>
      </div>
    </main>
  );
}