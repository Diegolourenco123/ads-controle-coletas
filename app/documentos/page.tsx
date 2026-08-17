"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import Header from "../components/Header";
import Sidebar from "../components/Sidebar";
import { supabase } from "../lib/supabase";

type Coleta = {
  id: number;
  data_solicitacao: string | null;
  cliente: string | null;
  loja: string | null;
  cidade: string | null;
  estado: string | null;
  numero_ov: string | null;
  numero_nf: string | null;
  conhecimento: string | null;
  numero_nf_cobranca_ads: string | null;
  transportadora: string | null;
  arquivo_nf_cliente: string | null;
  arquivo_cte: string | null;
  arquivo_nf_cobranca_ads: string | null;
};

type TipoDocumento = "nf-cliente" | "cte" | "nf-ads";

type Documento = {
  chave: string;
  coletaId: number;
  tipo: TipoDocumento;
  tipoLabel: string;
  sigla: string;
  caminho: string;
  numero: string | null;
  dataSolicitacao: string | null;
  ov: string | null;
  cliente: string | null;
  loja: string | null;
  cidade: string | null;
  estado: string | null;
  transportadora: string | null;
};

const BUCKET_DOCUMENTOS = "documentos-coletas";

function formatarData(data: string | null) {
  if (!data) return "—";
  const [ano, mes, dia] = data.split("-");
  return ano && mes && dia ? `${dia}/${mes}/${ano}` : data;
}

function normalizarTexto(texto: string | null | undefined) {
  return (texto ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function nomeArquivo(caminho: string) {
  const partes = caminho.split("/");
  return partes[partes.length - 1] || caminho;
}

export default function DocumentosPage() {
  const [coletas, setColetas] = useState<Coleta[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [pesquisa, setPesquisa] = useState("");
  const [tipo, setTipo] = useState("");
  const [cliente, setCliente] = useState("");
  const [transportadora, setTransportadora] = useState("");
  const [estado, setEstado] = useState("");
  const [abrindo, setAbrindo] = useState<string | null>(null);
  const [pagina, setPagina] = useState(1);
  const [itensPorPagina, setItensPorPagina] = useState(15);

  useEffect(() => {
    async function carregar() {
      setCarregando(true);
      setErro("");

      const { data, error } = await supabase
        .from("coletas")
        .select(
          "id, data_solicitacao, cliente, loja, cidade, estado, numero_ov, numero_nf, conhecimento, numero_nf_cobranca_ads, transportadora, arquivo_nf_cliente, arquivo_cte, arquivo_nf_cobranca_ads",
        )
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Erro ao carregar documentos:", error);
        setErro("Não foi possível carregar a Central de Documentos.");
        setCarregando(false);
        return;
      }

      setColetas((data ?? []) as Coleta[]);
      setCarregando(false);
    }

    carregar();

    const canal = supabase
      .channel("central-documentos")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "coletas" },
        carregar,
      )
      .subscribe();

    return () => {
      supabase.removeChannel(canal);
    };
  }, []);

  const documentos = useMemo<Documento[]>(() => {
    const lista: Documento[] = [];

    for (const coleta of coletas) {
      if (coleta.arquivo_nf_cliente) {
        lista.push({
          chave: `${coleta.id}-nf-cliente`,
          coletaId: coleta.id,
          tipo: "nf-cliente",
          tipoLabel: "Nota Fiscal do cliente",
          sigla: "NF",
          caminho: coleta.arquivo_nf_cliente,
          numero: coleta.numero_nf,
          dataSolicitacao: coleta.data_solicitacao,
          ov: coleta.numero_ov,
          cliente: coleta.cliente,
          loja: coleta.loja,
          cidade: coleta.cidade,
          estado: coleta.estado,
          transportadora: coleta.transportadora,
        });
      }

      if (coleta.arquivo_cte) {
        lista.push({
          chave: `${coleta.id}-cte`,
          coletaId: coleta.id,
          tipo: "cte",
          tipoLabel: "Conhecimento / CT-e",
          sigla: "CT",
          caminho: coleta.arquivo_cte,
          numero: coleta.conhecimento,
          dataSolicitacao: coleta.data_solicitacao,
          ov: coleta.numero_ov,
          cliente: coleta.cliente,
          loja: coleta.loja,
          cidade: coleta.cidade,
          estado: coleta.estado,
          transportadora: coleta.transportadora,
        });
      }

      if (coleta.arquivo_nf_cobranca_ads) {
        lista.push({
          chave: `${coleta.id}-nf-ads`,
          coletaId: coleta.id,
          tipo: "nf-ads",
          tipoLabel: "NF de cobrança ADS",
          sigla: "CA",
          caminho: coleta.arquivo_nf_cobranca_ads,
          numero: coleta.numero_nf_cobranca_ads,
          dataSolicitacao: coleta.data_solicitacao,
          ov: coleta.numero_ov,
          cliente: coleta.cliente,
          loja: coleta.loja,
          cidade: coleta.cidade,
          estado: coleta.estado,
          transportadora: coleta.transportadora,
        });
      }
    }

    return lista;
  }, [coletas]);

  const clientes = useMemo(
    () =>
      Array.from(
        new Set(documentos.map((item) => item.cliente).filter(Boolean) as string[]),
      ).sort((a, b) => a.localeCompare(b, "pt-BR")),
    [documentos],
  );

  const transportadoras = useMemo(
    () =>
      Array.from(
        new Set(
          documentos.map((item) => item.transportadora).filter(Boolean) as string[],
        ),
      ).sort((a, b) => a.localeCompare(b, "pt-BR")),
    [documentos],
  );

  const estados = useMemo(
    () =>
      Array.from(
        new Set(documentos.map((item) => item.estado).filter(Boolean) as string[]),
      ).sort(),
    [documentos],
  );

  const documentosFiltrados = useMemo(() => {
    const termo = normalizarTexto(pesquisa);

    return documentos.filter((documento) => {
      const conteudo = normalizarTexto(
        [
          documento.ov,
          documento.cliente,
          documento.loja,
          documento.cidade,
          documento.estado,
          documento.numero,
          documento.transportadora,
          documento.tipoLabel,
          nomeArquivo(documento.caminho),
        ]
          .filter(Boolean)
          .join(" "),
      );

      return (
        (!termo || conteudo.includes(termo)) &&
        (!tipo || documento.tipo === tipo) &&
        (!cliente || documento.cliente === cliente) &&
        (!transportadora || documento.transportadora === transportadora) &&
        (!estado || documento.estado === estado)
      );
    });
  }, [documentos, pesquisa, tipo, cliente, transportadora, estado]);

  useEffect(() => {
    setPagina(1);
  }, [pesquisa, tipo, cliente, transportadora, estado, itensPorPagina]);

  const totalPaginas = Math.max(
    1,
    Math.ceil(documentosFiltrados.length / itensPorPagina),
  );
  const paginaSegura = Math.min(pagina, totalPaginas);
  const inicio = (paginaSegura - 1) * itensPorPagina;
  const fim = Math.min(inicio + itensPorPagina, documentosFiltrados.length);
  const documentosPaginados = documentosFiltrados.slice(inicio, fim);

  const contadores = useMemo(
    () => ({
      total: documentos.length,
      nfCliente: documentos.filter((d) => d.tipo === "nf-cliente").length,
      cte: documentos.filter((d) => d.tipo === "cte").length,
      nfAds: documentos.filter((d) => d.tipo === "nf-ads").length,
    }),
    [documentos],
  );

  async function abrirDocumento(documento: Documento) {
    setAbrindo(documento.chave);
    setErro("");

    const { data, error } = await supabase.storage
      .from(BUCKET_DOCUMENTOS)
      .createSignedUrl(documento.caminho, 60 * 10);

    if (error || !data?.signedUrl) {
      console.error("Erro ao abrir documento:", error);
      setErro(
        "Não foi possível abrir o documento. Verifique as permissões do Storage.",
      );
      setAbrindo(null);
      return;
    }

    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    setAbrindo(null);
  }

  function limparFiltros() {
    setPesquisa("");
    setTipo("");
    setCliente("");
    setTransportadora("");
    setEstado("");
  }

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <Header />

      <div className="mx-auto grid max-w-[1600px] grid-cols-1 lg:grid-cols-[230px_1fr]">
        <Sidebar />

        <section className="min-w-0 p-5 md:p-8">
          <div className="mb-6 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">
                Gestão documental
              </p>
              <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950">
                Central de Documentos
              </h2>
              <p className="mt-1.5 max-w-2xl text-sm text-slate-500">
                Consulte rapidamente Notas Fiscais, CT-es e cobranças vinculadas
                às coletas.
              </p>
            </div>

            <Link
              href="/coletas"
              className="inline-flex w-fit rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Ver todas as coletas
            </Link>
          </div>

          <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              ["Total de documentos", contadores.total, "Todos os arquivos vinculados"],
              ["Notas Fiscais", contadores.nfCliente, "Documentos dos clientes"],
              ["CT-es", contadores.cte, "Conhecimentos de transporte"],
              ["NFs de cobrança ADS", contadores.nfAds, "Cobranças emitidas pela ADS"],
            ].map(([titulo, valor, detalhe]) => (
              <div
                key={String(titulo)}
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <p className="text-xs font-semibold text-slate-500">{titulo}</p>
                <p className="mt-1 text-2xl font-black text-slate-900">
                  {carregando ? "..." : String(valor).padStart(2, "0")}
                </p>
                <p className="mt-1 text-xs text-slate-400">{detalhe}</p>
              </div>
            ))}
          </div>

          <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 p-5">
              <div className="grid gap-3 lg:grid-cols-5">
                <input
                  type="search"
                  value={pesquisa}
                  onChange={(e) => setPesquisa(e.target.value)}
                  placeholder="Pesquisar OV, cliente, NF, CT-e..."
                  className="rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-emerald-600 lg:col-span-2"
                />

                <select
                  value={tipo}
                  onChange={(e) => setTipo(e.target.value)}
                  className="rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-emerald-600"
                >
                  <option value="">Todos os documentos</option>
                  <option value="nf-cliente">Nota Fiscal do cliente</option>
                  <option value="cte">Conhecimento / CT-e</option>
                  <option value="nf-ads">NF de cobrança ADS</option>
                </select>

                <select
                  value={cliente}
                  onChange={(e) => setCliente(e.target.value)}
                  className="rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-emerald-600"
                >
                  <option value="">Todos os clientes</option>
                  {clientes.map((item) => (
                    <option key={item} value={item}>{item}</option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={limparFiltros}
                  className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Limpar filtros
                </button>
              </div>

              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <select
                  value={transportadora}
                  onChange={(e) => setTransportadora(e.target.value)}
                  className="rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-emerald-600"
                >
                  <option value="">Todas as transportadoras</option>
                  {transportadoras.map((item) => (
                    <option key={item} value={item}>{item}</option>
                  ))}
                </select>

                <select
                  value={estado}
                  onChange={(e) => setEstado(e.target.value)}
                  className="rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-emerald-600"
                >
                  <option value="">Todos os estados</option>
                  {estados.map((item) => (
                    <option key={item} value={item}>{item}</option>
                  ))}
                </select>
              </div>
            </div>

            {erro && (
              <div className="m-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                {erro}
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full min-w-[1180px] text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-500">
                      Solicitação
                    </th>
                    <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-500">
                      OV
                    </th>
                    <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-500">
                      Cliente / Unidade
                    </th>
                    <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-500">
                      Documento
                    </th>
                    <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-500">
                      Número
                    </th>
                    <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-500">
                      Transportadora
                    </th>
                    <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-500">
                      Ações
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {carregando && (
                    <tr>
                      <td colSpan={7} className="px-5 py-12 text-center text-slate-500">
                        Carregando documentos...
                      </td>
                    </tr>
                  )}

                  {!carregando && documentosPaginados.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-5 py-12 text-center text-slate-500">
                        Nenhum documento encontrado.
                      </td>
                    </tr>
                  )}

                  {!carregando &&
                    documentosPaginados.map((documento) => (
                      <tr key={documento.chave} className="hover:bg-slate-50/80">
                        <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                          {formatarData(documento.dataSolicitacao)}
                        </td>

                        <td className="whitespace-nowrap px-4 py-3">
                          <span className="rounded-lg bg-emerald-50 px-2.5 py-1.5 font-bold text-emerald-700">
                            {documento.ov || `#${documento.coletaId}`}
                          </span>
                        </td>

                        <td className="max-w-[280px] px-4 py-3">
                          <p className="font-semibold text-slate-900">
                            {documento.cliente || "Cliente não informado"}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            {[documento.loja, documento.cidade, documento.estado]
                              .filter(Boolean)
                              .join(" • ") || "Unidade não informada"}
                          </p>
                        </td>

                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-[11px] font-black text-slate-700">
                              {documento.sigla}
                            </span>
                            <div className="min-w-0">
                              <p className="font-semibold text-slate-800">
                                {documento.tipoLabel}
                              </p>
                              <p
                                title={nomeArquivo(documento.caminho)}
                                className="max-w-[210px] truncate text-[11px] text-slate-400"
                              >
                                {nomeArquivo(documento.caminho)}
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-700">
                          {documento.numero || "—"}
                        </td>

                        <td className="max-w-[180px] px-4 py-3 text-slate-600">
                          {documento.transportadora || "—"}
                        </td>

                        <td className="whitespace-nowrap px-4 py-3">
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => abrirDocumento(documento)}
                              disabled={abrindo === documento.chave}
                              className="rounded-lg bg-slate-800 px-3 py-2 text-xs font-bold text-white transition hover:bg-slate-900 disabled:opacity-50"
                            >
                              {abrindo === documento.chave
                                ? "Abrindo..."
                                : "Abrir documento"}
                            </button>

                            <Link
                              href={`/coletas/${documento.coletaId}`}
                              className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700 transition hover:bg-emerald-100"
                            >
                              Abrir coleta
                            </Link>
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>

            {!carregando && documentosFiltrados.length > 0 && (
              <div className="flex flex-col gap-4 border-t border-slate-200 bg-slate-50/50 px-5 py-4 md:flex-row md:items-center md:justify-between">
                <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
                  <span>
                    Mostrando <strong>{inicio + 1}</strong> a <strong>{fim}</strong> de{" "}
                    <strong>{documentosFiltrados.length}</strong>
                  </span>

                  <select
                    value={itensPorPagina}
                    onChange={(e) => setItensPorPagina(Number(e.target.value))}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                  >
                    <option value={15}>15 por página</option>
                    <option value={30}>30 por página</option>
                    <option value={50}>50 por página</option>
                  </select>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    disabled={paginaSegura === 1}
                    onClick={() => setPagina((p) => Math.max(1, p - 1))}
                    className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold disabled:opacity-40"
                  >
                    Anterior
                  </button>

                  <span className="text-sm font-semibold text-slate-700">
                    {paginaSegura} de {totalPaginas}
                  </span>

                  <button
                    type="button"
                    disabled={paginaSegura === totalPaginas}
                    onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))}
                    className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold disabled:opacity-40"
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