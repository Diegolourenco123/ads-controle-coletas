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

  numero_nf_cobranca_ads: string | null;
  data_emissao_nf_cobranca_ads: string | null;
  valor_nf_cobranca_ads: number | null;
  vencimento_nf_cobranca_ads: string | null;
  status_recebimento_ads: string | null;
  data_recebimento_pagamento_ads: string | null;
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

function formatarMoeda(valor: number | null | undefined) {
  return (valor ?? 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
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
          "id, data_solicitacao, numero_ov, cliente, loja, cidade, estado, data_nf, numero_nf, transportadora, data_prevista_coleta, data_coleta, conhecimento, data_chegada_ads, peso, destino, status, observacoes, numero_nf_cobranca_ads, data_emissao_nf_cobranca_ads, valor_nf_cobranca_ads, vencimento_nf_cobranca_ads, status_recebimento_ads, data_recebimento_pagamento_ads",
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

  const pagamentos2026 = useMemo(() => {
    return coletas
      .filter((coleta) => {
        if (!coleta.data_solicitacao?.startsWith("2026-")) return false;
        if (
          !coleta.data_emissao_nf_cobranca_ads ||
          !coleta.data_recebimento_pagamento_ads
        ) {
          return false;
        }

        return (
          diasEntreDatas(
            coleta.data_emissao_nf_cobranca_ads,
            coleta.data_recebimento_pagamento_ads,
          ) !== null
        );
      })
      .map((coleta) => ({
        ...coleta,
        dias_pagamento:
          diasEntreDatas(
            coleta.data_emissao_nf_cobranca_ads,
            coleta.data_recebimento_pagamento_ads,
          ) ?? 0,
      }))
      .sort((a, b) =>
        (b.data_emissao_nf_cobranca_ads ?? "").localeCompare(
          a.data_emissao_nf_cobranca_ads ?? "",
        ),
      );
  }, [coletas]);

  const indicadoresPagamento2026 = useMemo(() => {
    if (pagamentos2026.length === 0) {
      return {
        quantidade: 0,
        media: 0,
        menor: 0,
        maior: 0,
      };
    }

    const prazos = pagamentos2026.map((item) => item.dias_pagamento);
    const soma = prazos.reduce((total, dias) => total + dias, 0);

    return {
      quantidade: pagamentos2026.length,
      media: soma / pagamentos2026.length,
      menor: Math.min(...prazos),
      maior: Math.max(...prazos),
    };
  }, [pagamentos2026]);

  const rankingPagamentoLojas2026 = useMemo(() => {
    const mapa = new Map<
      string,
      {
        loja: string;
        quantidade: number;
        totalDias: number;
        menorPrazo: number;
        maiorPrazo: number;
        valorPago: number;
      }
    >();

    pagamentos2026.forEach((coleta) => {
      const nomeLoja = coleta.loja?.trim() || "Unidade não informada";
      const atual = mapa.get(nomeLoja);

      if (!atual) {
        mapa.set(nomeLoja, {
          loja: nomeLoja,
          quantidade: 1,
          totalDias: coleta.dias_pagamento,
          menorPrazo: coleta.dias_pagamento,
          maiorPrazo: coleta.dias_pagamento,
          valorPago: coleta.valor_nf_cobranca_ads ?? 0,
        });
        return;
      }

      atual.quantidade += 1;
      atual.totalDias += coleta.dias_pagamento;
      atual.menorPrazo = Math.min(atual.menorPrazo, coleta.dias_pagamento);
      atual.maiorPrazo = Math.max(atual.maiorPrazo, coleta.dias_pagamento);
      atual.valorPago += coleta.valor_nf_cobranca_ads ?? 0;
    });

    return [...mapa.values()]
      .map((item) => ({
        ...item,
        mediaDias: item.totalDias / item.quantidade,
      }))
      .sort((a, b) => b.mediaDias - a.mediaDias);
  }, [pagamentos2026]);

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

  function exportarPagamentos2026Csv() {
    const cabecalho = [
      "Loja / Unidade",
      "Cidade",
      "UF",
      "NF de cobrança ADS",
      "Data de emissão",
      "Data do pagamento",
      "Dias para pagamento",
      "Valor da NF",
      "Status de recebimento",
      "Data da solicitação",
      "OV",
    ];

    const linhas = pagamentos2026.map((coleta) => [
      coleta.loja ?? "",
      coleta.cidade ?? "",
      coleta.estado ?? "",
      coleta.numero_nf_cobranca_ads ?? "",
      formatarData(coleta.data_emissao_nf_cobranca_ads),
      formatarData(coleta.data_recebimento_pagamento_ads),
      coleta.dias_pagamento,
      coleta.valor_nf_cobranca_ads ?? "",
      coleta.status_recebimento_ads ?? "",
      formatarData(coleta.data_solicitacao),
      coleta.numero_ov ?? "",
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
    link.download = "prazo-pagamento-lojas-2026.csv";
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

          {/* PRAZO DE PAGAMENTO DAS LOJAS - 2026 */}
          <section className="mb-5">
            <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="flex flex-col justify-between gap-4 border-b border-slate-200 px-5 py-5 sm:flex-row sm:items-center">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-emerald-700">
                      Financeiro ADS
                    </p>
                  </div>

                  <h3 className="mt-2 text-lg font-black text-slate-950">
                    Prazo de pagamento das lojas — 2026
                  </h3>

                  <p className="mt-1 text-xs text-slate-500">
                    Diferença entre a emissão da NF de cobrança ADS e a data
                    efetiva do pagamento. Somente coletas com solicitação em
                    2026 e com as duas datas preenchidas entram no cálculo.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={exportarPagamentos2026Csv}
                  disabled={pagamentos2026.length === 0}
                  className="print:hidden rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs font-bold text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Exportar pagamentos 2026
                </button>
              </div>

              <div className="grid gap-3 border-b border-slate-200 bg-slate-50/40 p-5 sm:grid-cols-2 xl:grid-cols-4">
                {[
                  [
                    "Prazo médio",
                    `${indicadoresPagamento2026.media.toLocaleString("pt-BR", {
                      minimumFractionDigits: 1,
                      maximumFractionDigits: 1,
                    })} dias`,
                    "Média entre emissão e pagamento",
                  ],
                  [
                    "Menor prazo",
                    `${indicadoresPagamento2026.menor} dias`,
                    "Pagamento mais rápido",
                  ],
                  [
                    "Maior prazo",
                    `${indicadoresPagamento2026.maior} dias`,
                    "Pagamento mais demorado",
                  ],
                  [
                    "Notas analisadas",
                    indicadoresPagamento2026.quantidade,
                    "NF de cobrança ADS pagas",
                  ],
                ].map(([titulo, valor, detalhe]) => (
                  <div
                    key={String(titulo)}
                    className="rounded-xl border border-slate-200 bg-white p-4"
                  >
                    <p className="text-xs font-semibold text-slate-500">
                      {titulo}
                    </p>
                    <p className="mt-2 text-2xl font-black text-slate-900">
                      {valor}
                    </p>
                    <p className="mt-1 text-[11px] text-slate-400">
                      {detalhe}
                    </p>
                  </div>
                ))}
              </div>

              <div className="grid xl:grid-cols-[0.95fr_1.55fr]">
                <div className="border-b border-slate-200 p-5 xl:border-b-0 xl:border-r">
                  <div className="mb-4">
                    <h4 className="text-sm font-bold text-slate-900">
                      Ranking por loja
                    </h4>
                    <p className="mt-1 text-xs text-slate-500">
                      Da maior para a menor média de dias para pagamento.
                    </p>
                  </div>

                  <div className="max-h-[480px] overflow-auto rounded-xl border border-slate-200">
                    <table className="w-full min-w-[560px] text-left">
                      <thead className="sticky top-0 bg-slate-50 text-[10px] uppercase tracking-wide text-slate-400">
                        <tr>
                          <th className="px-4 py-3">Loja</th>
                          <th className="px-4 py-3 text-right">NF</th>
                          <th className="px-4 py-3 text-right">Média</th>
                          <th className="px-4 py-3 text-right">Menor</th>
                          <th className="px-4 py-3 text-right">Maior</th>
                        </tr>
                      </thead>

                      <tbody className="divide-y divide-slate-100 text-xs">
                        {rankingPagamentoLojas2026.length === 0 ? (
                          <tr>
                            <td
                              colSpan={5}
                              className="px-4 py-8 text-center text-slate-400"
                            >
                              Nenhum pagamento de 2026 com datas completas.
                            </td>
                          </tr>
                        ) : (
                          rankingPagamentoLojas2026.map((item) => (
                            <tr key={item.loja} className="hover:bg-slate-50">
                              <td className="px-4 py-3">
                                <p className="font-bold text-slate-800">
                                  {item.loja}
                                </p>
                                <p className="mt-0.5 text-[10px] text-slate-400">
                                  {formatarMoeda(item.valorPago)} pagos
                                </p>
                              </td>
                              <td className="px-4 py-3 text-right font-semibold text-slate-600">
                                {item.quantidade}
                              </td>
                              <td className="px-4 py-3 text-right font-black text-slate-900">
                                {item.mediaDias.toLocaleString("pt-BR", {
                                  minimumFractionDigits: 1,
                                  maximumFractionDigits: 1,
                                })}{" "}
                                dias
                              </td>
                              <td className="px-4 py-3 text-right text-slate-600">
                                {item.menorPrazo} dias
                              </td>
                              <td className="px-4 py-3 text-right text-slate-600">
                                {item.maiorPrazo} dias
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="p-5">
                  <div className="mb-4">
                    <h4 className="text-sm font-bold text-slate-900">
                      Pagamento NF por NF
                    </h4>
                    <p className="mt-1 text-xs text-slate-500">
                      Conferência individual de cada nota fiscal de cobrança
                      ADS paga em 2026.
                    </p>
                  </div>

                  <div className="max-h-[480px] overflow-auto rounded-xl border border-slate-200">
                    <table className="w-full min-w-[920px] text-left">
                      <thead className="sticky top-0 bg-slate-50 text-[10px] uppercase tracking-wide text-slate-400">
                        <tr>
                          <th className="px-4 py-3">Loja</th>
                          <th className="px-4 py-3">NF ADS</th>
                          <th className="px-4 py-3">Emissão</th>
                          <th className="px-4 py-3">Pagamento</th>
                          <th className="px-4 py-3 text-right">Prazo</th>
                          <th className="px-4 py-3 text-right">Valor</th>
                        </tr>
                      </thead>

                      <tbody className="divide-y divide-slate-100 text-xs">
                        {pagamentos2026.length === 0 ? (
                          <tr>
                            <td
                              colSpan={6}
                              className="px-4 py-8 text-center text-slate-400"
                            >
                              Nenhuma NF paga de 2026 com emissão e pagamento
                              preenchidos.
                            </td>
                          </tr>
                        ) : (
                          pagamentos2026.map((coleta) => (
                            <tr
                              key={coleta.id}
                              className="transition hover:bg-slate-50"
                            >
                              <td className="px-4 py-3">
                                <p className="font-bold text-slate-800">
                                  {coleta.loja || "Unidade não informada"}
                                </p>
                                <p className="mt-0.5 text-[10px] text-slate-400">
                                  {[coleta.cidade, coleta.estado]
                                    .filter(Boolean)
                                    .join("/") || "—"}
                                </p>
                              </td>

                              <td className="whitespace-nowrap px-4 py-3 font-black text-emerald-700">
                                {coleta.numero_nf_cobranca_ads || "—"}
                              </td>

                              <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                                {formatarData(
                                  coleta.data_emissao_nf_cobranca_ads,
                                )}
                              </td>

                              <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                                {formatarData(
                                  coleta.data_recebimento_pagamento_ads,
                                )}
                              </td>

                              <td className="whitespace-nowrap px-4 py-3 text-right">
                                <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-1 font-black text-emerald-700">
                                  {coleta.dias_pagamento} dias
                                </span>
                              </td>

                              <td className="whitespace-nowrap px-4 py-3 text-right font-bold text-slate-700">
                                {formatarMoeda(coleta.valor_nf_cobranca_ads)}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
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