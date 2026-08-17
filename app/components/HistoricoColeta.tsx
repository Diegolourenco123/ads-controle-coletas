"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

type Historico = {
  id: number;
  coleta_id: number;
  tipo_evento: string;
  titulo: string;
  descricao: string | null;
  data_evento: string;
  usuario: string | null;
};

type DocumentosColeta = {
  arquivo_nf_cliente: string | null;
  arquivo_cte: string | null;
  arquivo_nf_cobranca_ads: string | null;
};

type HistoricoColetaProps = {
  coletaId: number;
  atualizarEm?: number;
};

const BUCKET_DOCUMENTOS = "documentos-coletas";

function formatarDataHora(data: string) {
  const dataConvertida = new Date(data);

  if (Number.isNaN(dataConvertida.getTime())) {
    return data;
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(dataConvertida);
}

function configurarEvento(tipoEvento: string) {
  const configuracoes: Record<
    string,
    {
      sigla: string;
      fundo: string;
      circulo: string;
      texto: string;
    }
  > = {
    coleta_criada: {
      sigla: "SC",
      fundo: "border-slate-200 bg-slate-50",
      circulo: "bg-slate-600 text-white",
      texto: "text-slate-800",
    },

    ov_emitida: {
      sigla: "OV",
      fundo: "border-emerald-200 bg-emerald-50",
      circulo: "bg-emerald-600 text-white",
      texto: "text-emerald-900",
    },

    nf_cadastrada: {
      sigla: "NF",
      fundo: "border-amber-200 bg-amber-50",
      circulo: "bg-amber-500 text-white",
      texto: "text-amber-900",
    },

    solicitacao_transportadora: {
      sigla: "TR",
      fundo: "border-violet-200 bg-violet-50",
      circulo: "bg-violet-600 text-white",
      texto: "text-violet-900",
    },

    coleta_realizada: {
      sigla: "CR",
      fundo: "border-blue-200 bg-blue-50",
      circulo: "bg-blue-600 text-white",
      texto: "text-blue-900",
    },

    recebimento_ads: {
      sigla: "RA",
      fundo: "border-emerald-200 bg-emerald-50",
      circulo: "bg-emerald-600 text-white",
      texto: "text-emerald-900",
    },

    pagamento_transportadora: {
      sigla: "PT",
      fundo: "border-blue-200 bg-blue-50",
      circulo: "bg-blue-600 text-white",
      texto: "text-blue-900",
    },

    cobranca_ads_emitida: {
      sigla: "CA",
      fundo: "border-violet-200 bg-violet-50",
      circulo: "bg-violet-600 text-white",
      texto: "text-violet-900",
    },

    pagamento_ads: {
      sigla: "PA",
      fundo: "border-emerald-200 bg-emerald-50",
      circulo: "bg-emerald-600 text-white",
      texto: "text-emerald-900",
    },

    status_atualizado: {
      sigla: "ST",
      fundo: "border-slate-200 bg-slate-50",
      circulo: "bg-slate-700 text-white",
      texto: "text-slate-900",
    },
  };

  return (
    configuracoes[tipoEvento] ?? {
      sigla: "EV",
      fundo: "border-slate-200 bg-slate-50",
      circulo: "bg-slate-500 text-white",
      texto: "text-slate-800",
    }
  );
}

function nomeArquivoDoCaminho(caminho: string) {
  const partes = caminho.split("/");
  const nome = partes[partes.length - 1] || caminho;

  return nome
    .replace(/^\d+-/, "")
    .replace(/^nf-cliente-\d+-/, "")
    .replace(/^cte-\d+-/, "")
    .replace(/^nf-cobranca-ads-\d+-/, "");
}

export default function HistoricoColeta({
  coletaId,
  atualizarEm = 0,
}: HistoricoColetaProps) {
  const [historico, setHistorico] = useState<Historico[]>([]);
  const [documentos, setDocumentos] = useState<DocumentosColeta>({
    arquivo_nf_cliente: null,
    arquivo_cte: null,
    arquivo_nf_cobranca_ads: null,
  });

  const [carregando, setCarregando] = useState(true);
  const [carregandoDocumentos, setCarregandoDocumentos] = useState(true);
  const [erro, setErro] = useState("");
  const [erroDocumentos, setErroDocumentos] = useState("");
  const [abrindoDocumento, setAbrindoDocumento] = useState<string | null>(
    null,
  );

  useEffect(() => {
    async function carregarHistorico() {
      setCarregando(true);
      setErro("");

      const { data, error } = await supabase
        .from("historico_coletas")
        .select(
          "id, coleta_id, tipo_evento, titulo, descricao, data_evento, usuario",
        )
        .eq("coleta_id", coletaId)
        .order("data_evento", { ascending: false });

      if (error) {
        console.error("Erro ao carregar histórico:", error);
        setErro("Não foi possível carregar o histórico da coleta.");
        setCarregando(false);
        return;
      }

      setHistorico((data ?? []) as Historico[]);
      setCarregando(false);
    }

    async function carregarDocumentos() {
      setCarregandoDocumentos(true);
      setErroDocumentos("");

      const { data, error } = await supabase
        .from("coletas")
        .select(
          "arquivo_nf_cliente, arquivo_cte, arquivo_nf_cobranca_ads",
        )
        .eq("id", coletaId)
        .maybeSingle();

      if (error) {
        console.error("Erro ao carregar documentos da coleta:", error);
        setErroDocumentos(
          "Não foi possível carregar os documentos da coleta.",
        );
        setCarregandoDocumentos(false);
        return;
      }

      setDocumentos({
        arquivo_nf_cliente: data?.arquivo_nf_cliente ?? null,
        arquivo_cte: data?.arquivo_cte ?? null,
        arquivo_nf_cobranca_ads:
          data?.arquivo_nf_cobranca_ads ?? null,
      });

      setCarregandoDocumentos(false);
    }

    carregarHistorico();
    carregarDocumentos();

    const canalHistorico = supabase
      .channel(`historico-coleta-${coletaId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "historico_coletas",
          filter: `coleta_id=eq.${coletaId}`,
        },
        () => {
          carregarHistorico();
        },
      )
      .subscribe();

    const canalColeta = supabase
      .channel(`documentos-coleta-${coletaId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "coletas",
          filter: `id=eq.${coletaId}`,
        },
        () => {
          carregarDocumentos();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(canalHistorico);
      supabase.removeChannel(canalColeta);
    };
  }, [coletaId, atualizarEm]);

  const historicoOrdenado = useMemo(
    () =>
      [...historico].sort(
        (a, b) =>
          new Date(b.data_evento).getTime() -
          new Date(a.data_evento).getTime(),
      ),
    [historico],
  );

  const listaDocumentos = useMemo(
    () =>
      [
        {
          id: "nf-cliente",
          titulo: "Nota Fiscal do cliente",
          descricao: "Documento fiscal enviado pelo cliente.",
          caminho: documentos.arquivo_nf_cliente,
          sigla: "NF",
          classes:
            "border-amber-200 bg-amber-50 text-amber-800",
        },
        {
          id: "cte",
          titulo: "Conhecimento / CT-e",
          descricao: "Documento de transporte da coleta.",
          caminho: documentos.arquivo_cte,
          sigla: "CT",
          classes:
            "border-blue-200 bg-blue-50 text-blue-800",
        },
        {
          id: "nf-ads",
          titulo: "NF de cobrança ADS",
          descricao: "Nota Fiscal de cobrança emitida pela ADS.",
          caminho: documentos.arquivo_nf_cobranca_ads,
          sigla: "CA",
          classes:
            "border-violet-200 bg-violet-50 text-violet-800",
        },
      ].filter((item) => Boolean(item.caminho)),
    [documentos],
  );

  async function abrirDocumento(caminho: string, id: string) {
    setErroDocumentos("");
    setAbrindoDocumento(id);

    const { data, error } = await supabase.storage
      .from(BUCKET_DOCUMENTOS)
      .createSignedUrl(caminho, 60 * 10);

    if (error || !data?.signedUrl) {
      console.error("Erro ao abrir documento:", error);
      setErroDocumentos(
        "Não foi possível abrir o documento. Verifique as permissões do Storage.",
      );
      setAbrindoDocumento(null);
      return;
    }

    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    setAbrindoDocumento(null);
  }

  return (
    <section className="space-y-5">
      {/* DOCUMENTOS */}
      <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-5 flex flex-col justify-between gap-3 md:flex-row md:items-end">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">
              Documentos da coleta
            </p>

            <h3 className="mt-1 text-xl font-bold text-slate-900">
              Arquivos anexados
            </h3>

            <p className="mt-1 text-sm text-slate-500">
              Consulte a Nota Fiscal, o CT-e e a cobrança ADS diretamente
              pelo histórico.
            </p>
          </div>

          {!carregandoDocumentos && !erroDocumentos && (
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
              {listaDocumentos.length} documento(s)
            </span>
          )}
        </div>

        {erroDocumentos && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
            {erroDocumentos}
          </div>
        )}

        {carregandoDocumentos && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">
            Carregando documentos...
          </div>
        )}

        {!carregandoDocumentos &&
          !erroDocumentos &&
          listaDocumentos.length === 0 && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
              <p className="font-semibold text-slate-700">
                Nenhum documento anexado
              </p>

              <p className="mt-1 text-sm text-slate-500">
                Quando uma NF ou CT-e for anexado à coleta, ele aparecerá
                aqui automaticamente.
              </p>
            </div>
          )}

        {!carregandoDocumentos &&
          !erroDocumentos &&
          listaDocumentos.length > 0 && (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {listaDocumentos.map((documento) => (
                <div
                  key={documento.id}
                  className={`rounded-2xl border p-4 ${documento.classes}`}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-xs font-black shadow-sm">
                      {documento.sigla}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="font-bold">
                        {documento.titulo}
                      </p>

                      <p className="mt-1 text-xs opacity-80">
                        {documento.descricao}
                      </p>

                      {documento.caminho && (
                        <p
                          className="mt-2 truncate text-[11px] opacity-70"
                          title={nomeArquivoDoCaminho(
                            documento.caminho,
                          )}
                        >
                          {nomeArquivoDoCaminho(documento.caminho)}
                        </p>
                      )}

                      <button
                        type="button"
                        disabled={
                          !documento.caminho ||
                          abrindoDocumento === documento.id
                        }
                        onClick={() => {
                          if (documento.caminho) {
                            abrirDocumento(
                              documento.caminho,
                              documento.id,
                            );
                          }
                        }}
                        className="mt-3 inline-flex rounded-lg bg-white px-3 py-2 text-xs font-bold shadow-sm transition hover:shadow disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {abrindoDocumento === documento.id
                          ? "Abrindo..."
                          : "Abrir documento"}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
      </article>

      {/* HISTÓRICO */}
      <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-6 flex flex-col justify-between gap-3 md:flex-row md:items-end">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
              Histórico automático
            </p>

            <h3 className="mt-1 text-xl font-bold text-slate-900">
              Movimentações da coleta
            </h3>

            <p className="mt-1 text-sm text-slate-500">
              Registro cronológico das principais alterações da operação.
            </p>
          </div>

          {!carregando && !erro && (
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
              {historicoOrdenado.length} evento(s)
            </span>
          )}
        </div>

        {erro && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
            {erro}
          </div>
        )}

        {carregando && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">
            Carregando histórico...
          </div>
        )}

        {!carregando && !erro && historicoOrdenado.length === 0 && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
            <p className="font-semibold text-slate-700">
              Nenhuma movimentação registrada
            </p>

            <p className="mt-1 text-sm text-slate-500">
              Os próximos eventos importantes da coleta aparecerão aqui
              automaticamente.
            </p>
          </div>
        )}

        {!carregando && !erro && historicoOrdenado.length > 0 && (
          <div className="relative space-y-4">
            <div className="absolute bottom-5 left-5 top-5 w-px bg-slate-200" />

            {historicoOrdenado.map((evento) => {
              const visual = configurarEvento(evento.tipo_evento);

              return (
                <article
                  key={evento.id}
                  className={`relative ml-0 rounded-2xl border p-5 pl-16 ${visual.fundo}`}
                >
                  <div
                    className={`absolute left-0 top-5 z-10 flex h-10 w-10 items-center justify-center rounded-full text-xs font-black shadow-sm ${visual.circulo}`}
                  >
                    {visual.sigla}
                  </div>

                  <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
                    <div className="min-w-0">
                      <h4 className={`font-bold ${visual.texto}`}>
                        {evento.titulo}
                      </h4>

                      {evento.descricao && (
                        <p className="mt-1 text-sm leading-5 text-slate-600">
                          {evento.descricao}
                        </p>
                      )}

                      {evento.usuario && (
                        <p className="mt-2 text-xs font-medium text-slate-500">
                          Registrado por: {evento.usuario}
                        </p>
                      )}
                    </div>

                    <time className="shrink-0 rounded-lg bg-white/70 px-3 py-2 text-xs font-semibold text-slate-600">
                      {formatarDataHora(evento.data_evento)}
                    </time>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </article>
    </section>
  );
}