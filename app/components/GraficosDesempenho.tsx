"use client";

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
  status: string | null;
  transportadora: string | null;
};

type MesDesempenho = {
  chave: string;
  nome: string;
  total: number;
  concluidas: number;
  atrasadas: number;
};

type StatusDesempenho = {
  nome: string;
  valor: number;
  classe: string;
};

type TransportadoraDesempenho = {
  nome: string;
  total: number;
  concluidas: number;
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
  if (!data) {
    return null;
  }

  const dataPura = data.includes("T") ? data.split("T")[0] : data;
  const [ano, mes, dia] = dataPura.split("-").map(Number);

  if (!ano || !mes || !dia) {
    return null;
  }

  const resultado = new Date(ano, mes - 1, dia);
  resultado.setHours(0, 0, 0, 0);

  return resultado;
}

function coletaConcluida(coleta: Coleta) {
  const status = normalizarTexto(coleta.status);

  return (
    status === "finalizado" ||
    status === "recebido na ads" ||
    Boolean(coleta.data_chegada_ads)
  );
}

function coletaAtrasada(coleta: Coleta) {
  const prevista = criarDataLocal(coleta.data_prevista_coleta);
  const efetiva = criarDataLocal(
    coleta.data_efetiva_coleta ?? coleta.data_coleta,
  );

  if (!prevista || efetiva || coletaConcluida(coleta)) {
    return false;
  }

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  return prevista < hoje;
}

function obterUltimosMeses(quantidade: number) {
  const hoje = new Date();
  const meses: {
    chave: string;
    nome: string;
    ano: number;
    mes: number;
  }[] = [];

  for (let indice = quantidade - 1; indice >= 0; indice -= 1) {
    const data = new Date(
      hoje.getFullYear(),
      hoje.getMonth() - indice,
      1,
    );

    meses.push({
      chave: `${data.getFullYear()}-${String(
        data.getMonth() + 1,
      ).padStart(2, "0")}`,
      nome: new Intl.DateTimeFormat("pt-BR", {
        month: "short",
      })
        .format(data)
        .replace(".", ""),
      ano: data.getFullYear(),
      mes: data.getMonth(),
    });
  }

  return meses;
}

function criarPontosLinha(
  dados: MesDesempenho[],
  obterValor: (item: MesDesempenho) => number,
  largura: number,
  altura: number,
  valorMaximo: number,
) {
  if (dados.length === 0) {
    return "";
  }

  const espacoX =
    dados.length > 1 ? largura / (dados.length - 1) : largura;

  return dados
    .map((item, indice) => {
      const valor = obterValor(item);
      const x = indice * espacoX;
      const y =
        altura -
        (valorMaximo > 0 ? (valor / valorMaximo) * altura : 0);

      return `${x},${y}`;
    })
    .join(" ");
}

export default function GraficosDesempenho() {
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
          status,
          transportadora
        `)
        .order("created_at", { ascending: true });

      if (error) {
        console.error(
          "Erro ao carregar gráficos de desempenho:",
          error,
        );
        setErro(
          "Não foi possível carregar os gráficos de desempenho.",
        );
        setCarregando(false);
        return;
      }

      setColetas((data ?? []) as Coleta[]);
      setCarregando(false);
    }

    carregarDados();

    const canal = supabase
      .channel("graficos-desempenho")
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

  const desempenhoMensal = useMemo<MesDesempenho[]>(() => {
    const meses = obterUltimosMeses(6);

    return meses.map((mes) => {
      const registrosMes = coletas.filter((coleta) => {
        const data = criarDataLocal(
          coleta.data_solicitacao ?? coleta.created_at,
        );

        return (
          data?.getFullYear() === mes.ano &&
          data.getMonth() === mes.mes
        );
      });

      return {
        chave: mes.chave,
        nome: mes.nome,
        total: registrosMes.length,
        concluidas: registrosMes.filter(coletaConcluida).length,
        atrasadas: registrosMes.filter(coletaAtrasada).length,
      };
    });
  }, [coletas]);

  const distribuicaoStatus = useMemo<StatusDesempenho[]>(() => {
    const contadores = {
      aguardandoNf: 0,
      aguardandoColeta: 0,
      coletaRealizada: 0,
      recebidosAds: 0,
      finalizadas: 0,
    };

    coletas.forEach((coleta) => {
      const status = normalizarTexto(coleta.status);

      if (status === "finalizado") {
        contadores.finalizadas += 1;
        return;
      }

      if (
        status === "recebido na ads" ||
        Boolean(coleta.data_chegada_ads)
      ) {
        contadores.recebidosAds += 1;
        return;
      }

      if (
        status === "coleta realizada" ||
        Boolean(coleta.data_efetiva_coleta ?? coleta.data_coleta)
      ) {
        contadores.coletaRealizada += 1;
        return;
      }

      if (status === "aguardando coleta") {
        contadores.aguardandoColeta += 1;
        return;
      }

      contadores.aguardandoNf += 1;
    });

    return [
      {
        nome: "Aguardando NF",
        valor: contadores.aguardandoNf,
        classe: "bg-amber-500",
      },
      {
        nome: "Aguardando coleta",
        valor: contadores.aguardandoColeta,
        classe: "bg-violet-500",
      },
      {
        nome: "Coleta realizada",
        valor: contadores.coletaRealizada,
        classe: "bg-blue-500",
      },
      {
        nome: "Recebidos na ADS",
        valor: contadores.recebidosAds,
        classe: "bg-emerald-500",
      },
      {
        nome: "Finalizadas",
        valor: contadores.finalizadas,
        classe: "bg-slate-700",
      },
    ];
  }, [coletas]);

  const desempenhoTransportadoras =
    useMemo<TransportadoraDesempenho[]>(() => {
      const mapa = new Map<
        string,
        { total: number; concluidas: number }
      >();

      coletas.forEach((coleta) => {
        const nome = coleta.transportadora?.trim();

        if (!nome) {
          return;
        }

        const atual = mapa.get(nome) ?? {
          total: 0,
          concluidas: 0,
        };

        atual.total += 1;

        if (coletaConcluida(coleta)) {
          atual.concluidas += 1;
        }

        mapa.set(nome, atual);
      });

      return [...mapa.entries()]
        .map(([nome, dados]) => ({
          nome,
          total: dados.total,
          concluidas: dados.concluidas,
          percentual:
            dados.total > 0
              ? Math.round(
                  (dados.concluidas / dados.total) * 100,
                )
              : 0,
        }))
        .sort((a, b) => {
          if (b.percentual !== a.percentual) {
            return b.percentual - a.percentual;
          }

          return b.total - a.total;
        })
        .slice(0, 5);
    }, [coletas]);

  const maiorValorMensal = Math.max(
    1,
    ...desempenhoMensal.flatMap((item) => [
      item.total,
      item.concluidas,
      item.atrasadas,
    ]),
  );

  const larguraGrafico = 600;
  const alturaGrafico = 190;

  const pontosTotal = criarPontosLinha(
    desempenhoMensal,
    (item) => item.total,
    larguraGrafico,
    alturaGrafico,
    maiorValorMensal,
  );

  const pontosConcluidas = criarPontosLinha(
    desempenhoMensal,
    (item) => item.concluidas,
    larguraGrafico,
    alturaGrafico,
    maiorValorMensal,
  );

  const maiorStatus = Math.max(
    1,
    ...distribuicaoStatus.map((item) => item.valor),
  );

  return (
    <section className="mt-8 space-y-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">
          Desempenho operacional
        </p>

        <h3 className="mt-1 text-xl font-bold text-slate-900">
          Gráficos e evolução da operação
        </h3>

        <p className="mt-1 text-sm text-slate-500">
          Indicadores calculados com os dados reais cadastrados no
          Supabase.
        </p>
      </div>

      {erro && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
          {erro}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-6 flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
            <div>
              <h4 className="text-lg font-bold text-slate-900">
                Evolução mensal das coletas
              </h4>

              <p className="mt-1 text-sm text-slate-500">
                Total cadastrado e operações concluídas nos últimos
                seis meses.
              </p>
            </div>

            <div className="flex flex-wrap gap-3 text-xs font-semibold">
              <span className="flex items-center gap-2 text-slate-600">
                <span className="h-2.5 w-2.5 rounded-full bg-blue-600" />
                Total
              </span>

              <span className="flex items-center gap-2 text-slate-600">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-600" />
                Concluídas
              </span>
            </div>
          </div>

          {carregando ? (
            <div className="flex h-64 items-center justify-center rounded-2xl bg-slate-50 text-sm text-slate-500">
              Carregando gráfico...
            </div>
          ) : (
            <div className="overflow-x-auto">
              <div className="min-w-[640px]">
                <div className="relative h-[230px] rounded-2xl border border-slate-200 bg-slate-50 px-5 pb-8 pt-5">
                  <div className="absolute inset-x-5 top-5 h-[190px]">
                    {[0, 1, 2, 3, 4].map((linha) => (
                      <div
                        key={linha}
                        className="absolute left-0 right-0 border-t border-dashed border-slate-200"
                        style={{
                          top: `${(linha / 4) * 100}%`,
                        }}
                      />
                    ))}

                    <svg
                      viewBox={`0 0 ${larguraGrafico} ${alturaGrafico}`}
                      className="absolute inset-0 h-full w-full overflow-visible"
                      preserveAspectRatio="none"
                      aria-label="Gráfico mensal de coletas"
                    >
                      <polyline
                        points={pontosTotal}
                        fill="none"
                        stroke="rgb(37 99 235)"
                        strokeWidth="4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        vectorEffect="non-scaling-stroke"
                      />

                      <polyline
                        points={pontosConcluidas}
                        fill="none"
                        stroke="rgb(5 150 105)"
                        strokeWidth="4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        vectorEffect="non-scaling-stroke"
                      />
                    </svg>

                    <div className="absolute inset-0 flex justify-between">
                      {desempenhoMensal.map((item, indice) => {
                        const totalY =
                          alturaGrafico -
                          (item.total / maiorValorMensal) *
                            alturaGrafico;

                        const concluidaY =
                          alturaGrafico -
                          (item.concluidas / maiorValorMensal) *
                            alturaGrafico;

                        return (
                          <div
                            key={item.chave}
                            className="relative h-full w-px"
                          >
                            <span
                              title={`${item.nome}: ${item.total} coletas`}
                              className="absolute -ml-2 h-4 w-4 rounded-full border-4 border-white bg-blue-600 shadow-sm"
                              style={{
                                top: `${totalY - 8}px`,
                              }}
                            />

                            <span
                              title={`${item.nome}: ${item.concluidas} concluídas`}
                              className="absolute -ml-2 h-4 w-4 rounded-full border-4 border-white bg-emerald-600 shadow-sm"
                              style={{
                                top: `${concluidaY - 8}px`,
                              }}
                            />

                            <div className="absolute top-[198px] -translate-x-1/2 text-center">
                              <p className="text-xs font-bold capitalize text-slate-600">
                                {item.nome}
                              </p>

                              <p className="mt-1 text-[10px] text-slate-400">
                                {item.total} total
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </article>

        <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-6">
            <h4 className="text-lg font-bold text-slate-900">
              Distribuição por etapa
            </h4>

            <p className="mt-1 text-sm text-slate-500">
              Quantidade atual de coletas em cada fase.
            </p>
          </div>

          {carregando ? (
            <div className="flex h-64 items-center justify-center rounded-2xl bg-slate-50 text-sm text-slate-500">
              Carregando distribuição...
            </div>
          ) : (
            <div className="space-y-5">
              {distribuicaoStatus.map((item) => (
                <div key={item.nome}>
                  <div className="mb-2 flex items-center justify-between gap-4">
                    <p className="text-sm font-semibold text-slate-700">
                      {item.nome}
                    </p>

                    <p className="text-sm font-black text-slate-900">
                      {item.valor}
                    </p>
                  </div>

                  <div className="h-3 overflow-hidden rounded-full bg-slate-200">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${item.classe}`}
                      style={{
                        width: `${
                          (item.valor / maiorStatus) * 100
                        }%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </article>
      </div>

      <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-6">
          <h4 className="text-lg font-bold text-slate-900">
            Desempenho das transportadoras
          </h4>

          <p className="mt-1 text-sm text-slate-500">
            Percentual de operações concluídas entre as
            transportadoras mais utilizadas.
          </p>
        </div>

        {carregando ? (
          <div className="flex h-40 items-center justify-center rounded-2xl bg-slate-50 text-sm text-slate-500">
            Carregando transportadoras...
          </div>
        ) : desempenhoTransportadoras.length === 0 ? (
          <div className="rounded-2xl bg-slate-50 p-6 text-sm text-slate-500">
            Ainda não existem dados suficientes para calcular o
            desempenho das transportadoras.
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {desempenhoTransportadoras.map(
              (transportadora, indice) => (
                <div
                  key={transportadora.nome}
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-5"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-black text-white">
                        {indice + 1}
                      </span>

                      <div className="min-w-0">
                        <p className="truncate font-bold text-slate-900">
                          {transportadora.nome}
                        </p>

                        <p className="mt-1 text-xs text-slate-500">
                          {transportadora.concluidas} de{" "}
                          {transportadora.total} concluídas
                        </p>
                      </div>
                    </div>

                    <p className="shrink-0 text-xl font-black text-emerald-700">
                      {transportadora.percentual}%
                    </p>
                  </div>

                  <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-slate-200">
                    <div
                      className="h-full rounded-full bg-emerald-600 transition-all duration-700"
                      style={{
                        width: `${transportadora.percentual}%`,
                      }}
                    />
                  </div>
                </div>
              ),
            )}
          </div>
        )}
      </article>
    </section>
  );
}