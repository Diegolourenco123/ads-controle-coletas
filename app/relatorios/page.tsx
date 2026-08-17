"use client";

import { useEffect, useMemo, useState } from "react";
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
  data_nf: string | null;
  numero_nf: string | null;
  transportadora: string | null;
  data_prevista_coleta: string | null;
  data_coleta: string | null;
  conhecimento: string | null;
  data_chegada_ads: string | null;
  peso: number | null;
  destino: string | null;
  status: string | null;
  observacoes: string | null;
};

function formatarData(data: string | null) {
  if (!data) return "—";
  const valor = data.includes("T") ? data.split("T")[0] : data;
  const [ano, mes, dia] = valor.split("-");
  return ano && mes && dia ? `${dia}/${mes}/${ano}` : data;
}

function escaparCsv(valor: unknown) {
  const texto = valor === null || valor === undefined ? "" : String(valor);
  return `"${texto.replaceAll('"', '""')}"`;
}

function classeStatus(status: string | null) {
  if (status === "Aguardando NF") return "bg-amber-100 text-amber-700";
  if (status === "Em transporte") return "bg-blue-100 text-blue-700";
  if (status === "Recebido na ADS" || status === "Finalizado") {
    return "bg-emerald-100 text-emerald-700";
  }
  return "bg-violet-100 text-violet-700";
}

export default function RelatoriosPage() {
  const [coletas, setColetas] = useState<Coleta[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  const [pesquisa, setPesquisa] = useState("");
  const [status, setStatus] = useState("");
  const [cliente, setCliente] = useState("");
  const [transportadora, setTransportadora] = useState("");
  const [estado, setEstado] = useState("");
  const [dataInicial, setDataInicial] = useState("");
  const [dataFinal, setDataFinal] = useState("");

  const [pagina, setPagina] = useState(1);
  const [itensPorPagina, setItensPorPagina] = useState(50);

  useEffect(() => {
    async function carregarColetas() {
      setCarregando(true);
      setErro("");

      const { data, error } = await supabase
        .from("coletas")
        .select(
          "id, data_solicitacao, numero_ov, cliente, loja, cidade, estado, data_nf, numero_nf, transportadora, data_prevista_coleta, data_coleta, conhecimento, data_chegada_ads, peso, destino, status, observacoes",
        )
        .order("data_solicitacao", { ascending: false });

      if (error) {
        console.error(error);
        setErro(`Não foi possível carregar o relatório: ${error.message}`);
        setCarregando(false);
        return;
      }

      setColetas((data ?? []) as Coleta[]);
      setCarregando(false);
    }

    carregarColetas();

    const canal = supabase
      .channel("relatorios-tempo-real")
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

  const clientes = useMemo(
    () =>
      Array.from(new Set(coletas.map((item) => item.cliente).filter(Boolean)))
        .map(String)
        .sort(),
    [coletas],
  );

  const transportadoras = useMemo(
    () =>
      Array.from(
        new Set(coletas.map((item) => item.transportadora).filter(Boolean)),
      )
        .map(String)
        .sort(),
    [coletas],
  );

  const estados = useMemo(
    () =>
      Array.from(new Set(coletas.map((item) => item.estado).filter(Boolean)))
        .map(String)
        .sort(),
    [coletas],
  );

  const coletasFiltradas = useMemo(() => {
    const termo = pesquisa.trim().toLowerCase();

    return coletas.filter((coleta) => {
      const conteudo = [
        coleta.numero_ov,
        coleta.cliente,
        coleta.loja,
        coleta.cidade,
        coleta.estado,
        coleta.numero_nf,
        coleta.transportadora,
        coleta.conhecimento,
        coleta.destino,
        coleta.status,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const dataReferencia = coleta.data_solicitacao;

      return (
        (!termo || conteudo.includes(termo)) &&
        (!status || coleta.status === status) &&
        (!cliente || coleta.cliente === cliente) &&
        (!transportadora || coleta.transportadora === transportadora) &&
        (!estado || coleta.estado === estado) &&
        (!dataInicial ||
          Boolean(dataReferencia && dataReferencia >= dataInicial)) &&
        (!dataFinal ||
          Boolean(dataReferencia && dataReferencia <= dataFinal))
      );
    });
  }, [
    coletas,
    pesquisa,
    status,
    cliente,
    transportadora,
    estado,
    dataInicial,
    dataFinal,
  ]);

  useEffect(() => {
    setPagina(1);
  }, [
    pesquisa,
    status,
    cliente,
    transportadora,
    estado,
    dataInicial,
    dataFinal,
    itensPorPagina,
  ]);

  const indicadores = useMemo(() => {
    const pesoTotal = coletasFiltradas.reduce(
      (total, coleta) => total + (coleta.peso ?? 0),
      0,
    );

    return {
      total: coletasFiltradas.length,
      aguardandoNf: coletasFiltradas.filter(
        (coleta) => coleta.status === "Aguardando NF",
      ).length,
      emTransporte: coletasFiltradas.filter(
        (coleta) => coleta.status === "Em transporte",
      ).length,
      finalizadas: coletasFiltradas.filter(
        (coleta) =>
          coleta.status === "Finalizado" ||
          coleta.status === "Recebido na ADS",
      ).length,
      pesoTotal,
    };
  }, [coletasFiltradas]);

  const distribuicaoStatus = useMemo(() => {
    const mapa = new Map<string, number>();

    coletasFiltradas.forEach((coleta) => {
      const chave = coleta.status || "Sem status";
      mapa.set(chave, (mapa.get(chave) ?? 0) + 1);
    });

    return [...mapa.entries()]
      .map(([nome, valor]) => ({ nome, valor }))
      .sort((a, b) => b.valor - a.valor)
      .slice(0, 6);
  }, [coletasFiltradas]);

  const coletasPorMes = useMemo(() => {
    const mapa = new Map<string, number>();

    coletasFiltradas.forEach((coleta) => {
      if (!coleta.data_solicitacao) return;

      const chave = coleta.data_solicitacao.slice(0, 7);
      mapa.set(chave, (mapa.get(chave) ?? 0) + 1);
    });

    return [...mapa.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6)
      .map(([mes, valor]) => {
        const [ano, numeroMes] = mes.split("-");
        const rotulo = new Intl.DateTimeFormat("pt-BR", {
          month: "short",
        })
          .format(new Date(Number(ano), Number(numeroMes) - 1, 1))
          .replace(".", "");

        return {
          mes,
          rotulo: `${rotulo}/${ano.slice(2)}`,
          valor,
        };
      });
  }, [coletasFiltradas]);

  const maiorStatus = Math.max(
    1,
    ...distribuicaoStatus.map((item) => item.valor),
  );

  const maiorMes = Math.max(
    1,
    ...coletasPorMes.map((item) => item.valor),
  );

  const totalPaginas = Math.max(
    1,
    Math.ceil(coletasFiltradas.length / itensPorPagina),
  );

  const coletasPaginadas = useMemo(() => {
    const inicio = (pagina - 1) * itensPorPagina;

    return coletasFiltradas.slice(
      inicio,
      inicio + itensPorPagina,
    );
  }, [coletasFiltradas, pagina, itensPorPagina]);

  function limparFiltros() {
    setPesquisa("");
    setStatus("");
    setCliente("");
    setTransportadora("");
    setEstado("");
    setDataInicial("");
    setDataFinal("");
    setPagina(1);
  }

  function exportarCsv() {
    const cabecalho = [
      "ID",
      "Data da solicitação",
      "OV",
      "Cliente",
      "Unidade",
      "Cidade",
      "Estado",
      "Data da NF",
      "Número da NF",
      "Transportadora",
      "Data prevista da coleta",
      "Data efetiva da coleta",
      "Conhecimento",
      "Chegada na ADS",
      "Peso (kg)",
      "Destino",
      "Status",
      "Observações",
    ];

    const linhas = coletasFiltradas.map((coleta) => [
      coleta.id,
      formatarData(coleta.data_solicitacao),
      coleta.numero_ov ?? "",
      coleta.cliente ?? "",
      coleta.loja ?? "",
      coleta.cidade ?? "",
      coleta.estado ?? "",
      formatarData(coleta.data_nf),
      coleta.numero_nf ?? "",
      coleta.transportadora ?? "",
      formatarData(coleta.data_prevista_coleta),
      formatarData(coleta.data_coleta),
      coleta.conhecimento ?? "",
      formatarData(coleta.data_chegada_ads),
      coleta.peso ?? "",
      coleta.destino ?? "",
      coleta.status ?? "",
      coleta.observacoes ?? "",
    ]);

    const csv = [
      cabecalho.map(escaparCsv).join(";"),
      ...linhas.map((linha) => linha.map(escaparCsv).join(";")),
    ].join("\n");

    const arquivo = new Blob([`\uFEFF${csv}`], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(arquivo);
    const link = document.createElement("a");
    link.href = url;
    link.download = `relatorio-coletas-${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  const inicioExibicao =
    coletasFiltradas.length === 0
      ? 0
      : (pagina - 1) * itensPorPagina + 1;

  const fimExibicao = Math.min(
    pagina * itensPorPagina,
    coletasFiltradas.length,
  );

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <Header />

      <div className="mx-auto grid max-w-[1500px] grid-cols-1 lg:grid-cols-[230px_1fr]">
        <Sidebar />

        <section className="min-w-0 p-5 md:p-8">
          {/* CABEÇALHO */}
          <div className="mb-6 flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
            <div>
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />

                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-700">
                  Gestão e indicadores
                </p>
              </div>

              <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950">
                Relatórios
              </h2>

              <p className="mt-1.5 text-sm text-slate-500">
                Filtre, analise, imprima e exporte os dados operacionais.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row print:hidden">
              <button
                type="button"
                onClick={() => window.print()}
                className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
              >
                Imprimir relatório
              </button>

              <button
                type="button"
                onClick={exportarCsv}
                disabled={coletasFiltradas.length === 0}
                className="rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Exportar para Excel
              </button>
            </div>
          </div>

          {erro && (
            <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
              {erro}
            </div>
          )}

          {/* INDICADORES */}
          <section className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {[
              ["Total filtrado", indicadores.total, "Coletas", "bg-blue-500"],
              [
                "Aguardando NF",
                indicadores.aguardandoNf,
                "Pendências",
                "bg-amber-500",
              ],
              [
                "Em transporte",
                indicadores.emTransporte,
                "Em andamento",
                "bg-violet-500",
              ],
              [
                "Recebidas/finalizadas",
                indicadores.finalizadas,
                "Concluídas",
                "bg-emerald-500",
              ],
              [
                "Peso total",
                indicadores.pesoTotal.toLocaleString("pt-BR", {
                  maximumFractionDigits: 2,
                }),
                "Quilogramas",
                "bg-slate-500",
              ],
            ].map(([titulo, valor, detalhe, cor]) => (
              <article
                key={String(titulo)}
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${cor}`} />
                  <p className="text-xs font-semibold text-slate-500">
                    {titulo}
                  </p>
                </div>

                <p className="mt-2 text-2xl font-black text-slate-900">
                  {valor}
                </p>

                <p className="mt-1 text-[11px] text-slate-400">
                  {detalhe}
                </p>
              </article>
            ))}
          </section>

          {/* FILTROS */}
          <article className="mb-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm print:hidden">
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Filtros do relatório
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  Combine os filtros para gerar uma consulta específica.
                </p>
              </div>

              <button
                type="button"
                onClick={limparFiltros}
                className="text-xs font-bold text-emerald-700 hover:text-emerald-800"
              >
                Limpar filtros
              </button>
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <input
                type="search"
                value={pesquisa}
                onChange={(evento) => setPesquisa(evento.target.value)}
                placeholder="Pesquisar OV, NF, cidade..."
                className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none transition focus:border-emerald-500 focus:bg-white"
              />

              <select
                value={cliente}
                onChange={(evento) => setCliente(evento.target.value)}
                className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none transition focus:border-emerald-500 focus:bg-white"
              >
                <option value="">Todos os clientes</option>
                {clientes.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>

              <select
                value={transportadora}
                onChange={(evento) => setTransportadora(evento.target.value)}
                className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none transition focus:border-emerald-500 focus:bg-white"
              >
                <option value="">Todas as transportadoras</option>
                {transportadoras.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>

              <select
                value={status}
                onChange={(evento) => setStatus(evento.target.value)}
                className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none transition focus:border-emerald-500 focus:bg-white"
              >
                <option value="">Todos os status</option>
                <option value="Aguardando NF">Aguardando NF</option>
                <option value="Aguardando coleta">Aguardando coleta</option>
                <option value="Coleta realizada">Coleta realizada</option>
                <option value="Em transporte">Em transporte</option>
                <option value="Recebido na ADS">Recebido na ADS</option>
                <option value="Finalizado">Finalizado</option>
              </select>

              <select
                value={estado}
                onChange={(evento) => setEstado(evento.target.value)}
                className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none transition focus:border-emerald-500 focus:bg-white"
              >
                <option value="">Todos os estados</option>
                {estados.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>

              <label className="text-xs font-semibold text-slate-600">
                Data inicial
                <input
                  type="date"
                  value={dataInicial}
                  onChange={(evento) => setDataInicial(evento.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none transition focus:border-emerald-500 focus:bg-white"
                />
              </label>

              <label className="text-xs font-semibold text-slate-600">
                Data final
                <input
                  type="date"
                  value={dataFinal}
                  onChange={(evento) => setDataFinal(evento.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none transition focus:border-emerald-500 focus:bg-white"
                />
              </label>
            </div>
          </article>

          {/* GRÁFICOS */}
          <section className="mb-5 grid gap-4 xl:grid-cols-2 print:hidden">
            <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Distribuição por status
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  Visão resumida dos principais status do filtro atual.
                </p>
              </div>

              <div className="mt-5 space-y-3">
                {distribuicaoStatus.length === 0 ? (
                  <p className="text-sm text-slate-400">
                    Sem dados para exibir.
                  </p>
                ) : (
                  distribuicaoStatus.map((item) => (
                    <div key={item.nome}>
                      <div className="mb-1.5 flex items-center justify-between gap-3">
                        <span className="truncate text-xs font-semibold text-slate-600">
                          {item.nome}
                        </span>
                        <span className="text-xs font-black text-slate-800">
                          {item.valor}
                        </span>
                      </div>

                      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-emerald-500"
                          style={{
                            width: `${Math.max(
                              6,
                              (item.valor / maiorStatus) * 100,
                            )}%`,
                          }}
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </article>

            <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Coletas por mês
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  Últimos 6 meses presentes no resultado filtrado.
                </p>
              </div>

              <div className="mt-6 flex h-44 items-end gap-3">
                {coletasPorMes.length === 0 ? (
                  <p className="self-start text-sm text-slate-400">
                    Sem dados para exibir.
                  </p>
                ) : (
                  coletasPorMes.map((item) => (
                    <div
                      key={item.mes}
                      className="flex min-w-0 flex-1 flex-col items-center justify-end"
                    >
                      <span className="mb-2 text-[11px] font-black text-slate-700">
                        {item.valor}
                      </span>

                      <div className="flex h-32 w-full items-end rounded-xl bg-slate-50 px-2">
                        <div
                          className="w-full rounded-t-lg bg-emerald-500"
                          style={{
                            height: `${Math.max(
                              12,
                              (item.valor / maiorMes) * 100,
                            )}%`,
                          }}
                        />
                      </div>

                      <span className="mt-2 text-[10px] font-semibold text-slate-500">
                        {item.rotulo}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </article>
          </section>

          {/* RESULTADOS */}
          <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col justify-between gap-3 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Resultado do relatório
                </h3>

                <p className="mt-1 text-xs text-slate-500">
                  {coletasFiltradas.length} registro(s) encontrado(s)
                </p>
              </div>

              <div className="flex items-center gap-2 print:hidden">
                <span className="text-xs font-semibold text-slate-500">
                  Exibir
                </span>

                <select
                  value={itensPorPagina}
                  onChange={(evento) =>
                    setItensPorPagina(Number(evento.target.value))
                  }
                  className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:border-emerald-500"
                >
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[1320px] text-left">
                <thead className="border-b border-slate-200 bg-slate-50/70 text-[10px] uppercase tracking-wide text-slate-400">
                  <tr>
                    <th className="px-4 py-3.5">Solicitação</th>
                    <th className="px-4 py-3.5">OV</th>
                    <th className="px-4 py-3.5">Cliente / Unidade</th>
                    <th className="px-4 py-3.5">Cidade / UF</th>
                    <th className="px-4 py-3.5">NF</th>
                    <th className="px-4 py-3.5">Transportadora</th>
                    <th className="px-4 py-3.5">Coleta</th>
                    <th className="px-4 py-3.5">Chegada ADS</th>
                    <th className="px-4 py-3.5">Peso</th>
                    <th className="px-4 py-3.5">Status</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100 text-sm">
                  {carregando && (
                    <tr>
                      <td
                        colSpan={10}
                        className="px-5 py-12 text-center text-slate-500"
                      >
                        Carregando relatório...
                      </td>
                    </tr>
                  )}

                  {!carregando && coletasFiltradas.length === 0 && (
                    <tr>
                      <td
                        colSpan={10}
                        className="px-5 py-12 text-center text-slate-500"
                      >
                        Nenhum registro encontrado para os filtros selecionados.
                      </td>
                    </tr>
                  )}

                  {!carregando &&
                    coletasPaginadas.map((coleta) => (
                      <tr
                        key={coleta.id}
                        className="transition hover:bg-slate-50/70"
                      >
                        <td className="whitespace-nowrap px-4 py-3.5 text-slate-600">
                          {formatarData(coleta.data_solicitacao)}
                        </td>

                        <td className="whitespace-nowrap px-4 py-3.5 font-black text-emerald-700">
                          {coleta.numero_ov || `#${coleta.id}`}
                        </td>

                        <td className="px-4 py-3.5">
                          <p className="font-bold text-slate-800">
                            {coleta.cliente || "Cliente não informado"}
                          </p>

                          <p className="mt-1 max-w-[260px] text-xs text-slate-500">
                            {coleta.loja || "Unidade não informada"}
                          </p>
                        </td>

                        <td className="whitespace-nowrap px-4 py-3.5 text-slate-600">
                          {[coleta.cidade, coleta.estado]
                            .filter(Boolean)
                            .join("/") || "—"}
                        </td>

                        <td className="whitespace-nowrap px-4 py-3.5 text-slate-600">
                          {coleta.numero_nf || "Aguardando"}
                        </td>

                        <td className="max-w-[220px] px-4 py-3.5 text-slate-600">
                          {coleta.transportadora || "Não definida"}
                        </td>

                        <td className="whitespace-nowrap px-4 py-3.5 text-slate-600">
                          {formatarData(
                            coleta.data_coleta ||
                              coleta.data_prevista_coleta,
                          )}
                        </td>

                        <td className="whitespace-nowrap px-4 py-3.5 text-slate-600">
                          {formatarData(coleta.data_chegada_ads)}
                        </td>

                        <td className="whitespace-nowrap px-4 py-3.5 text-slate-600">
                          {coleta.peso !== null
                            ? `${coleta.peso.toLocaleString("pt-BR")} kg`
                            : "—"}
                        </td>

                        <td className="whitespace-nowrap px-4 py-3.5">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ${classeStatus(
                              coleta.status,
                            )}`}
                          >
                            {coleta.status || "Sem status"}
                          </span>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>

            {!carregando && coletasFiltradas.length > 0 && (
              <div className="flex flex-col justify-between gap-3 border-t border-slate-200 bg-slate-50/50 px-5 py-4 sm:flex-row sm:items-center print:hidden">
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
                    {coletasFiltradas.length}
                  </span>{" "}
                  registro(s)
                </p>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      setPagina((atual) => Math.max(1, atual - 1))
                    }
                    disabled={pagina === 1}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Anterior
                  </button>

                  <span className="px-2 text-xs font-bold text-slate-600">
                    Página {pagina} de {totalPaginas}
                  </span>

                  <button
                    type="button"
                    onClick={() =>
                      setPagina((atual) =>
                        Math.min(totalPaginas, atual + 1),
                      )
                    }
                    disabled={pagina === totalPaginas}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Próxima
                  </button>
                </div>
              </div>
            )}
          </article>
        </section>
      </div>
    </main>
  );
}