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
  transportadora: string | null;
  data_solicitacao: string | null;
  data_prevista_coleta: string | null;
  data_efetiva_coleta: string | null;
  data_coleta: string | null;
  data_chegada_ads: string | null;
  status: string | null;
};

type FiltroAgenda =
  | "hoje"
  | "amanha"
  | "semana"
  | "atrasadas"
  | "todas";

type ItemAgenda = {
  coleta: Coleta;
  data: Date;
  dataOriginal: string;
  atrasada: boolean;
  hoje: boolean;
  amanha: boolean;
  diasDiferenca: number;
};

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
  const convertida = criarDataLocal(data);

  if (!convertida) {
    return "Data não informada";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(convertida);
}

function formatarDataCurta(data: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  }).format(data);
}

function normalizarTexto(texto: string | null | undefined) {
  return (texto ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function diferencaDias(data: Date, referencia: Date) {
  return Math.round(
    (data.getTime() - referencia.getTime()) /
      (1000 * 60 * 60 * 24),
  );
}

function statusFinalizado(coleta: Coleta) {
  const status = normalizarTexto(coleta.status);

  return (
    status === "finalizado" ||
    status === "recebido na ads" ||
    Boolean(coleta.data_chegada_ads)
  );
}

function classeSituacao(item: ItemAgenda) {
  if (item.atrasada) {
    return {
      card: "border-red-200 bg-red-50",
      faixa: "bg-red-600",
      selo: "bg-red-100 text-red-700",
      titulo: "Atrasada",
    };
  }

  if (item.hoje) {
    return {
      card: "border-blue-200 bg-blue-50",
      faixa: "bg-blue-600",
      selo: "bg-blue-100 text-blue-700",
      titulo: "Hoje",
    };
  }

  if (item.amanha) {
    return {
      card: "border-violet-200 bg-violet-50",
      faixa: "bg-violet-600",
      selo: "bg-violet-100 text-violet-700",
      titulo: "Amanhã",
    };
  }

  return {
    card: "border-slate-200 bg-white",
    faixa: "bg-slate-400",
    selo: "bg-slate-100 text-slate-600",
    titulo: "Programada",
  };
}

export default function AgendaOperacional() {
  const [coletas, setColetas] = useState<Coleta[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [filtro, setFiltro] = useState<FiltroAgenda>("hoje");
  const [pesquisa, setPesquisa] = useState("");
  const [pagina, setPagina] = useState(1);

  const ITENS_POR_PAGINA = 10;

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
          transportadora,
          data_solicitacao,
          data_prevista_coleta,
          data_efetiva_coleta,
          data_coleta,
          data_chegada_ads,
          status
        `)
        .not("data_prevista_coleta", "is", null)
        .order("data_prevista_coleta", { ascending: true });

      if (error) {
        console.error("Erro ao carregar agenda:", error);
        setErro("Não foi possível carregar a Agenda Operacional.");
        setCarregando(false);
        return;
      }

      setColetas((data ?? []) as Coleta[]);
      setCarregando(false);
    }

    carregarColetas();

    const canal = supabase
      .channel("agenda-operacional")
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

  const itensAgenda = useMemo(() => {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const amanha = new Date(hoje);
    amanha.setDate(amanha.getDate() + 1);

    return coletas
      .filter((coleta) => !statusFinalizado(coleta))
      .map((coleta): ItemAgenda | null => {
        const data = criarDataLocal(coleta.data_prevista_coleta);

        if (!data || !coleta.data_prevista_coleta) {
          return null;
        }

        const diferenca = diferencaDias(data, hoje);

        return {
          coleta,
          data,
          dataOriginal: coleta.data_prevista_coleta,
          atrasada: diferenca < 0,
          hoje: diferenca === 0,
          amanha: diferenca === 1,
          diasDiferenca: diferenca,
        };
      })
      .filter((item): item is ItemAgenda => item !== null)
      .sort((a, b) => a.data.getTime() - b.data.getTime());
  }, [coletas]);

  const contadores = useMemo(
    () => ({
      hoje: itensAgenda.filter((item) => item.hoje).length,
      amanha: itensAgenda.filter((item) => item.amanha).length,
      semana: itensAgenda.filter(
        (item) => item.diasDiferenca >= 0 && item.diasDiferenca <= 7,
      ).length,
      atrasadas: itensAgenda.filter((item) => item.atrasada).length,
      todas: itensAgenda.length,
    }),
    [itensAgenda],
  );

  const itensFiltrados = useMemo(() => {
    const termo = pesquisa.trim().toLowerCase();

    return itensAgenda.filter((item) => {
      const atendeFiltro =
        filtro === "todas" ||
        (filtro === "hoje" && item.hoje) ||
        (filtro === "amanha" && item.amanha) ||
        (filtro === "semana" &&
          item.diasDiferenca >= 0 &&
          item.diasDiferenca <= 7) ||
        (filtro === "atrasadas" && item.atrasada);

      if (!atendeFiltro) {
        return false;
      }

      if (!termo) {
        return true;
      }

      const conteudo = [
        item.coleta.numero_ov,
        item.coleta.cliente,
        item.coleta.loja,
        item.coleta.cidade,
        item.coleta.estado,
        item.coleta.transportadora,
        item.coleta.status,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return conteudo.includes(termo);
    });
  }, [itensAgenda, filtro, pesquisa]);

  useEffect(() => {
    setPagina(1);
  }, [filtro, pesquisa]);

  const totalPaginas = Math.max(
    1,
    Math.ceil(itensFiltrados.length / ITENS_POR_PAGINA),
  );

  const itensPaginados = useMemo(() => {
    const inicio = (pagina - 1) * ITENS_POR_PAGINA;

    return itensFiltrados.slice(
      inicio,
      inicio + ITENS_POR_PAGINA,
    );
  }, [itensFiltrados, pagina]);

  function situacaoItem(item: ItemAgenda) {
    if (item.atrasada) {
      const dias = Math.abs(item.diasDiferenca);

      return {
        texto: `${dias} ${dias === 1 ? "dia" : "dias"} em atraso`,
        badge: "border-red-200 bg-red-50 text-red-700",
        ponto: "bg-red-500",
      };
    }

    if (item.hoje) {
      return {
        texto: "Hoje",
        badge: "border-blue-200 bg-blue-50 text-blue-700",
        ponto: "bg-blue-500",
      };
    }

    if (item.amanha) {
      return {
        texto: "Amanhã",
        badge: "border-violet-200 bg-violet-50 text-violet-700",
        ponto: "bg-violet-500",
      };
    }

    return {
      texto: `Em ${item.diasDiferenca} dias`,
      badge: "border-slate-200 bg-slate-50 text-slate-600",
      ponto: "bg-slate-400",
    };
  }

  const filtros = [
    {
      id: "hoje" as FiltroAgenda,
      titulo: "Hoje",
      valor: contadores.hoje,
      detalhe: "Programação do dia",
      cor: "border-emerald-100 bg-emerald-50/60",
      bolinha: "bg-emerald-500",
    },
    {
      id: "amanha" as FiltroAgenda,
      titulo: "Amanhã",
      valor: contadores.amanha,
      detalhe: "Próximo dia",
      cor: "border-blue-100 bg-blue-50/60",
      bolinha: "bg-blue-500",
    },
    {
      id: "semana" as FiltroAgenda,
      titulo: "Próximos 7 dias",
      valor: contadores.semana,
      detalhe: "Programação próxima",
      cor: "border-violet-100 bg-violet-50/60",
      bolinha: "bg-violet-500",
    },
    {
      id: "atrasadas" as FiltroAgenda,
      titulo: "Atrasadas",
      valor: contadores.atrasadas,
      detalhe: "Exigem atenção",
      cor: "border-red-100 bg-red-50/60",
      bolinha: "bg-red-500",
    },
    {
      id: "todas" as FiltroAgenda,
      titulo: "Todas",
      valor: contadores.todas,
      detalhe: "Agenda completa",
      cor: "border-slate-200 bg-white",
      bolinha: "bg-slate-400",
    },
  ];

  const inicioExibicao =
    itensFiltrados.length === 0
      ? 0
      : (pagina - 1) * ITENS_POR_PAGINA + 1;

  const fimExibicao = Math.min(
    pagina * ITENS_POR_PAGINA,
    itensFiltrados.length,
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
            Agenda Operacional
          </h2>

          <p className="mt-1.5 text-sm text-slate-500">
            Acompanhe coletas previstas, atrasos e a programação dos próximos dias.
          </p>
        </div>

        <div className="relative w-full lg:w-[360px]">
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
            onChange={(evento) => setPesquisa(evento.target.value)}
            placeholder="Pesquisar OV, cliente ou transportadora..."
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
                "rounded-2xl border p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md",
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

      {/* TABELA */}
      <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col justify-between gap-3 border-b border-slate-200 bg-slate-50/50 px-5 py-4 sm:flex-row sm:items-center">
          <div>
            <p className="text-sm font-bold text-slate-800">
              Programação de coletas
            </p>

            <p className="mt-1 text-xs text-slate-500">
              Visualize rapidamente datas, responsáveis e situações da agenda.
            </p>
          </div>

          <select
            value={filtro}
            onChange={(evento) =>
              setFiltro(evento.target.value as FiltroAgenda)
            }
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 outline-none transition focus:border-emerald-500 sm:w-52"
          >
            <option value="hoje">Hoje</option>
            <option value="amanha">Amanhã</option>
            <option value="semana">Próximos 7 dias</option>
            <option value="atrasadas">Atrasadas</option>
            <option value="todas">Todas</option>
          </select>
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
              Carregando agenda...
            </p>
          </div>
        )}

        {!carregando && !erro && itensFiltrados.length === 0 && (
          <div className="px-5 py-16 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
              ✓
            </div>

            <p className="mt-4 font-bold text-slate-800">
              Nenhuma coleta encontrada
            </p>

            <p className="mt-1 text-sm text-slate-500">
              Não existem coletas correspondentes ao filtro selecionado.
            </p>
          </div>
        )}

        {!carregando && !erro && itensFiltrados.length > 0 && (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1120px] text-left">
                <thead className="border-b border-slate-200 bg-white">
                  <tr>
                    <th className="px-5 py-3.5 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                      Data prevista
                    </th>
                    <th className="px-5 py-3.5 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                      OV
                    </th>
                    <th className="px-5 py-3.5 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                      Cliente / Unidade
                    </th>
                    <th className="px-5 py-3.5 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                      Localização
                    </th>
                    <th className="px-5 py-3.5 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                      Transportadora
                    </th>
                    <th className="px-5 py-3.5 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                      Situação
                    </th>
                    <th className="px-5 py-3.5 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                      Ações
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {itensPaginados.map((item) => {
                    const coleta = item.coleta;
                    const situacao = situacaoItem(item);

                    return (
                      <tr
                        key={coleta.id}
                        className="transition hover:bg-slate-50/70"
                      >
                        <td className="whitespace-nowrap px-5 py-4">
                          <p className="text-sm font-black text-slate-800">
                            {formatarDataCurta(item.data)}
                          </p>

                          <p className="mt-1 text-[11px] font-medium text-slate-400">
                            {formatarData(item.dataOriginal)}
                          </p>
                        </td>

                        <td className="whitespace-nowrap px-5 py-4">
                          <span className="inline-flex rounded-lg bg-emerald-50 px-2.5 py-1.5 text-sm font-black text-emerald-700">
                            {coleta.numero_ov || `#${coleta.id}`}
                          </span>
                        </td>

                        <td className="px-5 py-4">
                          <p className="text-sm font-bold text-slate-800">
                            {coleta.cliente || "Cliente não informado"}
                          </p>

                          <p className="mt-1 max-w-[280px] text-xs leading-5 text-slate-500">
                            {coleta.loja || "Unidade não informada"}
                          </p>
                        </td>

                        <td className="px-5 py-4">
                          <p className="text-sm font-semibold text-slate-700">
                            {[coleta.cidade, coleta.estado]
                              .filter(Boolean)
                              .join(" / ") || "Não informada"}
                          </p>
                        </td>

                        <td className="px-5 py-4">
                          <p className="max-w-[210px] text-sm font-semibold leading-5 text-slate-700">
                            {coleta.transportadora || "Não definida"}
                          </p>
                        </td>

                        <td className="whitespace-nowrap px-5 py-4">
                          <span
                            className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[11px] font-bold ${situacao.badge}`}
                          >
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${situacao.ponto}`}
                            />
                            {situacao.texto}
                          </span>
                        </td>

                        <td className="whitespace-nowrap px-5 py-4">
                          <Link
                            href={`/coletas/${coleta.id}/editar`}
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
                  {itensFiltrados.length}
                </span>{" "}
                coleta(s)
              </p>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() =>
                    setPagina((atual) => Math.max(1, atual - 1))
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
                    const anterior = lista[indice - 1];

                    return (
                      <div
                        key={numero}
                        className="flex items-center gap-1.5"
                      >
                        {anterior && numero - anterior > 1 && (
                          <span className="px-1 text-xs text-slate-400">
                            …
                          </span>
                        )}

                        <button
                          type="button"
                          onClick={() => setPagina(numero)}
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
                      Math.min(totalPaginas, atual + 1),
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