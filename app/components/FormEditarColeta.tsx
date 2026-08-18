"use client";

import Link from "next/link";
import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";
import PainelInteligenteColeta from "./PainelInteligenteColeta";
import TimelineColeta from "./TimelineColeta";
import HistoricoColeta from "./HistoricoColeta";

type Aba = "operacao" | "transportadora" | "ads";

type PerfilUsuario =
  | "administrador"
  | "gestor_operacional"
  | "operacional"
  | "financeiro"
  | "consulta";

type ClienteMestre = {
  id: number;
  razao_social: string | null;
  nome_fantasia: string | null;
  unidade: string | null;
  cidade: string | null;
  estado: string | null;
  responsavel: string | null;
  transportadora_padrao: string | null;
};

type TransportadoraMestre = {
  id: number;
  nome: string;
  contato: string | null;
  telefone: string | null;
  email: string | null;
};


type Coleta = {
  id: number;
  data_solicitacao: string | null;
  cliente: string | null;
  loja: string | null;
  cidade: string | null;
  estado: string | null;
  responsavel: string | null;
  responsavel_solicitacao: string | null;

  data_ov: string | null;
  numero_ov: string | null;

  data_nf: string | null;
  numero_nf: string | null;

  arquivo_nf_cliente: string | null;
  arquivo_cte: string | null;
  arquivo_nf_cobranca_ads: string | null;

  transportadora: string | null;
  data_envio_transportadora: string | null;
  data_prevista_coleta: string | null;
  contato_transportadora: string | null;

  status: string | null;

  data_coleta: string | null;
  data_efetiva_coleta: string | null;
  conhecimento: string | null;
  data_chegada_ads: string | null;
  peso: number | null;
  destino: string | null;
  responsavel_recebimento: string | null;
  observacoes: string | null;

  valor_frete: number | null;
  data_recebimento_cobranca_transportadora: string | null;
  vencimento_transportadora: string | null;
  status_pagamento_transportadora: string | null;
  data_pagamento_transportadora: string | null;
  observacoes_pagamento_transportadora: string | null;

  numero_nf_cobranca_ads: string | null;
  data_emissao_nf_cobranca_ads: string | null;
  valor_nf_cobranca_ads: number | null;
  vencimento_nf_cobranca_ads: string | null;
  status_recebimento_ads: string | null;
  data_recebimento_pagamento_ads: string | null;
  observacoes_cobranca_ads: string | null;
};

const campo =
  "mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500 disabled:opacity-100";

const rotulo = "text-sm font-semibold text-slate-700";

const campoArquivo =
  "mt-2 block w-full cursor-pointer rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 transition hover:border-emerald-300 hover:bg-emerald-50/40 file:mr-3 file:rounded-lg file:border-0 file:bg-emerald-100 file:px-3 file:py-2 file:text-xs file:font-bold file:text-emerald-700 hover:file:bg-emerald-200 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 disabled:opacity-100";

const BUCKET_DOCUMENTOS = "documentos-coletas";
const LIMITE_ARQUIVO = 10 * 1024 * 1024;

const tiposArquivoPermitidos = [
  "application/pdf",
  "application/xml",
  "text/xml",
  "image/jpeg",
  "image/png",
];

const extensoesPermitidas = [".pdf", ".xml", ".jpg", ".jpeg", ".png"];

const estados = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA",
  "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN",
  "RS", "RO", "RR", "SC", "SP", "SE", "TO",
];


function nomeCliente(cliente: ClienteMestre) {
  return (
    cliente.nome_fantasia?.trim() ||
    cliente.razao_social?.trim() ||
    `Cliente #${cliente.id}`
  );
}

function contatoTransportadora(transportadora: TransportadoraMestre) {
  return [
    transportadora.contato,
    transportadora.telefone,
    transportadora.email,
  ]
    .filter(Boolean)
    .join(" • ");
}

function normalizarTexto(texto: string) {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function nomeArquivoSeguro(nome: string) {
  return nome
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .toLowerCase();
}

function extensaoPermitida(nome: string) {
  const nomeNormalizado = nome.toLowerCase();
  return extensoesPermitidas.some((extensao) =>
    nomeNormalizado.endsWith(extensao),
  );
}

function validarArquivo(arquivo: File) {
  if (arquivo.size > LIMITE_ARQUIVO) {
    throw new Error(`O arquivo "${arquivo.name}" ultrapassa o limite de 10 MB.`);
  }

  const tipoValido =
    !arquivo.type ||
    tiposArquivoPermitidos.includes(arquivo.type) ||
    extensaoPermitida(arquivo.name);

  if (!tipoValido) {
    throw new Error(`O arquivo "${arquivo.name}" possui um formato não permitido.`);
  }
}

function calcularStatusOperacional(dados: FormData) {
  const obterValor = (nome: string) =>
    dados.get(nome)?.toString().trim() ?? "";

  const dataNotaFiscal = obterValor("dataNotaFiscal");
  const numeroNotaFiscal = obterValor("numeroNotaFiscal");
  const dataEfetivaColeta = obterValor("dataEfetivaColeta");
  const dataChegadaAds = obterValor("dataChegadaAds");

  const statusRecebimentoAds = normalizarTexto(
    obterValor("statusRecebimentoAds"),
  );

  if (statusRecebimentoAds === "paga") {
    return "Finalizado";
  }

  if (dataChegadaAds) {
    return "Recebido na ADS";
  }

  if (dataEfetivaColeta) {
    return "Coleta realizada";
  }

  if (dataNotaFiscal && numeroNotaFiscal) {
    return "Aguardando coleta";
  }

  return "Aguardando NF";
}


type EventoHistorico = {
  coleta_id: number;
  tipo_evento: string;
  titulo: string;
  descricao: string | null;
  usuario: string | null;
};

function valorPreenchido(valor: unknown) {
  return valor !== null && valor !== undefined && String(valor).trim() !== "";
}

function criarEventosHistorico(
  anterior: Coleta,
  atualizacao: Partial<Coleta>,
): EventoHistorico[] {
  const eventos: EventoHistorico[] = [];

  const adicionarEvento = (
    tipoEvento: string,
    titulo: string,
    descricao: string,
  ) => {
    eventos.push({
      coleta_id: anterior.id,
      tipo_evento: tipoEvento,
      titulo,
      descricao,
      usuario: "Gestor Operacional",
    });
  };

  const passouAPreenchido = (
    valorAnterior: unknown,
    valorAtual: unknown,
  ) => !valorPreenchido(valorAnterior) && valorPreenchido(valorAtual);

  if (
    (passouAPreenchido(anterior.data_ov, atualizacao.data_ov) ||
      passouAPreenchido(anterior.numero_ov, atualizacao.numero_ov)) &&
    valorPreenchido(atualizacao.data_ov) &&
    valorPreenchido(atualizacao.numero_ov)
  ) {
    adicionarEvento(
      "ov_emitida",
      "Ordem de Visita emitida",
      `OV ${atualizacao.numero_ov} registrada no sistema.`,
    );
  }

  if (
    (passouAPreenchido(anterior.data_nf, atualizacao.data_nf) ||
      passouAPreenchido(anterior.numero_nf, atualizacao.numero_nf)) &&
    valorPreenchido(atualizacao.data_nf) &&
    valorPreenchido(atualizacao.numero_nf)
  ) {
    adicionarEvento(
      "nf_cadastrada",
      "Nota Fiscal cadastrada",
      `Nota Fiscal ${atualizacao.numero_nf} vinculada à coleta.`,
    );
  }

  if (
    passouAPreenchido(
      anterior.data_envio_transportadora,
      atualizacao.data_envio_transportadora,
    )
  ) {
    adicionarEvento(
      "solicitacao_transportadora",
      "Solicitação enviada à transportadora",
      atualizacao.transportadora
        ? `Solicitação enviada para ${atualizacao.transportadora}.`
        : "Solicitação de coleta enviada à transportadora.",
    );
  }

  if (
    passouAPreenchido(
      anterior.data_efetiva_coleta ?? anterior.data_coleta,
      atualizacao.data_efetiva_coleta ?? atualizacao.data_coleta,
    )
  ) {
    adicionarEvento(
      "coleta_realizada",
      "Coleta realizada",
      atualizacao.conhecimento
        ? `Coleta confirmada. CT-e/conhecimento: ${atualizacao.conhecimento}.`
        : "Coleta confirmada pela transportadora.",
    );
  }

  if (
    passouAPreenchido(
      anterior.data_chegada_ads,
      atualizacao.data_chegada_ads,
    )
  ) {
    adicionarEvento(
      "recebimento_ads",
      "Resíduos recebidos na ADS",
      atualizacao.destino
        ? `Recebimento confirmado no destino ${atualizacao.destino}.`
        : "Recebimento dos resíduos confirmado na ADS.",
    );
  }

  const statusPagamentoAnterior = normalizarTexto(
    anterior.status_pagamento_transportadora ?? "",
  );
  const statusPagamentoAtual = normalizarTexto(
    atualizacao.status_pagamento_transportadora ?? "",
  );

  if (
    statusPagamentoAtual === "pago" &&
    statusPagamentoAnterior !== "pago"
  ) {
    adicionarEvento(
      "pagamento_transportadora",
      "Pagamento da transportadora confirmado",
      atualizacao.data_pagamento_transportadora
        ? `Pagamento registrado em ${atualizacao.data_pagamento_transportadora}.`
        : "Pagamento do frete registrado como pago.",
    );
  }

  if (
    (passouAPreenchido(
      anterior.numero_nf_cobranca_ads,
      atualizacao.numero_nf_cobranca_ads,
    ) ||
      passouAPreenchido(
        anterior.data_emissao_nf_cobranca_ads,
        atualizacao.data_emissao_nf_cobranca_ads,
      )) &&
    (valorPreenchido(atualizacao.numero_nf_cobranca_ads) ||
      valorPreenchido(atualizacao.data_emissao_nf_cobranca_ads))
  ) {
    adicionarEvento(
      "cobranca_ads_emitida",
      "Cobrança da ADS emitida",
      atualizacao.numero_nf_cobranca_ads
        ? `NF de cobrança ${atualizacao.numero_nf_cobranca_ads} emitida pela ADS.`
        : "Nota Fiscal de cobrança emitida pela ADS.",
    );
  }

  const statusRecebimentoAnterior = normalizarTexto(
    anterior.status_recebimento_ads ?? "",
  );
  const statusRecebimentoAtual = normalizarTexto(
    atualizacao.status_recebimento_ads ?? "",
  );

  if (
    statusRecebimentoAtual === "paga" &&
    statusRecebimentoAnterior !== "paga"
  ) {
    adicionarEvento(
      "pagamento_ads",
      "Pagamento do cliente confirmado",
      atualizacao.data_recebimento_pagamento_ads
        ? `Recebimento registrado em ${atualizacao.data_recebimento_pagamento_ads}.`
        : "Cobrança da ADS registrada como paga.",
    );
  }

  if (
    valorPreenchido(atualizacao.status) &&
    anterior.status !== atualizacao.status
  ) {
    adicionarEvento(
      "status_atualizado",
      "Status operacional atualizado",
      `Status alterado de "${anterior.status ?? "Sem status"}" para "${atualizacao.status}".`,
    );
  }

  return eventos;
}


function formatarDataExecutiva(data: string | null) {
  if (!data) return "—";

  const valor = data.includes("T") ? data.split("T")[0] : data;
  const [ano, mes, dia] = valor.split("-");

  return ano && mes && dia ? `${dia}/${mes}/${ano}` : data;
}

function formatarMoedaExecutiva(valor: number | null) {
  if (valor === null || valor === undefined) return "—";

  return valor.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function statusExecutivoFinanceiro(coleta: Coleta) {
  const statusAds = normalizarTexto(coleta.status_recebimento_ads ?? "");

  if (
    statusAds === "paga" ||
    Boolean(coleta.data_recebimento_pagamento_ads)
  ) {
    return "Finalizado";
  }

  if (
    coleta.numero_nf_cobranca_ads ||
    coleta.data_emissao_nf_cobranca_ads
  ) {
    return "Aguardando pagamento";
  }

  return coleta.status || "Sem status";
}

export default function FormEditarColeta({ id }: { id: number }) {
  const formularioRef = useRef<HTMLFormElement>(null);
  const router = useRouter();

  const [clientes, setClientes] = useState<ClienteMestre[]>([]);
  const [transportadoras, setTransportadoras] = useState<
    TransportadoraMestre[]
  >([]);
  const [carregandoCadastros, setCarregandoCadastros] =
    useState(true);
  const [erroCadastros, setErroCadastros] = useState("");

  const [abaAtiva, setAbaAtiva] = useState<Aba>("operacao");
  const [coleta, setColeta] = useState<Coleta | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const [atualizarHistorico, setAtualizarHistorico] = useState(0);
  const [abrindoDocumento, setAbrindoDocumento] = useState<string | null>(null);
  const [tipoMensagem, setTipoMensagem] = useState<
    "sucesso" | "erro" | "carregando"
  >("sucesso");

  const [perfil, setPerfil] = useState<PerfilUsuario | null>(null);
  const [carregandoPerfil, setCarregandoPerfil] = useState(true);

  const podeEditarOperacao =
    perfil === "administrador" ||
    perfil === "gestor_operacional" ||
    perfil === "operacional";

  const podeEditarFinanceiro =
    perfil === "administrador" ||
    perfil === "gestor_operacional" ||
    perfil === "financeiro";

  const podeExcluir =
    perfil === "administrador" ||
    perfil === "gestor_operacional";

  const podeSalvar = podeEditarOperacao || podeEditarFinanceiro;

  const modoConsulta = perfil === "consulta";

  useEffect(() => {
    let componenteAtivo = true;

    async function carregarPerfilUsuario() {
      try {
        const {
          data: { user },
          error: erroUsuario,
        } = await supabase.auth.getUser();

        if (erroUsuario || !user) {
          if (componenteAtivo) {
            setPerfil("consulta");
            setCarregandoPerfil(false);
          }
          return;
        }

        const { data, error } = await supabase
          .from("usuarios_perfis")
          .select("perfil, ativo")
          .eq("user_id", user.id)
          .maybeSingle();

        if (error) {
          console.error("Erro ao carregar perfil do usuário:", error);

          if (componenteAtivo) {
            setPerfil("consulta");
            setCarregandoPerfil(false);
          }
          return;
        }

        const perfisValidos: PerfilUsuario[] = [
          "administrador",
          "gestor_operacional",
          "operacional",
          "financeiro",
          "consulta",
        ];

        const perfilRecebido = data?.perfil as PerfilUsuario | undefined;

        if (
          !data ||
          data.ativo === false ||
          !perfilRecebido ||
          !perfisValidos.includes(perfilRecebido)
        ) {
          if (componenteAtivo) {
            setPerfil("consulta");
            setCarregandoPerfil(false);
          }
          return;
        }

        if (componenteAtivo) {
          setPerfil(perfilRecebido);
          setCarregandoPerfil(false);

          if (perfilRecebido === "financeiro") {
            setAbaAtiva("ads");
          }
        }
      } catch (erro) {
        console.error("Erro inesperado ao carregar perfil:", erro);

        if (componenteAtivo) {
          setPerfil("consulta");
          setCarregandoPerfil(false);
        }
      }
    }

    carregarPerfilUsuario();

    return () => {
      componenteAtivo = false;
    };
  }, []);

  useEffect(() => {
    async function carregarCadastrosMestres() {
      setCarregandoCadastros(true);
      setErroCadastros("");

      const [
        { data: dadosClientes, error: erroClientes },
        { data: dadosTransportadoras, error: erroTransportadoras },
      ] = await Promise.all([
        supabase
          .from("clientes")
          .select(
            "id, razao_social, nome_fantasia, unidade, cidade, estado, responsavel, transportadora_padrao",
          )
          .order("nome_fantasia", { ascending: true }),
        supabase
          .from("transportadoras")
          .select("id, nome, contato, telefone, email")
          .order("nome", { ascending: true }),
      ]);

      if (erroClientes || erroTransportadoras) {
        console.error(
          "Erro ao carregar cadastros mestres:",
          erroClientes ?? erroTransportadoras,
        );
        setErroCadastros(
          "Não foi possível carregar clientes ou transportadoras.",
        );
      }

      setClientes((dadosClientes ?? []) as ClienteMestre[]);
      setTransportadoras(
        (dadosTransportadoras ?? []) as TransportadoraMestre[],
      );
      setCarregandoCadastros(false);
    }

    carregarCadastrosMestres();

    const canal = supabase
      .channel("cadastros-mestres-editar-coleta")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "clientes" },
        carregarCadastrosMestres,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "transportadoras" },
        carregarCadastrosMestres,
      )
      .subscribe();

    return () => {
      supabase.removeChannel(canal);
    };
  }, []);

  function preencherCampo(nome: string, valor: string | null) {
    const campoFormulario = formularioRef.current?.elements.namedItem(
      nome,
    ) as HTMLInputElement | HTMLSelectElement | null;

    if (campoFormulario) {
      campoFormulario.value = valor ?? "";
    }
  }

  function selecionarCliente(
    evento: React.ChangeEvent<HTMLSelectElement>,
  ) {
    const clienteId = Number(
      evento.target.selectedOptions[0]?.dataset.id,
    );
    const clienteSelecionado = clientes.find(
      (cliente) => cliente.id === clienteId,
    );

    if (!clienteSelecionado) return;

    preencherCampo("unidade", clienteSelecionado.unidade);
    preencherCampo("cidade", clienteSelecionado.cidade);
    preencherCampo("estado", clienteSelecionado.estado);
    preencherCampo(
      "responsavelSolicitacao",
      clienteSelecionado.responsavel,
    );

    if (clienteSelecionado.transportadora_padrao) {
      preencherCampo(
        "transportadora",
        clienteSelecionado.transportadora_padrao,
      );

      const transportadoraPadrao = transportadoras.find(
        (transportadora) =>
          normalizarTexto(transportadora.nome) ===
          normalizarTexto(
            clienteSelecionado.transportadora_padrao ?? "",
          ),
      );

      preencherCampo(
        "contatoTransportadora",
        transportadoraPadrao
          ? contatoTransportadora(transportadoraPadrao)
          : null,
      );
    }
  }

  function selecionarTransportadora(
    evento: React.ChangeEvent<HTMLSelectElement>,
  ) {
    const transportadoraId = Number(
      evento.target.selectedOptions[0]?.dataset.id,
    );
    const transportadoraSelecionada = transportadoras.find(
      (transportadora) => transportadora.id === transportadoraId,
    );

    preencherCampo(
      "contatoTransportadora",
      transportadoraSelecionada
        ? contatoTransportadora(transportadoraSelecionada)
        : null,
    );
  }

  useEffect(() => {
    async function carregarColeta() {
      setCarregando(true);
      setMensagem("");

      const { data, error } = await supabase
        .from("coletas")
        .select("*")
        .eq("id", id)
        .single();

      if (error) {
        console.error("Erro ao carregar coleta:", error);
        setTipoMensagem("erro");
        setMensagem(
          `Não foi possível carregar a coleta: ${error.message}`,
        );
        setCarregando(false);
        return;
      }

      setColeta(data as Coleta);
      setCarregando(false);
    }

    carregarColeta();
  }, [id]);

  async function enviarDocumento(arquivo: File, categoria: string) {
    validarArquivo(arquivo);

    const {
      data: { session },
      error: erroSessao,
    } = await supabase.auth.getSession();

    if (erroSessao) {
      throw new Error(
        `Não foi possível verificar a sessão: ${erroSessao.message}`,
      );
    }

    if (!session) {
      throw new Error(
        "Sessão do Supabase não encontrada. Entre novamente e tente anexar o documento.",
      );
    }

    const caminho = `coleta-${id}/${categoria}-${Date.now()}-${nomeArquivoSeguro(
      arquivo.name,
    )}`;

    const { error } = await supabase.storage
      .from(BUCKET_DOCUMENTOS)
      .upload(caminho, arquivo, {
        cacheControl: "3600",
        upsert: false,
        contentType: arquivo.type || undefined,
      });

    if (error) {
      throw new Error(`Falha ao enviar ${arquivo.name}: ${error.message}`);
    }

    return caminho;
  }

  async function abrirDocumentoAtual(
    caminho: string | null,
    identificador: string,
  ) {
    if (!caminho) return;

    setAbrindoDocumento(identificador);

    const { data, error } = await supabase.storage
      .from(BUCKET_DOCUMENTOS)
      .createSignedUrl(caminho, 60 * 10);

    if (error || !data?.signedUrl) {
      console.error("Erro ao abrir documento:", error);
      setTipoMensagem("erro");
      setMensagem(
        "Não foi possível abrir o documento atual. Verifique as permissões do Storage.",
      );
      setAbrindoDocumento(null);
      return;
    }

    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    setAbrindoDocumento(null);
  }

  async function salvarAlteracoes(
    evento: FormEvent<HTMLFormElement>,
  ) {
    evento.preventDefault();

    if (!podeSalvar) {
      setTipoMensagem("erro");
      setMensagem("Seu perfil possui acesso somente para consulta desta coleta.");
      return;
    }

    const formulario = evento.currentTarget;

    if (!formulario.checkValidity()) {
      setAbaAtiva("operacao");

      setTimeout(() => {
        formulario.reportValidity();
      }, 0);

      return;
    }

    setSalvando(true);
    setTipoMensagem("carregando");
    setMensagem("Salvando alterações...");

    const dados = new FormData(formulario);

    const valorOuNulo = (nome: string) => {
      const valor = dados.get(nome)?.toString().trim();
      return valor ? valor : null;
    };

    const numeroOuNulo = (nome: string) => {
      const valor = valorOuNulo(nome);

      if (!valor) {
        return null;
      }

      const numero = Number(valor.replace(",", "."));
      return Number.isNaN(numero) ? null : numero;
    };

    const dataEfetivaColeta = valorOuNulo("dataEfetivaColeta");
    const statusAutomatico = calcularStatusOperacional(dados);

    const obterArquivo = (nome: string) => {
      const valor = dados.get(nome);
      return valor instanceof File && valor.size > 0 ? valor : null;
    };

    const arquivoNfCliente = obterArquivo("arquivoNfCliente");
    const arquivoCte = obterArquivo("arquivoCte");
    const arquivoNfCobrancaAds = obterArquivo("arquivoNfCobrancaAds");

    const caminhosNovos: string[] = [];

    let caminhoNfCliente = coleta?.arquivo_nf_cliente ?? null;
    let caminhoCte = coleta?.arquivo_cte ?? null;
    let caminhoNfCobrancaAds = coleta?.arquivo_nf_cobranca_ads ?? null;

    const caminhoNfClienteAnterior = caminhoNfCliente;
    const caminhoCteAnterior = caminhoCte;
    const caminhoNfCobrancaAdsAnterior = caminhoNfCobrancaAds;

    try {
      if (arquivoNfCliente || arquivoCte || arquivoNfCobrancaAds) {
        setMensagem("Enviando documentos e salvando alterações...");
      }

      if (arquivoNfCliente) {
        caminhoNfCliente = await enviarDocumento(arquivoNfCliente, "nf-cliente");
        caminhosNovos.push(caminhoNfCliente);
      }

      if (arquivoCte) {
        caminhoCte = await enviarDocumento(arquivoCte, "cte");
        caminhosNovos.push(caminhoCte);
      }

      if (arquivoNfCobrancaAds) {
        caminhoNfCobrancaAds = await enviarDocumento(
          arquivoNfCobrancaAds,
          "nf-cobranca-ads",
        );
        caminhosNovos.push(caminhoNfCobrancaAds);
      }
    } catch (erroUpload) {
      if (caminhosNovos.length > 0) {
        await supabase.storage
          .from(BUCKET_DOCUMENTOS)
          .remove(caminhosNovos);
      }

      setTipoMensagem("erro");
      setMensagem(
        erroUpload instanceof Error
          ? erroUpload.message
          : "Não foi possível enviar os documentos.",
      );
      setSalvando(false);
      return;
    }

    const atualizacaoOperacional: Partial<Coleta> = {
      data_solicitacao: valorOuNulo("dataSolicitacao"),
      cliente: valorOuNulo("cliente"),
      loja: valorOuNulo("unidade"),
      cidade: valorOuNulo("cidade"),
      estado: valorOuNulo("estado"),
      responsavel: valorOuNulo("responsavelSolicitacao"),
      responsavel_solicitacao: valorOuNulo("responsavelSolicitacao"),

      data_ov: valorOuNulo("dataOv"),
      numero_ov: valorOuNulo("numeroOv"),

      data_nf: valorOuNulo("dataNotaFiscal"),
      numero_nf: valorOuNulo("numeroNotaFiscal"),

      arquivo_nf_cliente: caminhoNfCliente,
      arquivo_cte: caminhoCte,

      transportadora: valorOuNulo("transportadora"),
      data_envio_transportadora: valorOuNulo("dataEnvioTransportadora"),
      data_prevista_coleta: valorOuNulo("dataPrevistaColeta"),
      contato_transportadora: valorOuNulo("contatoTransportadora"),

      status: statusAutomatico,

      data_coleta: dataEfetivaColeta,
      data_efetiva_coleta: dataEfetivaColeta,
      conhecimento: valorOuNulo("conhecimento"),
      data_chegada_ads: valorOuNulo("dataChegadaAds"),
      peso: numeroOuNulo("peso"),
      destino: valorOuNulo("destino"),
      responsavel_recebimento: valorOuNulo("responsavelRecebimento"),
      observacoes: valorOuNulo("observacoes"),
    };

    const atualizacaoFinanceira: Partial<Coleta> = {
      valor_frete: numeroOuNulo("valorFrete"),
      data_recebimento_cobranca_transportadora: valorOuNulo(
        "dataRecebimentoCobrancaTransportadora",
      ),
      vencimento_transportadora: valorOuNulo("vencimentoTransportadora"),
      status_pagamento_transportadora: valorOuNulo(
        "statusPagamentoTransportadora",
      ),
      data_pagamento_transportadora: valorOuNulo(
        "dataPagamentoTransportadora",
      ),
      observacoes_pagamento_transportadora: valorOuNulo(
        "observacoesPagamentoTransportadora",
      ),

      numero_nf_cobranca_ads: valorOuNulo("numeroNfCobrancaAds"),
      arquivo_nf_cobranca_ads: caminhoNfCobrancaAds,
      data_emissao_nf_cobranca_ads: valorOuNulo(
        "dataEmissaoNfCobrancaAds",
      ),
      valor_nf_cobranca_ads: numeroOuNulo("valorNfCobrancaAds"),
      vencimento_nf_cobranca_ads: valorOuNulo(
        "vencimentoNfCobrancaAds",
      ),
      status_recebimento_ads: valorOuNulo("statusRecebimentoAds"),
      data_recebimento_pagamento_ads: valorOuNulo(
        "dataRecebimentoPagamentoAds",
      ),
      observacoes_cobranca_ads: valorOuNulo(
        "observacoesCobrancaAds",
      ),
    };

    const atualizacao: Partial<Coleta> = {
      ...(podeEditarOperacao ? atualizacaoOperacional : {}),
      ...(podeEditarFinanceiro ? atualizacaoFinanceira : {}),
    };

    const {
      data: coletaAtualizada,
      error,
    } = await supabase
      .from("coletas")
      .update(atualizacao)
      .eq("id", id)
      .select("*")
      .single();

    if (error || !coletaAtualizada) {
      console.error(
        "Erro ao salvar alterações no banco:",
        error,
      );

      if (caminhosNovos.length > 0) {
        await supabase.storage
          .from(BUCKET_DOCUMENTOS)
          .remove(caminhosNovos);
      }

      setTipoMensagem("erro");
      setMensagem(
        error
          ? `Não foi possível salvar no banco: ${error.message}`
          : "Não foi possível confirmar a atualização no banco de dados.",
      );
      setSalvando(false);
      return;
    }

    if (!coleta) {
      setTipoMensagem("erro");
      setMensagem("Não foi possível identificar a coleta.");
      setSalvando(false);
      return;
    }

    const eventosHistorico = criarEventosHistorico(
      coleta,
      atualizacao,
    );

    let avisoHistorico = "";

    if (eventosHistorico.length > 0) {
      const { error: erroHistorico } = await supabase
        .from("historico_coletas")
        .insert(eventosHistorico);

      if (erroHistorico) {
        console.error(
          "As alterações foram salvas, mas o histórico não foi registrado:",
          erroHistorico,
        );

        avisoHistorico =
          " As alterações foram salvas, mas não foi possível registrar o histórico.";
      } else {
        setAtualizarHistorico((valor) => valor + 1);
      }
    }

    const caminhosAntigosSubstituidos = [
      arquivoNfCliente &&
      caminhoNfClienteAnterior &&
      caminhoNfClienteAnterior !== caminhoNfCliente
        ? caminhoNfClienteAnterior
        : null,
      arquivoCte &&
      caminhoCteAnterior &&
      caminhoCteAnterior !== caminhoCte
        ? caminhoCteAnterior
        : null,
      arquivoNfCobrancaAds &&
      caminhoNfCobrancaAdsAnterior &&
      caminhoNfCobrancaAdsAnterior !== caminhoNfCobrancaAds
        ? caminhoNfCobrancaAdsAnterior
        : null,
    ].filter((caminho): caminho is string => Boolean(caminho));

    if (caminhosAntigosSubstituidos.length > 0) {
      const { error: erroRemocao } = await supabase.storage
        .from(BUCKET_DOCUMENTOS)
        .remove(caminhosAntigosSubstituidos);

      if (erroRemocao) {
        console.warn(
          "A coleta foi atualizada, mas não foi possível remover um arquivo antigo:",
          erroRemocao,
        );
      }
    }

    // Usa exatamente o registro devolvido pelo Supabase.
    // Assim a tela só mostra sucesso se o banco realmente foi atualizado.
    setColeta(coletaAtualizada as Coleta);
    setAtualizarHistorico((valor) => valor + 1);

    setTipoMensagem("sucesso");
    setMensagem(
      podeEditarOperacao
        ? `Alterações salvas com sucesso! Status atualizado para: ${statusAutomatico}.${avisoHistorico}`
        : `Alterações financeiras salvas com sucesso!${avisoHistorico}`,
    );
    setSalvando(false);
    router.refresh();

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  async function excluirColeta() {
    if (!podeExcluir) {
      setTipoMensagem("erro");
      setMensagem("Seu perfil não possui permissão para excluir esta coleta.");
      return;
    }

    const confirmou = window.confirm(
      `Tem certeza que deseja excluir a coleta #${id}? Esta ação não poderá ser desfeita.`,
    );

    if (!confirmou) {
      return;
    }

    setExcluindo(true);
    setTipoMensagem("carregando");
    setMensagem("Excluindo coleta...");

    const { error } = await supabase
      .from("coletas")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Erro ao excluir coleta:", error);
      setTipoMensagem("erro");
      setMensagem(`Não foi possível excluir a coleta: ${error.message}`);
      setExcluindo(false);
      return;
    }

    router.push("/coletas");
    router.refresh();
  }

  function irParaAtalho(
    aba: Aba | null,
    idSecao: string,
  ) {
    if (aba) {
      setAbaAtiva(aba);
    }

    window.history.replaceState(
      null,
      "",
      `#${idSecao}`,
    );

    window.setTimeout(() => {
      const elemento =
        document.getElementById(idSecao);

      elemento?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 80);
  }

  function classeBotaoAba(aba: Aba) {
    return [
      "rounded-xl px-4 py-3 text-sm font-semibold transition",
      abaAtiva === aba
        ? "bg-emerald-600 text-white shadow-sm"
        : "bg-slate-100 text-slate-600 hover:bg-slate-200",
    ].join(" ");
  }

  function classeMensagem() {
    if (tipoMensagem === "erro") {
      return "border-red-200 bg-red-50 text-red-800";
    }

    if (tipoMensagem === "carregando") {
      return "border-blue-200 bg-blue-50 text-blue-800";
    }

    return "border-emerald-200 bg-emerald-50 text-emerald-800";
  }

  if (carregando || carregandoPerfil) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500 shadow-sm">
        Carregando coleta e permissões...
      </div>
    );
  }

  if (!coleta) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700">
        {mensagem || "Coleta não encontrada."}
      </div>
    );
  }

  return (
    <form
      ref={formularioRef}
      onSubmit={salvarAlteracoes}
      className="space-y-6"
    >
      {mensagem && (
        <div
          role="status"
          className={`rounded-2xl border p-4 text-sm font-medium ${classeMensagem()}`}
        >
          {mensagem}
        </div>
      )}

      {erroCadastros && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-medium text-amber-800">
          {erroCadastros}
        </div>
      )}

      {modoConsulta && (
        <div className="rounded-2xl border border-blue-200 bg-blue-50 px-5 py-4">
          <p className="text-sm font-bold text-blue-800">Modo consulta</p>
          <p className="mt-1 text-sm text-blue-700">
            Você pode visualizar a coleta, a timeline, o histórico e abrir documentos, mas não pode alterar ou excluir informações.
          </p>
        </div>
      )}

      {perfil === "financeiro" && (
        <div className="rounded-2xl border border-violet-200 bg-violet-50 px-5 py-4">
          <p className="text-sm font-bold text-violet-800">Modo financeiro</p>
          <p className="mt-1 text-sm text-violet-700">
            Os dados operacionais estão disponíveis para consulta. Somente as informações financeiras podem ser alteradas.
          </p>
        </div>
      )}

      {perfil === "operacional" && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4">
          <p className="text-sm font-bold text-emerald-800">Modo operacional</p>
          <p className="mt-1 text-sm text-emerald-700">
            Os dados operacionais podem ser alterados. As etapas financeiras estão disponíveis somente para consulta.
          </p>
        </div>
      )}

      {/* CABEÇALHO EXECUTIVO DA COLETA — VISUAL REFINADO */}
      <section className="overflow-hidden rounded-[28px] border border-slate-200/80 bg-white shadow-[0_18px_50px_-30px_rgba(15,23,42,0.35)]">
        <div className="relative overflow-hidden bg-slate-950 px-6 py-6 text-white md:px-7">
          <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-emerald-500/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-28 left-1/3 h-56 w-56 rounded-full bg-blue-500/10 blur-3xl" />

          <div className="relative flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.18em] text-emerald-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  Visão executiva
                </span>

                <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                  Coleta #{coleta.id}
                </span>
              </div>

              <h2 className="mt-4 text-[30px] font-black leading-none tracking-[-0.035em] text-white md:text-[36px]">
                {coleta.numero_ov
                  ? `OV ${coleta.numero_ov}`
                  : `Coleta #${coleta.id}`}
              </h2>

              <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] font-medium text-slate-300">
                <span className="font-bold text-slate-100">
                  {coleta.cliente || "Cliente não informado"}
                </span>
                {coleta.loja && (
                  <>
                    <span className="text-slate-600">•</span>
                    <span>{coleta.loja}</span>
                  </>
                )}
                {(coleta.cidade || coleta.estado) && (
                  <>
                    <span className="text-slate-600">•</span>
                    <span>
                      {[coleta.cidade, coleta.estado]
                        .filter(Boolean)
                        .join("/")}
                    </span>
                  </>
                )}
              </div>
            </div>

            <div className="shrink-0 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 backdrop-blur">
              <p className="text-[9px] font-extrabold uppercase tracking-[0.2em] text-slate-500">
                Status atual
              </p>

              <div className="mt-2 flex items-center gap-2.5">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-30" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
                </span>

                <span className="text-sm font-extrabold tracking-[-0.01em] text-emerald-300">
                  {statusExecutivoFinanceiro(coleta)}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="px-5 py-6 md:px-7">
          {(() => {
            const etapas = [
              {
                titulo: "Solicitada",
                concluida: Boolean(coleta.data_solicitacao),
              },
              {
                titulo: "NF recebida",
                concluida: Boolean(coleta.data_nf && coleta.numero_nf),
              },
              {
                titulo: "Transportadora",
                concluida: Boolean(
                  coleta.transportadora &&
                    coleta.data_envio_transportadora,
                ),
              },
              {
                titulo: "Coletada",
                concluida: Boolean(
                  coleta.data_efetiva_coleta ?? coleta.data_coleta,
                ),
              },
              {
                titulo: "Recebida ADS",
                concluida: Boolean(coleta.data_chegada_ads),
              },
              {
                titulo: "Cobrança",
                concluida: Boolean(
                  coleta.numero_nf_cobranca_ads ||
                    coleta.data_emissao_nf_cobranca_ads,
                ),
              },
              {
                titulo: "Paga",
                concluida:
                  normalizarTexto(
                    coleta.status_recebimento_ads ?? "",
                  ) === "paga" ||
                  Boolean(coleta.data_recebimento_pagamento_ads),
              },
            ];

            const quantidadeConcluida =
              etapas.filter((etapa) => etapa.concluida).length;

            const percentual = Math.round(
              (quantidadeConcluida / etapas.length) * 100,
            );

            return (
              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 md:p-5">
                <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                  <div>
                    <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-slate-400">
                      Progresso operacional
                    </p>
                    <p className="mt-1 text-[13px] font-semibold text-slate-700">
                      Jornada da solicitação ao encerramento financeiro.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-500">
                      {quantidadeConcluida} de {etapas.length} etapas
                    </span>
                    <span className="rounded-lg bg-slate-900 px-2.5 py-1.5 text-[11px] font-black text-white">
                      {percentual}%
                    </span>
                  </div>
                </div>

                <div className="relative mt-5">
                  <div className="absolute left-5 right-5 top-5 hidden h-px bg-slate-200 lg:block" />

                  <div className="relative grid gap-2 sm:grid-cols-2 lg:grid-cols-7">
                    {etapas.map((etapa, indice) => {
                      const atual =
                        !etapa.concluida &&
                        indice === quantidadeConcluida;

                      return (
                        <div
                          key={etapa.titulo}
                          className={[
                            "relative flex min-h-[72px] items-center gap-3 rounded-xl border px-3 py-3 lg:flex-col lg:justify-center lg:gap-2 lg:text-center",
                            etapa.concluida
                              ? "border-emerald-200 bg-white"
                              : atual
                                ? "border-blue-200 bg-white shadow-sm"
                                : "border-slate-200 bg-white/70",
                          ].join(" ")}
                        >
                          <span
                            className={[
                              "relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-4 border-white text-[11px] font-black shadow-sm",
                              etapa.concluida
                                ? "bg-emerald-600 text-white"
                                : atual
                                  ? "bg-blue-600 text-white"
                                  : "bg-slate-200 text-slate-500",
                            ].join(" ")}
                          >
                            {etapa.concluida ? "✓" : indice + 1}
                          </span>

                          <div>
                            <p
                              className={[
                                "text-[11px] font-extrabold leading-4",
                                etapa.concluida
                                  ? "text-emerald-800"
                                  : atual
                                    ? "text-blue-800"
                                    : "text-slate-500",
                              ].join(" ")}
                            >
                              {etapa.titulo}
                            </p>

                            <p className="mt-0.5 text-[9px] font-semibold uppercase tracking-wide text-slate-400">
                              {etapa.concluida
                                ? "Concluída"
                                : atual
                                  ? "Etapa atual"
                                  : "Pendente"}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })()}

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
            {[
              {
                titulo: "Solicitação",
                valor: formatarDataExecutiva(
                  coleta.data_solicitacao,
                ),
                sigla: "SO",
              },
              {
                titulo: "Transportadora",
                valor:
                  coleta.transportadora ||
                  "Não definida",
                sigla: "TR",
              },
              {
                titulo: "Prevista",
                valor: formatarDataExecutiva(
                  coleta.data_prevista_coleta,
                ),
                sigla: "PR",
              },
              {
                titulo: "Realizada",
                valor: formatarDataExecutiva(
                  coleta.data_efetiva_coleta ??
                    coleta.data_coleta,
                ),
                sigla: "CR",
              },
              {
                titulo: "CT-e",
                valor:
                  coleta.conhecimento ||
                  "Não informado",
                sigla: "CT",
              },
              {
                titulo: "Chegada ADS",
                valor: formatarDataExecutiva(
                  coleta.data_chegada_ads,
                ),
                sigla: "AD",
              },
              {
                titulo: "Frete",
                valor: formatarMoedaExecutiva(
                  coleta.valor_frete,
                ),
                sigla: "R$",
              },
              {
                titulo: "Cobrança ADS",
                valor:
                  coleta.numero_nf_cobranca_ads
                    ? `NF ${coleta.numero_nf_cobranca_ads}`
                    : "Não emitida",
                sigla: "NF",
              },
            ].map((item) => (
              <div
                key={item.titulo}
                className="group rounded-2xl border border-slate-200 bg-white p-3.5 shadow-[0_8px_24px_-20px_rgba(15,23,42,0.45)] transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[9px] font-extrabold uppercase tracking-[0.14em] text-slate-400">
                      {item.titulo}
                    </p>
                    <p
                      className="mt-2 truncate text-[12px] font-extrabold tracking-[-0.01em] text-slate-800"
                      title={String(item.valor)}
                    >
                      {item.valor}
                    </p>
                  </div>

                  <span className="flex h-7 min-w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 px-1.5 text-[9px] font-black text-slate-500 transition group-hover:bg-slate-900 group-hover:text-white">
                    {item.sigla}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-blue-200/80 bg-gradient-to-br from-blue-50 to-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[9px] font-extrabold uppercase tracking-[0.16em] text-blue-500">
                    Financeiro Transportadora
                  </p>
                  <p className="mt-2 text-[15px] font-black tracking-[-0.02em] text-blue-950">
                    {coleta.status_pagamento_transportadora ||
                      "Não cobrado"}
                  </p>
                </div>
                <span className="rounded-lg bg-blue-100 px-2 py-1 text-[9px] font-black text-blue-700">
                  PAGAR
                </span>
              </div>

              <div className="mt-3 border-t border-blue-100 pt-3 text-[11px] font-semibold text-blue-700">
                Vencimento:{" "}
                <strong>
                  {formatarDataExecutiva(
                    coleta.vencimento_transportadora,
                  )}
                </strong>
              </div>
            </div>

            <div className="rounded-2xl border border-violet-200/80 bg-gradient-to-br from-violet-50 to-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[9px] font-extrabold uppercase tracking-[0.16em] text-violet-500">
                    Financeiro ADS
                  </p>
                  <p className="mt-2 text-[15px] font-black tracking-[-0.02em] text-violet-950">
                    {coleta.status_recebimento_ads ||
                      "Não emitida"}
                  </p>
                </div>
                <span className="rounded-lg bg-violet-100 px-2 py-1 text-[9px] font-black text-violet-700">
                  RECEBER
                </span>
              </div>

              <div className="mt-3 border-t border-violet-100 pt-3 text-[11px] font-semibold text-violet-700">
                Valor:{" "}
                <strong>
                  {formatarMoedaExecutiva(
                    coleta.valor_nf_cobranca_ads,
                  )}
                </strong>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[9px] font-extrabold uppercase tracking-[0.16em] text-slate-400">
                    Documentos vinculados
                  </p>
                  <p className="mt-2 text-[15px] font-black tracking-[-0.02em] text-slate-950">
                    {
                      [
                        coleta.arquivo_nf_cliente,
                        coleta.arquivo_cte,
                        coleta.arquivo_nf_cobranca_ads,
                      ].filter(Boolean).length
                    }{" "}
                    de 3 documentos
                  </p>
                </div>

                <span className="rounded-lg bg-slate-200 px-2 py-1 text-[9px] font-black text-slate-600">
                  DOC
                </span>
              </div>

              <div className="mt-3 border-t border-slate-200 pt-3 text-[11px] font-semibold text-slate-500">
                NF cliente • CT-e • NF cobrança ADS
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="sticky top-3 z-50 mb-3 rounded-2xl border border-slate-200 bg-slate-950/95 p-3 text-white shadow-xl backdrop-blur">
        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-1 text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-300">
            Atalhos rápidos
          </span>

          <button
            type="button"
            onClick={() =>
              irParaAtalho(
                "operacao",
                "cliente-nf",
              )
            }
            className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:border-emerald-500 hover:bg-emerald-600 hover:text-white"
          >
            Cliente e NF
          </button>

          <button
            type="button"
            onClick={() =>
              irParaAtalho(
                "operacao",
                "transportadora",
              )
            }
            className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:border-emerald-500 hover:bg-emerald-600 hover:text-white"
          >
            Transportadora
          </button>

          <button
            type="button"
            onClick={() =>
              irParaAtalho(
                "operacao",
                "coleta-chegada",
              )
            }
            className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:border-emerald-500 hover:bg-emerald-600 hover:text-white"
          >
            Coleta e chegada
          </button>

          <button
            type="button"
            onClick={() =>
              irParaAtalho(
                "transportadora",
                "financeiro-transportadora",
              )
            }
            className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:border-emerald-500 hover:bg-emerald-600 hover:text-white"
          >
            Financeiro — Transportadora
          </button>

          <button
            type="button"
            onClick={() =>
              irParaAtalho(
                "ads",
                "financeiro-ads",
              )
            }
            className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:border-emerald-500 hover:bg-emerald-600 hover:text-white"
          >
            Financeiro — ADS
          </button>

          <button
            type="button"
            onClick={() =>
              irParaAtalho(
                null,
                "timeline",
              )
            }
            className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:border-emerald-500 hover:bg-emerald-600 hover:text-white"
          >
            Timeline
          </button>

          <button
            type="button"
            onClick={() =>
              irParaAtalho(
                null,
                "historico",
              )
            }
            className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:border-emerald-500 hover:bg-emerald-600 hover:text-white"
          >
            Documentos e Histórico
          </button>
        </div>
      </div>

      <div id="resumo" className="scroll-mt-28">
      <details className="group" open>
        <summary className="mb-4 cursor-pointer list-none rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm font-bold text-slate-800 shadow-sm transition hover:bg-slate-50">
          Resumo inteligente da coleta
        </summary>

        <PainelInteligenteColeta
        numeroOv={coleta.numero_ov}
        cliente={coleta.cliente}
        loja={coleta.loja}
        cidade={coleta.cidade}
        estado={coleta.estado}
        status={coleta.status}
        dataSolicitacao={coleta.data_solicitacao}
        dataNf={coleta.data_nf}
        numeroNf={coleta.numero_nf}
        transportadora={coleta.transportadora}
        dataEnvioTransportadora={coleta.data_envio_transportadora}
        dataPrevistaColeta={coleta.data_prevista_coleta}
        dataEfetivaColeta={
          coleta.data_efetiva_coleta ?? coleta.data_coleta
        }
        conhecimento={coleta.conhecimento}
        dataChegadaAds={coleta.data_chegada_ads}
        destino={coleta.destino}
        statusPagamentoTransportadora={
          coleta.status_pagamento_transportadora
        }
        vencimentoTransportadora={coleta.vencimento_transportadora}
        dataPagamentoTransportadora={
          coleta.data_pagamento_transportadora
        }
        statusRecebimentoAds={coleta.status_recebimento_ads}
        vencimentoNfCobrancaAds={coleta.vencimento_nf_cobranca_ads}
        dataRecebimentoPagamentoAds={
          coleta.data_recebimento_pagamento_ads
        }
      />
      </details>
      </div>

      <div id="timeline" className="scroll-mt-28">
      <details className="group">
        <summary className="mb-4 cursor-pointer list-none rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm font-bold text-slate-800 shadow-sm transition hover:bg-slate-50">
          Timeline da coleta
        </summary>

        <TimelineColeta
        dataSolicitacao={coleta.data_solicitacao}
        dataOv={coleta.data_ov}
        numeroOv={coleta.numero_ov}
        dataNf={coleta.data_nf}
        numeroNf={coleta.numero_nf}
        transportadora={coleta.transportadora}
        dataEnvioTransportadora={coleta.data_envio_transportadora}
        dataEfetivaColeta={
          coleta.data_efetiva_coleta ?? coleta.data_coleta
        }
        conhecimento={coleta.conhecimento}
        dataChegadaAds={coleta.data_chegada_ads}
        statusPagamentoTransportadora={
          coleta.status_pagamento_transportadora
        }
        dataPagamentoTransportadora={
          coleta.data_pagamento_transportadora
        }
        statusRecebimentoAds={coleta.status_recebimento_ads}
        dataRecebimentoPagamentoAds={
          coleta.data_recebimento_pagamento_ads
        }
      />
      </details>
      </div>

      <div id="historico" className="scroll-mt-28">
      <details className="group">
        <summary className="mb-4 cursor-pointer list-none rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm font-bold text-slate-800 shadow-sm transition hover:bg-slate-50">
          Documentos e Histórico
        </summary>

        <HistoricoColeta
        coletaId={id}
        atualizarEm={atualizarHistorico}
      />
      </details>
      </div>

      <nav className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="grid gap-3 md:grid-cols-3">
          <button
            type="button"
            onClick={() => setAbaAtiva("operacao")}
            className={classeBotaoAba("operacao")}
          >
            Operação
          </button>

          <button
            type="button"
            onClick={() => setAbaAtiva("transportadora")}
            className={classeBotaoAba("transportadora")}
          >
            Financeiro — Transportadora
          </button>

          <button
            type="button"
            onClick={() => setAbaAtiva("ads")}
            className={classeBotaoAba("ads")}
          >
            Financeiro — ADS
          </button>
        </div>
      </nav>

      <div className={abaAtiva === "operacao" ? "space-y-6" : "hidden"}>
        <article id="cliente-nf" className="scroll-mt-32 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-6">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">
              Etapa 1
            </p>
            <h3 className="mt-1 text-lg font-bold">
              Solicitação do cliente
            </h3>
            <p className="text-sm text-slate-500">
              Informações do cliente e da unidade solicitante.
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            <label className={rotulo}>
              Data da solicitação *
              <input
                type="date"
                name="dataSolicitacao"
                disabled={!podeEditarOperacao}
                required
                defaultValue={coleta.data_solicitacao ?? ""}
                className={campo}
              />
            </label>

            <label className={rotulo}>
              Cliente *
              <select
                name="cliente"
                required
                defaultValue={coleta.cliente ?? ""}
                disabled={carregandoCadastros || !podeEditarOperacao}
                onChange={selecionarCliente}
                className={campo}
              >
                <option value="" disabled>
                  {carregandoCadastros
                    ? "Carregando clientes..."
                    : "Selecione o cliente"}
                </option>

                {coleta.cliente &&
                  !clientes.some(
                    (cliente) =>
                      nomeCliente(cliente) === coleta.cliente,
                  ) && (
                    <option value={coleta.cliente}>
                      {coleta.cliente} — cadastro antigo
                    </option>
                  )}

                {clientes.map((cliente) => (
                  <option
                    key={cliente.id}
                    value={nomeCliente(cliente)}
                    data-id={cliente.id}
                  >
                    {nomeCliente(cliente)}
                    {cliente.unidade ? ` — ${cliente.unidade}` : ""}
                  </option>
                ))}
              </select>
            </label>

            <label className={rotulo}>
              Loja / Unidade *
              <input
                type="text"
                name="unidade"
                disabled={!podeEditarOperacao}
                required
                defaultValue={coleta.loja ?? ""}
                className={campo}
              />
            </label>

            <label className={rotulo}>
              Cidade *
              <input
                type="text"
                name="cidade"
                disabled={!podeEditarOperacao}
                required
                defaultValue={coleta.cidade ?? ""}
                className={campo}
              />
            </label>

            <label className={rotulo}>
              Estado *
              <select
                name="estado"
                disabled={!podeEditarOperacao}
                required
                defaultValue={coleta.estado ?? ""}
                className={campo}
              >
                <option value="" disabled>
                  Selecione
                </option>
                {estados.map((estado) => (
                  <option key={estado} value={estado}>
                    {estado}
                  </option>
                ))}
              </select>
            </label>

            <label className={rotulo}>
              Responsável pela solicitação
              <input
                type="text"
                name="responsavelSolicitacao"
                disabled={!podeEditarOperacao}
                defaultValue={
                  coleta.responsavel_solicitacao ??
                  coleta.responsavel ??
                  ""
                }
                className={campo}
              />
            </label>
          </div>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-6">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">
              Etapa 2
            </p>
            <h3 className="mt-1 text-lg font-bold">
              Ordem de Visita e Nota Fiscal
            </h3>
            <p className="text-sm text-slate-500">
              Documentos utilizados para abertura da operação.
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            <label className={rotulo}>
              Data da OV
              <input
                type="date"
                name="dataOv"
                disabled={!podeEditarOperacao}
                defaultValue={coleta.data_ov ?? ""}
                className={campo}
              />
            </label>

            <label className={rotulo}>
              Número da OV
              <input
                type="text"
                name="numeroOv"
                disabled={!podeEditarOperacao}
                defaultValue={coleta.numero_ov ?? ""}
                className={campo}
              />
            </label>

            <label className={rotulo}>
              Data de emissão da NF
              <input
                type="date"
                name="dataNotaFiscal"
                disabled={!podeEditarOperacao}
                defaultValue={coleta.data_nf ?? ""}
                className={campo}
              />
            </label>

            <label className={rotulo}>
              Número da Nota Fiscal
              <input
                type="text"
                name="numeroNotaFiscal"
                disabled={!podeEditarOperacao}
                defaultValue={coleta.numero_nf ?? ""}
                className={campo}
              />
            </label>

            <label className={`${rotulo} xl:col-span-2`}>
              Anexar / substituir Nota Fiscal
              <input
                type="file"
                name="arquivoNfCliente"
                disabled={!podeEditarOperacao}
                accept=".pdf,.xml,.jpg,.jpeg,.png,application/pdf,application/xml,text/xml,image/jpeg,image/png"
                className={campoArquivo}
              />
              <span className="mt-1 block text-xs font-normal text-slate-500">
                PDF, XML, JPG ou PNG · máximo 10 MB.
                {coleta.arquivo_nf_cliente
                  ? " Um novo arquivo substituirá o atual."
                  : " Nenhum arquivo anexado ainda."}
              </span>

              {coleta.arquivo_nf_cliente && (
                <button
                  type="button"
                  onClick={() =>
                    abrirDocumentoAtual(
                      coleta.arquivo_nf_cliente,
                      "nf-cliente",
                    )
                  }
                  className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800 transition hover:bg-amber-100"
                >
                  {abrindoDocumento === "nf-cliente"
                    ? "Abrindo..."
                    : "Abrir NF atual"}
                </button>
              )}
            </label>
          </div>
        </article>

        <article id="transportadora" className="scroll-mt-32 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-6">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">
              Etapa 3
            </p>
            <h3 className="mt-1 text-lg font-bold">
              Solicitação à transportadora
            </h3>
            <p className="text-sm text-slate-500">
              Dados do envio da solicitação e da programação da coleta.
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            <label className={rotulo}>
              Transportadora
              <select
                name="transportadora"
                defaultValue={coleta.transportadora ?? ""}
                disabled={carregandoCadastros || !podeEditarOperacao}
                onChange={selecionarTransportadora}
                className={campo}
              >
                <option value="">
                  {carregandoCadastros
                    ? "Carregando transportadoras..."
                    : "Selecione a transportadora"}
                </option>

                {coleta.transportadora &&
                  !transportadoras.some(
                    (transportadora) =>
                      transportadora.nome === coleta.transportadora,
                  ) && (
                    <option value={coleta.transportadora}>
                      {coleta.transportadora} — cadastro antigo
                    </option>
                  )}

                {transportadoras.map((transportadora) => (
                  <option
                    key={transportadora.id}
                    value={transportadora.nome}
                    data-id={transportadora.id}
                  >
                    {transportadora.nome}
                  </option>
                ))}
              </select>
            </label>

            <label className={rotulo}>
              Data da solicitação à transportadora
              <input
                type="date"
                name="dataEnvioTransportadora"
                disabled={!podeEditarOperacao}
                defaultValue={coleta.data_envio_transportadora ?? ""}
                className={campo}
              />
            </label>

            <label className={rotulo}>
              Data prevista da coleta
              <input
                type="date"
                name="dataPrevistaColeta"
                disabled={!podeEditarOperacao}
                defaultValue={coleta.data_prevista_coleta ?? ""}
                className={campo}
              />
            </label>

            <label className={rotulo}>
              Contato da transportadora
              <input
                type="text"
                name="contatoTransportadora"
                disabled={!podeEditarOperacao}
                defaultValue={coleta.contato_transportadora ?? ""}
                className={campo}
              />
            </label>

            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <p className="text-sm font-semibold text-emerald-800">
                Status operacional automático
              </p>
              <p className="mt-1 text-xs leading-5 text-emerald-700">
                O sistema recalculará automaticamente a etapa da coleta
                ao salvar as alterações.
              </p>
            </div>
          </div>
        </article>

        <article id="coleta-chegada" className="scroll-mt-32 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-6">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">
              Etapas 4 e 5
            </p>
            <h3 className="mt-1 text-lg font-bold">
              Coleta realizada e recebimento na ADS
            </h3>
            <p className="text-sm text-slate-500">
              Informações preenchidas durante o andamento da operação.
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            <label className={rotulo}>
              Data efetiva da coleta
              <input
                type="date"
                name="dataEfetivaColeta"
                disabled={!podeEditarOperacao}
                defaultValue={
                  coleta.data_efetiva_coleta ??
                  coleta.data_coleta ??
                  ""
                }
                className={campo}
              />
            </label>

            <label className={rotulo}>
              Conhecimento / CT-e
              <input
                type="text"
                name="conhecimento"
                disabled={!podeEditarOperacao}
                defaultValue={coleta.conhecimento ?? ""}
                className={campo}
              />
            </label>

            <label className={rotulo}>
              Anexar / substituir CT-e
              <input
                type="file"
                name="arquivoCte"
                disabled={!podeEditarOperacao}
                accept=".pdf,.xml,.jpg,.jpeg,.png,application/pdf,application/xml,text/xml,image/jpeg,image/png"
                className={campoArquivo}
              />
              <span className="mt-1 block text-xs font-normal text-slate-500">
                PDF, XML, JPG ou PNG · máximo 10 MB.
                {coleta.arquivo_cte
                  ? " Um novo arquivo substituirá o atual."
                  : " Nenhum arquivo anexado ainda."}
              </span>

              {coleta.arquivo_cte && (
                <button
                  type="button"
                  onClick={() =>
                    abrirDocumentoAtual(coleta.arquivo_cte, "cte")
                  }
                  className="mt-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-bold text-blue-800 transition hover:bg-blue-100"
                >
                  {abrindoDocumento === "cte"
                    ? "Abrindo..."
                    : "Abrir CT-e atual"}
                </button>
              )}
            </label>

            <label className={rotulo}>
              Data de chegada na ADS
              <input
                type="date"
                name="dataChegadaAds"
                disabled={!podeEditarOperacao}
                defaultValue={coleta.data_chegada_ads ?? ""}
                className={campo}
              />
            </label>

            <label className={rotulo}>
              Peso coletado em kg
              <input
                type="number"
                name="peso"
                disabled={!podeEditarOperacao}
                min="0"
                step="0.01"
                defaultValue={coleta.peso ?? ""}
                className={campo}
              />
            </label>

            <label className={rotulo}>
              Destino
              <input
                type="text"
                name="destino"
                disabled={!podeEditarOperacao}
                defaultValue={coleta.destino ?? ""}
                className={campo}
              />
            </label>

            <label className={rotulo}>
              Responsável pelo recebimento
              <input
                type="text"
                name="responsavelRecebimento"
                disabled={!podeEditarOperacao}
                defaultValue={coleta.responsavel_recebimento ?? ""}
                className={campo}
              />
            </label>
          </div>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <label className={rotulo}>
            Observações operacionais
            <textarea
              name="observacoes"
              disabled={!podeEditarOperacao}
              rows={5}
              defaultValue={coleta.observacoes ?? ""}
              className={campo}
            />
          </label>
        </article>
      </div>

      <div
        className={
          abaAtiva === "transportadora" ? "space-y-6" : "hidden"
        }
      >
        <article id="financeiro-transportadora" className="scroll-mt-32 rounded-2xl border border-blue-200 bg-white p-6 shadow-sm">
          <div className="mb-6">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-700">
              Financeiro — Transportadora
            </p>
            <h3 className="mt-1 text-lg font-bold">
              Pagamento do frete e do CT-e
            </h3>
            <p className="text-sm text-slate-500">
              Controle da cobrança apresentada pela transportadora.
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            <label className={rotulo}>
              Valor do frete
              <input
                type="number"
                name="valorFrete"
                disabled={!podeEditarFinanceiro}
                min="0"
                step="0.01"
                defaultValue={coleta.valor_frete ?? ""}
                className={campo}
              />
            </label>

            <label className={rotulo}>
              Data de recebimento da cobrança
              <input
                type="date"
                name="dataRecebimentoCobrancaTransportadora"
                disabled={!podeEditarFinanceiro}
                defaultValue={
                  coleta.data_recebimento_cobranca_transportadora ?? ""
                }
                className={campo}
              />
            </label>

            <label className={rotulo}>
              Data de vencimento
              <input
                type="date"
                name="vencimentoTransportadora"
                disabled={!podeEditarFinanceiro}
                defaultValue={coleta.vencimento_transportadora ?? ""}
                className={campo}
              />
            </label>

            <label className={rotulo}>
              Situação do pagamento
              <select
                name="statusPagamentoTransportadora"
                disabled={!podeEditarFinanceiro}
                defaultValue={
                  coleta.status_pagamento_transportadora ?? "Não cobrado"
                }
                className={campo}
              >
                <option value="Não cobrado">Não cobrado</option>
                <option value="Aguardando pagamento">
                  Aguardando pagamento
                </option>
                <option value="Pago">Pago</option>
                <option value="Vencido">Vencido</option>
                <option value="Contestado">Contestado</option>
              </select>
            </label>

            <label className={rotulo}>
              Data do pagamento
              <input
                type="date"
                name="dataPagamentoTransportadora"
                disabled={!podeEditarFinanceiro}
                defaultValue={coleta.data_pagamento_transportadora ?? ""}
                className={campo}
              />
            </label>
          </div>
        </article>

        <article className="rounded-2xl border border-blue-200 bg-white p-6 shadow-sm">
          <label className={rotulo}>
            Observações do pagamento da transportadora
            <textarea
              name="observacoesPagamentoTransportadora"
              disabled={!podeEditarFinanceiro}
              rows={5}
              defaultValue={
                coleta.observacoes_pagamento_transportadora ?? ""
              }
              className={campo}
            />
          </label>
        </article>
      </div>

      <div className={abaAtiva === "ads" ? "space-y-6" : "hidden"}>
        <article id="financeiro-ads" className="scroll-mt-32 rounded-2xl border border-violet-200 bg-white p-6 shadow-sm">
          <div className="mb-6">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-violet-700">
              Financeiro — ADS
            </p>
            <h3 className="mt-1 text-lg font-bold">
              Nota Fiscal de cobrança ao cliente
            </h3>
            <p className="text-sm text-slate-500">
              Controle da cobrança emitida pela ADS após a coleta.
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            <label className={rotulo}>
              Número da NF de cobrança
              <input
                type="text"
                name="numeroNfCobrancaAds"
                disabled={!podeEditarFinanceiro}
                defaultValue={coleta.numero_nf_cobranca_ads ?? ""}
                className={campo}
              />
            </label>

            <label className={rotulo}>
              Anexar / substituir NF de cobrança
              <input
                type="file"
                name="arquivoNfCobrancaAds"
                disabled={!podeEditarFinanceiro}
                accept=".pdf,.xml,.jpg,.jpeg,.png,application/pdf,application/xml,text/xml,image/jpeg,image/png"
                className={campoArquivo}
              />
              <span className="mt-1 block text-xs font-normal text-slate-500">
                PDF, XML, JPG ou PNG · máximo 10 MB.
                {coleta.arquivo_nf_cobranca_ads
                  ? " Um novo arquivo substituirá o atual."
                  : " Nenhum arquivo anexado ainda."}
              </span>

              {coleta.arquivo_nf_cobranca_ads && (
                <button
                  type="button"
                  onClick={() =>
                    abrirDocumentoAtual(
                      coleta.arquivo_nf_cobranca_ads,
                      "nf-ads",
                    )
                  }
                  className="mt-2 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-xs font-bold text-violet-800 transition hover:bg-violet-100"
                >
                  {abrindoDocumento === "nf-ads"
                    ? "Abrindo..."
                    : "Abrir NF atual"}
                </button>
              )}
            </label>

            <label className={rotulo}>
              Data de emissão
              <input
                type="date"
                name="dataEmissaoNfCobrancaAds"
                disabled={!podeEditarFinanceiro}
                defaultValue={coleta.data_emissao_nf_cobranca_ads ?? ""}
                className={campo}
              />
            </label>

            <label className={rotulo}>
              Valor da cobrança
              <input
                type="number"
                name="valorNfCobrancaAds"
                disabled={!podeEditarFinanceiro}
                min="0"
                step="0.01"
                defaultValue={coleta.valor_nf_cobranca_ads ?? ""}
                className={campo}
              />
            </label>

            <label className={rotulo}>
              Data de vencimento
              <input
                type="date"
                name="vencimentoNfCobrancaAds"
                disabled={!podeEditarFinanceiro}
                defaultValue={coleta.vencimento_nf_cobranca_ads ?? ""}
                className={campo}
              />
            </label>

            <label className={rotulo}>
              Situação do recebimento
              <select
                name="statusRecebimentoAds"
                disabled={!podeEditarFinanceiro}
                defaultValue={
                  coleta.status_recebimento_ads ?? "Não emitida"
                }
                className={campo}
              >
                <option value="Não emitida">Não emitida</option>
                <option value="Emitida">Emitida</option>
                <option value="Aguardando recebimento">
                  Aguardando recebimento
                </option>
                <option value="Paga">Paga</option>
                <option value="Vencida">Vencida</option>
                <option value="Cancelada">Cancelada</option>
              </select>
            </label>

            <label className={rotulo}>
              Data do recebimento
              <input
                type="date"
                name="dataRecebimentoPagamentoAds"
                disabled={!podeEditarFinanceiro}
                defaultValue={
                  coleta.data_recebimento_pagamento_ads ?? ""
                }
                className={campo}
              />
            </label>
          </div>
        </article>

        <article className="rounded-2xl border border-violet-200 bg-white p-6 shadow-sm">
          <label className={rotulo}>
            Observações da cobrança ADS
            <textarea
              name="observacoesCobrancaAds"
              disabled={!podeEditarFinanceiro}
              rows={5}
              defaultValue={coleta.observacoes_cobranca_ads ?? ""}
              className={campo}
            />
          </label>
        </article>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        {podeExcluir ? (
          <button
            type="button"
            onClick={excluirColeta}
            disabled={salvando || excluindo}
            className="rounded-xl border border-red-300 bg-red-50 px-6 py-3 text-sm font-semibold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {excluindo ? "Excluindo..." : "Excluir coleta"}
          </button>
        ) : (
          <span className="text-xs font-semibold text-slate-400">
            {modoConsulta ? "Somente consulta" : "Exclusão não permitida para este perfil"}
          </span>
        )}

        <div className="flex flex-col-reverse gap-3 sm:flex-row">
          <Link
            href="/coletas"
            className="rounded-xl border border-slate-300 bg-white px-6 py-3 text-center text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Voltar
          </Link>

          {podeSalvar && (
            <button
              type="submit"
              disabled={salvando || excluindo}
              className="rounded-xl bg-emerald-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {salvando ? "Salvando..." : "Salvar alterações"}
            </button>
          )}
        </div>
      </div>
    </form>
  );
}