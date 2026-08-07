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
        (!dataFinal || Boolean(dataReferencia && dataReferencia <= dataFinal))
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

  function limparFiltros() {
    setPesquisa("");
    setStatus("");
    setCliente("");
    setTransportadora("");
    setEstado("");
    setDataInicial("");
    setDataFinal("");
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

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <Header />

      <div className="mx-auto grid max-w-[1500px] grid-cols-1 lg:grid-cols-[230px_1fr]">
        <Sidebar />

        <section className="min-w-0 p-5 md:p-8">
          <div className="mb-7 flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
            <div>
              <p className="text-sm font-medium text-emerald-700">
                Gestão e indicadores
              </p>
              <h2 className="mt-1 text-3xl font-bold">Relatórios</h2>
              <p className="mt-1 text-sm text-slate-500">
                Filtre, consulte, imprima e exporte os dados operacionais.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => window.print()}
                className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Imprimir relatório
              </button>

              <button
                type="button"
                onClick={exportarCsv}
                disabled={coletasFiltradas.length === 0}
                className="rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
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

          <section className="mb-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            {[
              ["Total filtrado", indicadores.total, "Coletas"],
              ["Aguardando NF", indicadores.aguardandoNf, "Pendências"],
              ["Em transporte", indicadores.emTransporte, "Em andamento"],
              [
                "Recebidas/finalizadas",
                indicadores.finalizadas,
                "Concluídas",
              ],
              [
                "Peso total",
                indicadores.pesoTotal.toLocaleString("pt-BR", {
                  maximumFractionDigits: 2,
                }),
                "Quilogramas",
              ],
            ].map(([titulo, valor, detalhe]) => (
              <article
                key={String(titulo)}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <p className="text-sm font-medium text-slate-500">
                  {titulo}
                </p>
                <p className="mt-2 text-3xl font-bold">{valor}</p>
                <p className="mt-1 text-xs text-slate-400">{detalhe}</p>
              </article>
            ))}
          </section>

          <article className="mb-7 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm print:hidden">
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold">Filtros do relatório</h3>
                <p className="text-sm text-slate-500">
                  Combine os filtros para gerar uma consulta específica.
                </p>
              </div>

              <button
                type="button"
                onClick={limparFiltros}
                className="text-sm font-semibold text-emerald-700 hover:text-emerald-800"
              >
                Limpar filtros
              </button>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <input
                type="search"
                value={pesquisa}
                onChange={(evento) => setPesquisa(evento.target.value)}
                placeholder="Pesquisar OV, NF, cidade..."
                className="rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-emerald-600"
              />

              <select
                value={cliente}
                onChange={(evento) => setCliente(evento.target.value)}
                className="rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-emerald-600"
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
                className="rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-emerald-600"
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
                className="rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-emerald-600"
              >
                <option value="">Todos os status</option>
                <option value="Aguardando NF">Aguardando NF</option>
                <option value="Aguardando transportadora">
                  Aguardando transportadora
                </option>
                <option value="Coleta solicitada">Coleta solicitada</option>
                <option value="Coleta agendada">Coleta agendada</option>
                <option value="Em transporte">Em transporte</option>
                <option value="Recebido na ADS">Recebido na ADS</option>
                <option value="Finalizado">Finalizado</option>
              </select>

              <select
                value={estado}
                onChange={(evento) => setEstado(evento.target.value)}
                className="rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-emerald-600"
              >
                <option value="">Todos os estados</option>
                {estados.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>

              <label className="text-sm font-semibold text-slate-700">
                Data inicial
                <input
                  type="date"
                  value={dataInicial}
                  onChange={(evento) => setDataInicial(evento.target.value)}
                  className="mt-2 w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-emerald-600"
                />
              </label>

              <label className="text-sm font-semibold text-slate-700">
                Data final
                <input
                  type="date"
                  value={dataFinal}
                  onChange={(evento) => setDataFinal(evento.target.value)}
                  className="mt-2 w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-emerald-600"
                />
              </label>
            </div>
          </article>

          <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 p-5">
              <h3 className="text-lg font-bold">Resultado do relatório</h3>
              <p className="text-sm text-slate-500">
                {coletasFiltradas.length} registro(s) encontrado(s)
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[1350px] text-left">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-4">Solicitação</th>
                    <th className="px-4 py-4">OV</th>
                    <th className="px-4 py-4">Cliente / Unidade</th>
                    <th className="px-4 py-4">Cidade / UF</th>
                    <th className="px-4 py-4">NF</th>
                    <th className="px-4 py-4">Transportadora</th>
                    <th className="px-4 py-4">Coleta</th>
                    <th className="px-4 py-4">Chegada ADS</th>
                    <th className="px-4 py-4">Peso</th>
                    <th className="px-4 py-4">Status</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100 text-sm">
                  {carregando && (
                    <tr>
                      <td
                        colSpan={10}
                        className="px-5 py-8 text-center text-slate-500"
                      >
                        Carregando relatório...
                      </td>
                    </tr>
                  )}

                  {!carregando && coletasFiltradas.length === 0 && (
                    <tr>
                      <td
                        colSpan={10}
                        className="px-5 py-8 text-center text-slate-500"
                      >
                        Nenhum registro encontrado para os filtros selecionados.
                      </td>
                    </tr>
                  )}

                  {!carregando &&
                    coletasFiltradas.map((coleta) => (
                      <tr
                        key={coleta.id}
                        className="transition hover:bg-slate-50"
                      >
                        <td className="px-4 py-4">
                          {formatarData(coleta.data_solicitacao)}
                        </td>

                        <td className="px-4 py-4 font-semibold text-emerald-700">
                          {coleta.numero_ov || `#${coleta.id}`}
                        </td>

                        <td className="px-4 py-4">
                          <p className="font-medium">
                            {coleta.cliente || "Cliente não informado"}
                          </p>
                          <p className="text-xs text-slate-500">
                            {coleta.loja || "Unidade não informada"}
                          </p>
                        </td>

                        <td className="px-4 py-4">
                          {[coleta.cidade, coleta.estado]
                            .filter(Boolean)
                            .join("/") || "—"}
                        </td>

                        <td className="px-4 py-4">
                          {coleta.numero_nf || "Aguardando"}
                        </td>

                        <td className="px-4 py-4">
                          {coleta.transportadora || "Não definida"}
                        </td>

                        <td className="px-4 py-4">
                          {formatarData(
                            coleta.data_coleta ||
                              coleta.data_prevista_coleta,
                          )}
                        </td>

                        <td className="px-4 py-4">
                          {formatarData(coleta.data_chegada_ads)}
                        </td>

                        <td className="px-4 py-4">
                          {coleta.peso !== null
                            ? `${coleta.peso.toLocaleString("pt-BR")} kg`
                            : "—"}
                        </td>

                        <td className="px-4 py-4">
                          <span
                            className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${classeStatus(
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
          </article>
        </section>
      </div>
    </main>
  );
}