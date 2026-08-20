"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { criarClienteSupabaseBrowser } from "../lib/supabase-browser";

type Coleta = {
  id: string;
  data_solicitacao: string | null;
  loja: string | null;
  cidade: string | null;
  estado: string | null;
  numero_nf_cobranca_ads: string | null;
  vencimento_nf_cobranca_ads: string | null;
  data_recebimento_pagamento_ads: string | null;
  valor_nf_cobranca_ads: number | null;
};

function diasEntreDatas(inicial: string | null, final: string | null) {
  if (!inicial || !final) return null;

  const inicio = new Date(`${inicial.slice(0, 10)}T00:00:00`);
  const fim = new Date(`${final.slice(0, 10)}T00:00:00`);

  if (Number.isNaN(inicio.getTime()) || Number.isNaN(fim.getTime())) {
    return null;
  }

  return Math.round(
    (fim.getTime() - inicio.getTime()) / 86_400_000,
  );
}

function formatarData(data: string | null) {
  if (!data) return "—";

  const base = data.slice(0, 10);
  const [ano, mes, dia] = base.split("-");

  if (!ano || !mes || !dia) return data;

  return `${dia}/${mes}/${ano}`;
}

function formatarMoeda(valor: number | null | undefined) {
  return Number(valor ?? 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export default function AnalisePagamentosPage() {
  const [coletas, setColetas] = useState<Coleta[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const [pesquisa, setPesquisa] = useState("");
  const [situacao, setSituacao] = useState("");
  const [ordenacao, setOrdenacao] =
    useState("atraso_desc");

  useEffect(() => {
    const supabase = criarClienteSupabaseBrowser();
    let ativo = true;

    async function carregar() {
      setCarregando(true);
      setErro(null);

      const { data, error } = await supabase
        .from("coletas")
        .select(
          "id,data_solicitacao,loja,cidade,estado,numero_nf_cobranca_ads,vencimento_nf_cobranca_ads,data_recebimento_pagamento_ads,valor_nf_cobranca_ads",
        )
        .gte("data_solicitacao", "2026-01-01")
        .lte("data_solicitacao", "2026-12-31")
        .order("data_solicitacao", {
          ascending: false,
        });

      if (!ativo) return;

      if (error) {
        console.error(error);

        setErro(
          "Não foi possível carregar a análise de pagamentos.",
        );

        setColetas([]);
      } else {
        setColetas((data ?? []) as Coleta[]);
      }

      setCarregando(false);
    }

    carregar();

    const canal = supabase
      .channel("analise-pagamentos-2026")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "coletas",
        },
        () => carregar(),
      )
      .subscribe();

    return () => {
      ativo = false;
      supabase.removeChannel(canal);
    };
  }, []);

  const pagamentos = useMemo(() => {
    return coletas
      .filter(
        (item) =>
          item.vencimento_nf_cobranca_ads &&
          item.data_recebimento_pagamento_ads,
      )
      .map((item) => ({
        ...item,

        dias:
          diasEntreDatas(
            item.vencimento_nf_cobranca_ads,
            item.data_recebimento_pagamento_ads,
          ) ?? 0,
      }));
  }, [coletas]);

  const indicadores = useMemo(() => {
    const total = pagamentos.length;

    const atrasados = pagamentos.filter(
      (item) => item.dias > 0,
    );

    const noPrazo = pagamentos.filter(
      (item) => item.dias <= 0,
    );

    const somaAtraso = atrasados.reduce(
      (soma, item) => soma + item.dias,
      0,
    );

    return {
      total,

      atrasados: atrasados.length,

      noPrazo: noPrazo.length,

      pontualidade: total
        ? (noPrazo.length / total) * 100
        : 0,

      mediaAtraso: atrasados.length
        ? somaAtraso / atrasados.length
        : 0,

      maiorAtraso: atrasados.length
        ? Math.max(
            ...atrasados.map((item) => item.dias),
          )
        : 0,
    };
  }, [pagamentos]);

  const faixas = useMemo(() => {
    const dados = [
      {
        nome: "No prazo / antecipado",
        quantidade: 0,
      },
      {
        nome: "1 a 7 dias",
        quantidade: 0,
      },
      {
        nome: "8 a 15 dias",
        quantidade: 0,
      },
      {
        nome: "16 a 30 dias",
        quantidade: 0,
      },
      {
        nome: "Acima de 30 dias",
        quantidade: 0,
      },
    ];

    pagamentos.forEach((item) => {
      if (item.dias <= 0) {
        dados[0].quantidade += 1;
      } else if (item.dias <= 7) {
        dados[1].quantidade += 1;
      } else if (item.dias <= 15) {
        dados[2].quantidade += 1;
      } else if (item.dias <= 30) {
        dados[3].quantidade += 1;
      } else {
        dados[4].quantidade += 1;
      }
    });

    return dados;
  }, [pagamentos]);

  const ranking = useMemo(() => {
    const mapa = new Map<
      string,
      {
        loja: string;
        notas: number;
        atrasadas: number;
        noPrazo: number;
        somaAtraso: number;
        maiorAtraso: number;
        valor: number;
      }
    >();

    pagamentos.forEach((item) => {
      const loja =
        item.loja?.trim() || "Loja não informada";

      const atual = mapa.get(loja) ?? {
        loja,
        notas: 0,
        atrasadas: 0,
        noPrazo: 0,
        somaAtraso: 0,
        maiorAtraso: 0,
        valor: 0,
      };

      atual.notas += 1;

      atual.valor += Number(
        item.valor_nf_cobranca_ads ?? 0,
      );

      if (item.dias > 0) {
        atual.atrasadas += 1;

        atual.somaAtraso += item.dias;

        atual.maiorAtraso = Math.max(
          atual.maiorAtraso,
          item.dias,
        );
      } else {
        atual.noPrazo += 1;
      }

      mapa.set(loja, atual);
    });

    return Array.from(mapa.values())
      .map((item) => ({
        ...item,

        mediaAtraso: item.atrasadas
          ? item.somaAtraso / item.atrasadas
          : 0,

        pontualidade: item.notas
          ? (item.noPrazo / item.notas) * 100
          : 0,
      }))
      .sort(
        (a, b) =>
          b.mediaAtraso - a.mediaAtraso,
      );
  }, [pagamentos]);

  const melhores = useMemo(() => {
    return [...ranking]
      .sort((a, b) => {
        if (
          b.pontualidade !== a.pontualidade
        ) {
          return (
            b.pontualidade - a.pontualidade
          );
        }

        return (
          a.mediaAtraso - b.mediaAtraso
        );
      })
      .slice(0, 5);
  }, [ranking]);

  const piores = useMemo(() => {
    return [...ranking]
      .sort((a, b) => {
        if (
          a.pontualidade !== b.pontualidade
        ) {
          return (
            a.pontualidade - b.pontualidade
          );
        }

        return (
          b.mediaAtraso - a.mediaAtraso
        );
      })
      .slice(0, 5);
  }, [ranking]);

  const pagamentosFiltrados = useMemo(() => {
    const termo =
      pesquisa.trim().toLowerCase();

    return pagamentos
      .filter((item) => {
        const texto = [
          item.loja,
          item.numero_nf_cobranca_ads,
          item.cidade,
          item.estado,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        const batePesquisa =
          !termo ||
          texto.includes(termo);

        const bateSituacao =
          !situacao ||
          (situacao === "atrasado" &&
            item.dias > 0) ||
          (situacao === "prazo" &&
            item.dias === 0) ||
          (situacao === "antecipado" &&
            item.dias < 0);

        return (
          batePesquisa &&
          bateSituacao
        );
      })
      .sort((a, b) => {
        if (
          ordenacao === "atraso_asc"
        ) {
          return a.dias - b.dias;
        }

        if (ordenacao === "loja") {
          return (
            a.loja ?? ""
          ).localeCompare(
            b.loja ?? "",
            "pt-BR",
          );
        }

        if (
          ordenacao === "vencimento"
        ) {
          return (
            b.vencimento_nf_cobranca_ads ??
            ""
          ).localeCompare(
            a.vencimento_nf_cobranca_ads ??
              "",
          );
        }

        return b.dias - a.dias;
      });
  }, [
    pagamentos,
    pesquisa,
    situacao,
    ordenacao,
  ]);

  if (carregando) {
    return (
      <main className="p-6 lg:p-8">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">
          Carregando análise de
          pagamentos...
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 p-6 lg:p-8">
      <div className="mx-auto max-w-[1500px] space-y-6">
        {/* CABEÇALHO */}

        <section className="rounded-3xl bg-slate-950 p-6 text-white shadow-sm lg:p-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-emerald-400">
                Inteligência financeira • 2026
              </p>

              <h1 className="mt-2 text-2xl font-black tracking-tight lg:text-3xl">
                Análise de Pagamentos
              </h1>

              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
                Visão gerencial do comportamento
                de pagamento das lojas com base no
                vencimento da NF de cobrança ADS e
                na data efetiva do recebimento.
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
        </section>

        {erro && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
            {erro}
          </div>
        )}

        {/* INDICADORES */}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            [
              "Pontualidade geral",

              `${indicadores.pontualidade.toLocaleString(
                "pt-BR",
                {
                  minimumFractionDigits: 1,
                  maximumFractionDigits: 1,
                },
              )}%`,

              `${indicadores.noPrazo} de ${indicadores.total} notas`,
            ],

            [
              "Média de atraso",

              `${indicadores.mediaAtraso.toLocaleString(
                "pt-BR",
                {
                  minimumFractionDigits: 1,
                  maximumFractionDigits: 1,
                },
              )} dias`,

              "Somente pagamentos após o vencimento",
            ],

            [
              "Maior atraso",

              `${indicadores.maiorAtraso} dias`,

              "Maior ocorrência registrada",
            ],

            [
              "Notas analisadas",

              indicadores.total,

              `${indicadores.atrasados} pagas com atraso`,
            ],
          ].map(
            ([titulo, valor, detalhe]) => (
              <article
                key={String(titulo)}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                  {titulo}
                </p>

                <p className="mt-2 text-2xl font-black text-slate-950">
                  {valor}
                </p>

                <p className="mt-1 text-xs text-slate-500">
                  {detalhe}
                </p>
              </article>
            ),
          )}
        </section>

        {/* FAIXAS + RANKING */}

        <section className="grid gap-6 xl:grid-cols-[1fr_1.2fr]">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-black text-slate-950">
              Faixas de atraso
            </h2>

            <p className="mt-1 text-xs text-slate-500">
              Distribuição das notas conforme o
              prazo efetivo de pagamento.
            </p>

            <div className="mt-5 space-y-4">
              {faixas.map((faixa) => {
                const percentual =
                  indicadores.total
                    ? (faixa.quantidade /
                        indicadores.total) *
                      100
                    : 0;

                return (
                  <div key={faixa.nome}>
                    <div className="mb-1.5 flex items-center justify-between gap-4 text-xs">
                      <span className="font-bold text-slate-700">
                        {faixa.nome}
                      </span>

                      <span className="font-black text-slate-950">
                        {faixa.quantidade} •{" "}
                        {percentual.toFixed(1)}%
                      </span>
                    </div>

                    <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-emerald-500"
                        style={{
                          width: `${Math.min(
                            100,
                            percentual,
                          )}%`,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {/* MELHORES */}

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-base font-black text-slate-950">
                Top 5 melhores pagadoras
              </h2>

              <p className="mt-1 text-xs text-slate-500">
                Maior índice de pagamentos no
                prazo.
              </p>

              <div className="mt-4 space-y-3">
                {melhores.map(
                  (item, indice) => (
                    <div
                      key={item.loja}
                      className="flex items-center justify-between gap-4 rounded-xl bg-slate-50 px-4 py-3"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-black text-slate-900">
                          {indice + 1}.{" "}
                          {item.loja}
                        </p>

                        <p className="text-[11px] text-slate-500">
                          {item.noPrazo}/
                          {item.notas} notas no
                          prazo
                        </p>
                      </div>

                      <span className="text-sm font-black text-emerald-700">
                        {item.pontualidade.toFixed(
                          0,
                        )}
                        %
                      </span>
                    </div>
                  ),
                )}
              </div>
            </div>

            {/* PIORES */}

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-base font-black text-slate-950">
                Top 5 maior recorrência de atraso
              </h2>

              <p className="mt-1 text-xs text-slate-500">
                Lojas com menor índice de
                pontualidade.
              </p>

              <div className="mt-4 space-y-3">
                {piores.map(
                  (item, indice) => (
                    <div
                      key={item.loja}
                      className="flex items-center justify-between gap-4 rounded-xl bg-slate-50 px-4 py-3"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-black text-slate-900">
                          {indice + 1}.{" "}
                          {item.loja}
                        </p>

                        <p className="text-[11px] text-slate-500">
                          {item.atrasadas}/
                          {item.notas} notas
                          atrasadas
                        </p>
                      </div>

                      <span className="text-sm font-black text-red-700">
                        {(
                          100 -
                          item.pontualidade
                        ).toFixed(0)}
                        %
                      </span>
                    </div>
                  ),
                )}
              </div>
            </div>
          </div>
        </section>

        {/* HISTÓRICO */}

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 p-5">
            <h2 className="text-base font-black text-slate-950">
              Histórico detalhado
            </h2>

            <p className="mt-1 text-xs text-slate-500">
              Consulta NF por NF dos pagamentos
              considerados na análise.
            </p>

            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <input
                type="search"
                value={pesquisa}
                onChange={(e) =>
                  setPesquisa(e.target.value)
                }
                placeholder="Pesquisar loja, NF, cidade ou UF..."
                className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none focus:border-emerald-500 focus:bg-white"
              />

              <select
                value={situacao}
                onChange={(e) =>
                  setSituacao(e.target.value)
                }
                className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none focus:border-emerald-500"
              >
                <option value="">
                  Todas as situações
                </option>

                <option value="atrasado">
                  Pago com atraso
                </option>

                <option value="prazo">
                  Pago no vencimento
                </option>

                <option value="antecipado">
                  Pago antecipado
                </option>
              </select>

              <select
                value={ordenacao}
                onChange={(e) =>
                  setOrdenacao(e.target.value)
                }
                className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none focus:border-emerald-500"
              >
                <option value="atraso_desc">
                  Maior atraso primeiro
                </option>

                <option value="atraso_asc">
                  Menor atraso primeiro
                </option>

                <option value="vencimento">
                  Vencimento mais recente
                </option>

                <option value="loja">
                  Loja A → Z
                </option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3">
                    Loja
                  </th>

                  <th className="px-5 py-3">
                    NF ADS
                  </th>

                  <th className="px-5 py-3">
                    Vencimento
                  </th>

                  <th className="px-5 py-3">
                    Pagamento
                  </th>

                  <th className="px-5 py-3 text-right">
                    Prazo
                  </th>

                  <th className="px-5 py-3 text-right">
                    Valor
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {pagamentosFiltrados.length ===
                0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-5 py-10 text-center text-sm text-slate-400"
                    >
                      Nenhum pagamento
                      encontrado.
                    </td>
                  </tr>
                ) : (
                  pagamentosFiltrados.map(
                    (item) => (
                      <tr
                        key={item.id}
                        className="hover:bg-slate-50/70"
                      >
                        <td className="px-5 py-3">
                          <p className="font-bold text-slate-900">
                            {item.loja ||
                              "—"}
                          </p>

                          <p className="text-[11px] text-slate-400">
                            {[
                              item.cidade,
                              item.estado,
                            ]
                              .filter(Boolean)
                              .join(" / ")}
                          </p>
                        </td>

                        <td className="px-5 py-3 font-bold text-slate-700">
                          {item.numero_nf_cobranca_ads ||
                            "—"}
                        </td>

                        <td className="px-5 py-3 text-slate-600">
                          {formatarData(
                            item.vencimento_nf_cobranca_ads,
                          )}
                        </td>

                        <td className="px-5 py-3 text-slate-600">
                          {formatarData(
                            item.data_recebimento_pagamento_ads,
                          )}
                        </td>

                        <td className="px-5 py-3 text-right">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-black ${
                              item.dias > 0
                                ? "bg-red-50 text-red-700"
                                : "bg-emerald-50 text-emerald-700"
                            }`}
                          >
                            {item.dias > 0
                              ? `${item.dias} dias`
                              : item.dias ===
                                  0
                                ? "No vencimento"
                                : `${Math.abs(
                                    item.dias,
                                  )} dias antes`}
                          </span>
                        </td>

                        <td className="px-5 py-3 text-right font-bold text-slate-900">
                          {formatarMoeda(
                            item.valor_nf_cobranca_ads,
                          )}
                        </td>
                      </tr>
                    ),
                  )
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}