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
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return conteudo.includes(termo);
    });
  }, [itensAgenda, filtro, pesquisa]);

  const agendaPorData = useMemo(() => {
    const grupos = new Map<string, ItemAgenda[]>();

    itensFiltrados.forEach((item) => {
      const chave = item.dataOriginal;
      const grupo = grupos.get(chave) ?? [];
      grupo.push(item);
      grupos.set(chave, grupo);
    });

    return [...grupos.entries()].sort(
      ([dataA], [dataB]) =>
        (criarDataLocal(dataA)?.getTime() ?? 0) -
        (criarDataLocal(dataB)?.getTime() ?? 0),
    );
  }, [itensFiltrados]);

  const filtros = [
    { id: "hoje" as FiltroAgenda, titulo: "Hoje", valor: contadores.hoje },
    {
      id: "amanha" as FiltroAgenda,
      titulo: "Amanhã",
      valor: contadores.amanha,
    },
    {
      id: "semana" as FiltroAgenda,
      titulo: "Próximos 7 dias",
      valor: contadores.semana,
    },
    {
      id: "atrasadas" as FiltroAgenda,
      titulo: "Atrasadas",
      valor: contadores.atrasadas,
    },
    {
      id: "todas" as FiltroAgenda,
      titulo: "Todas",
      valor: contadores.todas,
    },
  ];

  return (
    <section className="space-y-6">
      <article className="overflow-hidden rounded-3xl border border-slate-200 bg-slate-950 text-white shadow-sm">
        <div className="h-1.5 bg-emerald-500" />

        <div className="flex flex-col justify-between gap-6 p-6 lg:flex-row lg:items-end lg:p-8">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-emerald-400">
              Centro de Inteligência Operacional
            </p>

            <h2 className="mt-3 text-3xl font-black">
              Agenda Operacional
            </h2>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
              Acompanhe coletas previstas, atrasos e a programação dos
              próximos dias.
            </p>
          </div>

          <input
            type="search"
            value={pesquisa}
            onChange={(evento) => setPesquisa(evento.target.value)}
            placeholder="Pesquisar OV, cliente ou transportadora..."
            className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-emerald-500 lg:w-96"
          />
        </div>
      </article>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {filtros.map((item) => {
          const ativo = filtro === item.id;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setFiltro(item.id)}
              className={[
                "rounded-2xl border p-5 text-left shadow-sm transition",
                ativo
                  ? "border-emerald-600 bg-emerald-600 text-white"
                  : "border-slate-200 bg-white text-slate-700 hover:border-emerald-300",
              ].join(" ")}
            >
              <p className="text-sm font-semibold">{item.titulo}</p>

              <p className="mt-2 text-3xl font-black">
                {carregando ? "..." : String(item.valor).padStart(2, "0")}
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
          Carregando agenda...
        </div>
      )}

      {!carregando && !erro && agendaPorData.length === 0 && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-8 text-center shadow-sm">
          <p className="text-lg font-bold text-emerald-800">
            Nenhuma coleta encontrada
          </p>

          <p className="mt-2 text-sm text-emerald-700">
            Não existem coletas correspondentes ao filtro selecionado.
          </p>
        </div>
      )}

      {!carregando &&
        !erro &&
        agendaPorData.map(([data, itens]) => {
          const dataConvertida = criarDataLocal(data)!;

          return (
            <article
              key={data}
              className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"
            >
              <div className="flex flex-col justify-between gap-3 border-b border-slate-200 bg-slate-50 p-5 sm:flex-row sm:items-center">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-700">
                    Programação
                  </p>

                  <h3 className="mt-1 text-xl font-bold text-slate-900">
                    {formatarData(data)}
                  </h3>
                </div>

                <span className="rounded-full bg-slate-200 px-3 py-1 text-xs font-bold text-slate-700">
                  {itens.length} {itens.length === 1 ? "coleta" : "coletas"}
                </span>
              </div>

              <div className="grid gap-4 p-5 xl:grid-cols-2">
                {itens.map((item) => {
                  const visual = classeSituacao(item);
                  const coleta = item.coleta;

                  return (
                    <div
                      key={coleta.id}
                      className={`relative overflow-hidden rounded-2xl border p-5 ${visual.card}`}
                    >
                      <div
                        className={`absolute bottom-0 left-0 top-0 w-1.5 ${visual.faixa}`}
                      />

                      <div className="pl-3">
                        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                          <div>
                            <span
                              className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${visual.selo}`}
                            >
                              {visual.titulo}
                            </span>

                            <h4 className="mt-3 text-lg font-black text-slate-900">
                              {coleta.numero_ov || `Coleta #${coleta.id}`}
                            </h4>

                            <p className="mt-1 text-sm font-semibold text-slate-700">
                              {[coleta.cliente, coleta.loja]
                                .filter(Boolean)
                                .join(" • ") || "Cliente não informado"}
                            </p>
                          </div>

                          <div className="rounded-xl bg-white/70 px-3 py-2 text-center">
                            <p className="text-xs font-bold uppercase text-slate-500">
                              Data
                            </p>

                            <p className="mt-1 text-lg font-black text-slate-900">
                              {formatarDataCurta(dataConvertida)}
                            </p>
                          </div>
                        </div>

                        <div className="mt-4 grid gap-3 sm:grid-cols-2">
                          <div className="rounded-xl border border-white/80 bg-white/60 p-3">
                            <p className="text-xs font-bold uppercase text-slate-500">
                              Transportadora
                            </p>

                            <p className="mt-1 truncate text-sm font-semibold text-slate-800">
                              {coleta.transportadora || "Não definida"}
                            </p>
                          </div>

                          <div className="rounded-xl border border-white/80 bg-white/60 p-3">
                            <p className="text-xs font-bold uppercase text-slate-500">
                              Localização
                            </p>

                            <p className="mt-1 truncate text-sm font-semibold text-slate-800">
                              {[coleta.cidade, coleta.estado]
                                .filter(Boolean)
                                .join(" / ") || "Não informada"}
                            </p>
                          </div>
                        </div>

                        {item.atrasada && (
                          <p className="mt-4 rounded-xl bg-red-100 p-3 text-sm font-bold text-red-800">
                            Atrasada há {Math.abs(item.diasDiferenca)}{" "}
                            {Math.abs(item.diasDiferenca) === 1
                              ? "dia"
                              : "dias"}.
                          </p>
                        )}

                        <div className="mt-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                          <p className="text-xs font-medium text-slate-500">
                            Solicitação: {formatarData(coleta.data_solicitacao)}
                          </p>

                          <Link
                            href={`/coletas/${coleta.id}/editar`}
                            className="rounded-xl bg-slate-900 px-4 py-2.5 text-center text-xs font-bold text-white transition hover:bg-slate-700"
                          >
                            Abrir coleta
                          </Link>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </article>
          );
        })}
    </section>
  );
}