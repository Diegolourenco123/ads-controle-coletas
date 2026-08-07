"use client";

import Link from "next/link";
import {
  FormEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import { supabase } from "../lib/supabase";

type Aba = "operacao" | "transportadora" | "ads";

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

type UnidadeMestre = {
  id: number;
  cliente_id: number;
  nome: string;
  cidade: string | null;
  estado: string | null;
  endereco: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cep: string | null;
  cnpj: string | null;
  razao_social: string | null;
  nome_fantasia: string | null;
};

type TransportadoraMestre = {
  id: number;
  nome: string;
  contato: string | null;
  telefone: string | null;
  email: string | null;
};

const campo =
  "mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100";

const rotulo =
  "text-sm font-semibold text-slate-700";

const campoArquivo =
  "mt-2 block w-full cursor-pointer rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-emerald-50 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-emerald-700 hover:file:bg-emerald-100";

const BUCKET_DOCUMENTOS = "documentos-coletas";
const LIMITE_ARQUIVO = 10 * 1024 * 1024;

const tiposArquivoPermitidos = [
  "application/pdf",
  "application/xml",
  "text/xml",
  "image/jpeg",
  "image/png",
];

const extensoesPermitidas = [
  ".pdf",
  ".xml",
  ".jpg",
  ".jpeg",
  ".png",
];

const estados = [
  "AC",
  "AL",
  "AP",
  "AM",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MT",
  "MS",
  "MG",
  "PA",
  "PB",
  "PR",
  "PE",
  "PI",
  "RJ",
  "RN",
  "RS",
  "RO",
  "RR",
  "SC",
  "SP",
  "SE",
  "TO",
];

function nomeCliente(cliente: ClienteMestre) {
  return (
    cliente.nome_fantasia?.trim() ||
    cliente.razao_social?.trim() ||
    `Cliente #${cliente.id}`
  );
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
    .replace(/-+/g, "-");
}

function validarArquivo(arquivo: File) {
  if (arquivo.size > LIMITE_ARQUIVO) {
    return "O arquivo ultrapassa o limite de 10 MB.";
  }

  const nomeMinusculo = arquivo.name.toLowerCase();

  const extensaoValida = extensoesPermitidas.some(
    (extensao) => nomeMinusculo.endsWith(extensao),
  );

  const tipoValido =
    !arquivo.type ||
    tiposArquivoPermitidos.includes(arquivo.type);

  if (!extensaoValida || !tipoValido) {
    return "Formato não permitido. Utilize PDF, XML, JPG, JPEG ou PNG.";
  }

  return null;
}

function calcularStatusOperacional(dados: FormData) {
  const obterValor = (nome: string) =>
    dados.get(nome)?.toString().trim() ?? "";

  const dataNotaFiscal =
    obterValor("dataNotaFiscal");

  const numeroNotaFiscal =
    obterValor("numeroNotaFiscal");

  const transportadora =
    obterValor("transportadora");

  const dataEnvioTransportadora =
    obterValor("dataEnvioTransportadora");

  const dataEfetivaColeta =
    obterValor("dataEfetivaColeta");

  const dataChegadaAds =
    obterValor("dataChegadaAds");

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

  if (
    dataNotaFiscal &&
    numeroNotaFiscal &&
    transportadora &&
    dataEnvioTransportadora
  ) {
    return "Aguardando coleta";
  }

  if (
    dataNotaFiscal &&
    numeroNotaFiscal
  ) {
    return "Aguardando coleta";
  }

  return "Aguardando NF";
}

export default function FormNovaColeta() {
  const formularioRef =
    useRef<HTMLFormElement>(null);

  const autocompleteUnidadeRef =
    useRef<HTMLDivElement>(null);

  const [clientes, setClientes] = useState<
    ClienteMestre[]
  >([]);

  const [unidades, setUnidades] = useState<
    UnidadeMestre[]
  >([]);

  const [buscaUnidade, setBuscaUnidade] =
    useState("");

  const [
    unidadeSelecionada,
    setUnidadeSelecionada,
  ] = useState<UnidadeMestre | null>(null);

  const [
    listaUnidadesAberta,
    setListaUnidadesAberta,
  ] = useState(false);

  const [
    clienteSelecionadoId,
    setClienteSelecionadoId,
  ] = useState<number | null>(null);

  const [
    carregandoUnidades,
    setCarregandoUnidades,
  ] = useState(false);

  const [
    transportadoras,
    setTransportadoras,
  ] = useState<TransportadoraMestre[]>([]);

  const [
    carregandoCadastros,
    setCarregandoCadastros,
  ] = useState(true);

  const [
    erroCadastros,
    setErroCadastros,
  ] = useState("");

  const [abaAtiva, setAbaAtiva] =
    useState<Aba>("operacao");

  const [mensagem, setMensagem] =
    useState("");

  const [tipoMensagem, setTipoMensagem] =
    useState<
      "sucesso" | "erro" | "carregando"
    >("sucesso");

  const [salvando, setSalvando] =
    useState(false);

  useEffect(() => {
    async function carregarCadastrosMestres() {
      setCarregandoCadastros(true);
      setErroCadastros("");

      const [
        {
          data: dadosClientes,
          error: erroClientes,
        },
        {
          data: dadosTransportadoras,
          error: erroTransportadoras,
        },
      ] = await Promise.all([
        supabase
          .from("clientes")
          .select(
            `
              id,
              razao_social,
              nome_fantasia,
              unidade,
              cidade,
              estado,
              responsavel,
              transportadora_padrao
            `,
          )
          .order("nome_fantasia", {
            ascending: true,
          }),

        supabase
          .from("transportadoras")
          .select(
            "id, nome, contato, telefone, email",
          )
          .order("nome", {
            ascending: true,
          }),
      ]);

      if (
        erroClientes ||
        erroTransportadoras
      ) {
        console.error(
          "Erro ao carregar cadastros mestres:",
          erroClientes ??
            erroTransportadoras,
        );

        setErroCadastros(
          "Não foi possível carregar clientes ou transportadoras.",
        );
      }

      setClientes(
        (dadosClientes ?? []) as ClienteMestre[],
      );

      setTransportadoras(
        (dadosTransportadoras ??
          []) as TransportadoraMestre[],
      );

      setCarregandoCadastros(false);
    }

    carregarCadastrosMestres();

    const canal = supabase
      .channel(
        "cadastros-mestres-nova-coleta",
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "clientes",
        },
        carregarCadastrosMestres,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "transportadoras",
        },
        carregarCadastrosMestres,
      )
      .subscribe();

    return () => {
      supabase.removeChannel(canal);
    };
  }, []);

  useEffect(() => {
    function fecharAutocomplete(
      evento: MouseEvent,
    ) {
      const alvo = evento.target as Node;

      if (
        autocompleteUnidadeRef.current &&
        !autocompleteUnidadeRef.current.contains(
          alvo,
        )
      ) {
        setListaUnidadesAberta(false);
      }
    }

    document.addEventListener(
      "mousedown",
      fecharAutocomplete,
    );

    return () => {
      document.removeEventListener(
        "mousedown",
        fecharAutocomplete,
      );
    };
  }, []);

  function preencherCampo(
    nome: string,
    valor: string | null,
  ) {
    const campoFormulario =
      formularioRef.current?.elements.namedItem(
        nome,
      ) as
        | HTMLInputElement
        | HTMLSelectElement
        | null;

    if (campoFormulario) {
      campoFormulario.value =
        valor ?? "";
    }
  }

  async function carregarUnidades(
    clienteId: number,
  ) {
    setCarregandoUnidades(true);
    setErroCadastros("");
    setUnidades([]);

    const { data, error } =
      await supabase
        .from("unidades")
        .select(
          `
            id,
            cliente_id,
            nome,
            cidade,
            estado,
            endereco,
            numero,
            complemento,
            bairro,
            cep,
            cnpj,
            razao_social,
            nome_fantasia
          `,
        )
        .eq(
          "cliente_id",
          clienteId,
        )
        .order("nome", {
          ascending: true,
        });

    if (error) {
      console.error(
        "Erro ao carregar unidades:",
        error,
      );

      setErroCadastros(
        `Não foi possível carregar as unidades: ${error.message}`,
      );

      setCarregandoUnidades(false);
      return;
    }

    const lista =
      (data ?? []) as UnidadeMestre[];

    console.log(
      `Unidades encontradas para o cliente ${clienteId}:`,
      lista.length,
    );

    setUnidades(lista);
    setCarregandoUnidades(false);
  }

  async function selecionarCliente(
    evento: React.ChangeEvent<HTMLSelectElement>,
  ) {
    const clienteId = Number(
      evento.target
        .selectedOptions[0]?.dataset.id,
    );

    setUnidades([]);
    setBuscaUnidade("");
    setUnidadeSelecionada(null);
    setListaUnidadesAberta(false);

    preencherCampo(
      "cidade",
      "",
    );

    preencherCampo(
      "estado",
      "",
    );

    if (!clienteId) {
      setClienteSelecionadoId(null);
      return;
    }

    setClienteSelecionadoId(clienteId);

    const clienteSelecionado =
      clientes.find(
        (cliente) =>
          cliente.id === clienteId,
      );

    if (!clienteSelecionado) {
      return;
    }

    preencherCampo(
      "responsavelSolicitacao",
      clienteSelecionado.responsavel,
    );

    if (
      clienteSelecionado.transportadora_padrao
    ) {
      preencherCampo(
        "transportadora",
        clienteSelecionado
          .transportadora_padrao,
      );

      const transportadoraPadrao =
        transportadoras.find(
          (transportadora) =>
            normalizarTexto(
              transportadora.nome,
            ) ===
            normalizarTexto(
              clienteSelecionado
                .transportadora_padrao ??
                "",
            ),
        );

      preencherCampo(
        "contatoTransportadora",
        transportadoraPadrao?.contato ?? "",
      );

      preencherCampo(
        "telefoneTransportadora",
        transportadoraPadrao?.telefone ?? "",
      );

      preencherCampo(
        "emailTransportadora",
        transportadoraPadrao?.email ?? "",
      );
    }

    await carregarUnidades(
      clienteId,
    );
  }

  function selecionarUnidade(
    unidade: UnidadeMestre,
  ) {
    setUnidadeSelecionada(unidade);
    setBuscaUnidade(unidade.nome);
    setListaUnidadesAberta(false);

    preencherCampo(
      "cidade",
      unidade.cidade,
    );

    preencherCampo(
      "estado",
      unidade.estado,
    );
  }

  function selecionarTransportadora(
    evento: React.ChangeEvent<HTMLSelectElement>,
  ) {
    const transportadoraId =
      Number(
        evento.target
          .selectedOptions[0]?.dataset.id,
      );

    const transportadoraSelecionada =
      transportadoras.find(
        (transportadora) =>
          transportadora.id ===
          transportadoraId,
      );

    preencherCampo(
      "contatoTransportadora",
      transportadoraSelecionada?.contato ?? "",
    );

    preencherCampo(
      "telefoneTransportadora",
      transportadoraSelecionada?.telefone ?? "",
    );

    preencherCampo(
      "emailTransportadora",
      transportadoraSelecionada?.email ?? "",
    );
  }

  const termoUnidade =
    normalizarTexto(buscaUnidade);

  const unidadesFiltradas = unidades
    .filter((unidade) => {
      if (!termoUnidade) {
        return true;
      }

      const conteudo = normalizarTexto(
        [
          unidade.nome,
          unidade.cidade,
          unidade.estado,
          unidade.cnpj,
        ]
          .filter(Boolean)
          .join(" "),
      );

      return conteudo.includes(
        termoUnidade,
      );
    })
    .slice(0, 12);

  async function enviarDocumento(
    arquivo: File,
    pastaColeta: string,
    categoria: string,
  ) {
    const erroValidacao = validarArquivo(arquivo);

    if (erroValidacao) {
      throw new Error(
        `${arquivo.name}: ${erroValidacao}`,
      );
    }

    const {
      data: { session },
      error: erroSessao,
    } = await supabase.auth.getSession();

    console.log(
      "Sessão no momento do upload:",
      session,
    );

    if (erroSessao) {
      console.error(
        "Erro ao verificar sessão:",
        erroSessao,
      );

      throw new Error(
        `Não foi possível verificar a sessão: ${erroSessao.message}`,
      );
    }

    if (!session) {
      throw new Error(
        "Sessão do Supabase não encontrada. Saia do sistema, entre novamente e tente anexar o documento.",
      );
    }

    console.log(
      "Usuário autenticado no upload:",
      session.user.email,
    );

    const caminho = `${pastaColeta}/${categoria}-${Date.now()}-${nomeArquivoSeguro(
      arquivo.name,
    )}`;

    const { error } = await supabase.storage
      .from(BUCKET_DOCUMENTOS)
      .upload(caminho, arquivo, {
        cacheControl: "3600",
        upsert: false,
        contentType:
          arquivo.type || undefined,
      });

    if (error) {
      throw new Error(
        `Falha ao enviar ${arquivo.name}: ${error.message}`,
      );
    }

    return caminho;
  }

  async function salvarColeta(
    evento: FormEvent<HTMLFormElement>,
  ) {
    evento.preventDefault();

    const formulario =
      evento.currentTarget;

    if (!unidadeSelecionada) {
      setAbaAtiva("operacao");
      setTipoMensagem("erro");
      setMensagem(
        "Selecione uma loja / unidade válida antes de salvar.",
      );
      setListaUnidadesAberta(true);
      return;
    }

    if (!formulario.checkValidity()) {
      formulario.reportValidity();
      setAbaAtiva("operacao");
      return;
    }

    setSalvando(true);

    setTipoMensagem(
      "carregando",
    );

    setMensagem(
      "Preparando coleta e documentos...",
    );

    const dados =
      new FormData(formulario);

    const valorOuNulo = (
      nome: string,
    ) => {
      const valor = dados
        .get(nome)
        ?.toString()
        .trim();

      return valor
        ? valor
        : null;
    };

    const numeroOuNulo = (
      nome: string,
    ) => {
      const valor =
        valorOuNulo(nome);

      if (!valor) {
        return null;
      }

      const numero = Number(
        valor.replace(",", "."),
      );

      return Number.isNaN(numero)
        ? null
        : numero;
    };

    const dataEfetivaColeta =
      valorOuNulo(
        "dataEfetivaColeta",
      );

    const statusAutomatico =
      calcularStatusOperacional(
        dados,
      );

    const obterArquivo = (
      nome: string,
    ) => {
      const valor = dados.get(nome);

      if (
        valor instanceof File &&
        valor.size > 0
      ) {
        return valor;
      }

      return null;
    };

    const arquivoNfCliente =
      obterArquivo("arquivoNfCliente");

    const arquivoCte =
      obterArquivo("arquivoCte");

    const arquivoNfCobrancaAds =
      obterArquivo(
        "arquivoNfCobrancaAds",
      );

    const pastaColeta =
      typeof crypto !== "undefined" &&
      "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random()
            .toString(36)
            .slice(2)}`;

    const caminhosEnviados: string[] = [];

    let caminhoNfCliente: string | null =
      null;

    let caminhoCte: string | null =
      null;

    let caminhoNfCobrancaAds:
      | string
      | null = null;

    try {
      if (
        arquivoNfCliente ||
        arquivoCte ||
        arquivoNfCobrancaAds
      ) {
        setMensagem(
          "Enviando documentos...",
        );
      }

      if (arquivoNfCliente) {
        caminhoNfCliente =
          await enviarDocumento(
            arquivoNfCliente,
            pastaColeta,
            "nf-cliente",
          );

        caminhosEnviados.push(
          caminhoNfCliente,
        );
      }

      if (arquivoCte) {
        caminhoCte =
          await enviarDocumento(
            arquivoCte,
            pastaColeta,
            "cte",
          );

        caminhosEnviados.push(
          caminhoCte,
        );
      }

      if (arquivoNfCobrancaAds) {
        caminhoNfCobrancaAds =
          await enviarDocumento(
            arquivoNfCobrancaAds,
            pastaColeta,
            "nf-cobranca-ads",
          );

        caminhosEnviados.push(
          caminhoNfCobrancaAds,
        );
      }
    } catch (erro) {
      if (caminhosEnviados.length > 0) {
        await supabase.storage
          .from(BUCKET_DOCUMENTOS)
          .remove(caminhosEnviados);
      }

      const mensagemErro =
        erro instanceof Error
          ? erro.message
          : "Não foi possível enviar os documentos.";

      console.error(
        "Erro no upload:",
        erro,
      );

      setTipoMensagem("erro");
      setMensagem(mensagemErro);
      setSalvando(false);
      return;
    }

    const novaColeta = {
      data_solicitacao:
        valorOuNulo(
          "dataSolicitacao",
        ),

      cliente:
        valorOuNulo("cliente"),

      loja:
        valorOuNulo("unidade"),

      cidade:
        valorOuNulo("cidade"),

      estado:
        valorOuNulo("estado"),

      responsavel:
        valorOuNulo(
          "responsavelSolicitacao",
        ),

      responsavel_solicitacao:
        valorOuNulo(
          "responsavelSolicitacao",
        ),

      data_ov:
        valorOuNulo("dataOv"),

      numero_ov:
        valorOuNulo(
          "numeroOv",
        ),

      data_nf:
        valorOuNulo(
          "dataNotaFiscal",
        ),

      numero_nf:
        valorOuNulo(
          "numeroNotaFiscal",
        ),

      arquivo_nf_cliente:
        caminhoNfCliente,

      arquivo_cte:
        caminhoCte,

      arquivo_nf_cobranca_ads:
        caminhoNfCobrancaAds,

      transportadora:
        valorOuNulo(
          "transportadora",
        ),

      data_envio_transportadora:
        valorOuNulo(
          "dataEnvioTransportadora",
        ),

      data_prevista_coleta:
        valorOuNulo(
          "dataPrevistaColeta",
        ),

      protocolo_transportadora:
        valorOuNulo(
          "protocoloTransportadora",
        ),

      contato_transportadora:
        valorOuNulo(
          "contatoTransportadora",
        ),

      telefone_transportadora:
        valorOuNulo(
          "telefoneTransportadora",
        ),

      email_transportadora:
        valorOuNulo(
          "emailTransportadora",
        ),

      status:
        statusAutomatico,

      data_coleta:
        dataEfetivaColeta,

      data_efetiva_coleta:
        dataEfetivaColeta,

      conhecimento:
        valorOuNulo(
          "conhecimento",
        ),

      data_chegada_ads:
        valorOuNulo(
          "dataChegadaAds",
        ),

      peso:
        numeroOuNulo("peso"),

      destino:
        valorOuNulo("destino"),

      responsavel_recebimento:
        valorOuNulo(
          "responsavelRecebimento",
        ),

      observacoes:
        valorOuNulo(
          "observacoes",
        ),

      valor_frete:
        numeroOuNulo(
          "valorFrete",
        ),

      data_recebimento_cobranca_transportadora:
        valorOuNulo(
          "dataRecebimentoCobrancaTransportadora",
        ),

      vencimento_transportadora:
        valorOuNulo(
          "vencimentoTransportadora",
        ),

      status_pagamento_transportadora:
        valorOuNulo(
          "statusPagamentoTransportadora",
        ),

      data_pagamento_transportadora:
        valorOuNulo(
          "dataPagamentoTransportadora",
        ),

      observacoes_pagamento_transportadora:
        valorOuNulo(
          "observacoesPagamentoTransportadora",
        ),

      numero_nf_cobranca_ads:
        valorOuNulo(
          "numeroNfCobrancaAds",
        ),

      data_emissao_nf_cobranca_ads:
        valorOuNulo(
          "dataEmissaoNfCobrancaAds",
        ),

      valor_nf_cobranca_ads:
        numeroOuNulo(
          "valorNfCobrancaAds",
        ),

      vencimento_nf_cobranca_ads:
        valorOuNulo(
          "vencimentoNfCobrancaAds",
        ),

      status_recebimento_ads:
        valorOuNulo(
          "statusRecebimentoAds",
        ),

      data_recebimento_pagamento_ads:
        valorOuNulo(
          "dataRecebimentoPagamentoAds",
        ),

      observacoes_cobranca_ads:
        valorOuNulo(
          "observacoesCobrancaAds",
        ),
    };

    const { error } =
      await supabase
        .from("coletas")
        .insert(novaColeta);

    if (error) {
      console.error(
        "Erro ao salvar coleta:",
        error,
      );

      if (caminhosEnviados.length > 0) {
        await supabase.storage
          .from(BUCKET_DOCUMENTOS)
          .remove(caminhosEnviados);
      }

      setTipoMensagem(
        "erro",
      );

      setMensagem(
        `Não foi possível salvar: ${error.message}`,
      );

      setSalvando(false);

      return;
    }

    setTipoMensagem(
      "sucesso",
    );

    setMensagem(
      `Coleta cadastrada com sucesso! Status: ${statusAutomatico}.`,
    );

    formulario.reset();

    setUnidades([]);
    setBuscaUnidade("");
    setUnidadeSelecionada(null);
    setListaUnidadesAberta(false);
    setClienteSelecionadoId(null);

    setAbaAtiva("operacao");

    setSalvando(false);

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  function classeBotaoAba(
    aba: Aba,
  ) {
    return [
      "rounded-xl px-4 py-3 text-sm font-semibold transition",

      abaAtiva === aba
        ? "bg-emerald-600 text-white shadow-sm"
        : "bg-slate-100 text-slate-600 hover:bg-slate-200",
    ].join(" ");
  }

  function classeMensagem() {
    if (
      tipoMensagem ===
      "erro"
    ) {
      return "border-red-200 bg-red-50 text-red-800";
    }

    if (
      tipoMensagem ===
      "carregando"
    ) {
      return "border-blue-200 bg-blue-50 text-blue-800";
    }

    return "border-emerald-200 bg-emerald-50 text-emerald-800";
  }

  return (
    <form
      ref={formularioRef}
      onSubmit={salvarColeta}
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

      <nav className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="grid gap-3 md:grid-cols-3">
          <button
            type="button"
            onClick={() =>
              setAbaAtiva(
                "operacao",
              )
            }
            className={classeBotaoAba(
              "operacao",
            )}
          >
            Operação
          </button>

          <button
            type="button"
            onClick={() =>
              setAbaAtiva(
                "transportadora",
              )
            }
            className={classeBotaoAba(
              "transportadora",
            )}
          >
            Financeiro —
            Transportadora
          </button>

          <button
            type="button"
            onClick={() =>
              setAbaAtiva(
                "ads",
              )
            }
            className={classeBotaoAba(
              "ads",
            )}
          >
            Financeiro — ADS
          </button>
        </div>
      </nav>

      <div
        className={
          abaAtiva ===
          "operacao"
            ? "space-y-6"
            : "hidden"
        }
      >
        <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-6">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">
              Etapa 1
            </p>

            <h3 className="mt-1 text-lg font-bold">
              Solicitação do cliente
            </h3>

            <p className="text-sm text-slate-500">
              Informações do cliente e da unidade
              solicitante.
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            <label
              className={
                rotulo
              }
            >
              Data da solicitação *
              <input
                type="date"
                name="dataSolicitacao"
                required
                className={
                  campo
                }
              />
            </label>

            <label
              className={
                rotulo
              }
            >
              Cliente *
              <select
                name="cliente"
                required
                defaultValue=""
                disabled={
                  carregandoCadastros
                }
                onChange={
                  selecionarCliente
                }
                className={
                  campo
                }
              >
                <option
                  value=""
                  disabled
                >
                  {carregandoCadastros
                    ? "Carregando clientes..."
                    : "Selecione o cliente"}
                </option>

                {clientes.map(
                  (
                    cliente,
                  ) => (
                    <option
                      key={
                        cliente.id
                      }
                      value={nomeCliente(
                        cliente,
                      )}
                      data-id={
                        cliente.id
                      }
                    >
                      {nomeCliente(
                        cliente,
                      )}
                    </option>
                  ),
                )}
              </select>
            </label>

            <div
              ref={autocompleteUnidadeRef}
              className="relative"
            >
              <label className={rotulo}>
                Loja / Unidade *
              </label>

              <input
                type="hidden"
                name="unidade"
                value={
                  unidadeSelecionada?.nome ??
                  ""
                }
              />

              <input
                type="text"
                value={buscaUnidade}
                disabled={
                  !clienteSelecionadoId ||
                  carregandoUnidades
                }
                onFocus={() => {
                  if (
                    clienteSelecionadoId &&
                    !carregandoUnidades
                  ) {
                    setListaUnidadesAberta(
                      true,
                    );
                  }
                }}
                onChange={(evento) => {
                  setBuscaUnidade(
                    evento.target.value,
                  );
                  setUnidadeSelecionada(
                    null,
                  );
                  setListaUnidadesAberta(
                    true,
                  );

                  preencherCampo(
                    "cidade",
                    "",
                  );

                  preencherCampo(
                    "estado",
                    "",
                  );
                }}
                placeholder={
                  carregandoUnidades
                    ? "Carregando unidades..."
                    : !clienteSelecionadoId
                      ? "Selecione primeiro o cliente"
                      : "Digite o número, nome ou cidade da loja"
                }
                autoComplete="off"
                className={campo}
              />

              {listaUnidadesAberta &&
                clienteSelecionadoId &&
                !carregandoUnidades && (
                  <div className="absolute z-50 mt-2 max-h-80 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl">
                    {unidadesFiltradas.length >
                    0 ? (
                      unidadesFiltradas.map(
                        (unidade) => (
                          <button
                            key={
                              unidade.id
                            }
                            type="button"
                            onClick={() =>
                              selecionarUnidade(
                                unidade,
                              )
                            }
                            className="block w-full border-b border-slate-100 px-4 py-3 text-left text-sm text-slate-700 transition last:border-b-0 hover:bg-emerald-50 hover:text-emerald-800"
                          >
                            <span className="block font-semibold">
                              {
                                unidade.nome
                              }
                            </span>

                            {(unidade.cidade ||
                              unidade.estado) && (
                              <span className="mt-1 block text-xs text-slate-500">
                                {[
                                  unidade.cidade,
                                  unidade.estado,
                                ]
                                  .filter(
                                    Boolean,
                                  )
                                  .join(
                                    " • ",
                                  )}
                              </span>
                            )}
                          </button>
                        ),
                      )
                    ) : (
                      <div className="px-4 py-4 text-sm text-slate-500">
                        Nenhuma unidade
                        encontrada para esta
                        pesquisa.
                      </div>
                    )}

                    {unidades.length > 12 &&
                      !termoUnidade && (
                        <div className="border-t border-slate-100 bg-slate-50 px-4 py-2 text-xs text-slate-500">
                          Digite o número,
                          nome ou cidade para
                          filtrar as{" "}
                          {unidades.length}{" "}
                          unidades.
                        </div>
                      )}
                  </div>
                )}
            </div>

            <label
              className={
                rotulo
              }
            >
              Cidade *
              <input
                type="text"
                name="cidade"
                required
                placeholder="Preenchimento automático"
                className={
                  campo
                }
              />
            </label>

            <label
              className={
                rotulo
              }
            >
              Estado *
              <select
                name="estado"
                required
                defaultValue=""
                className={
                  campo
                }
              >
                <option
                  value=""
                  disabled
                >
                  Selecione
                </option>

                {estados.map(
                  (
                    estado,
                  ) => (
                    <option
                      key={
                        estado
                      }
                      value={
                        estado
                      }
                    >
                      {
                        estado
                      }
                    </option>
                  ),
                )}
              </select>
            </label>

            <label
              className={
                rotulo
              }
            >
              Responsável pela solicitação
              <input
                type="text"
                name="responsavelSolicitacao"
                placeholder="Nome do solicitante"
                className={
                  campo
                }
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
              Documentos utilizados para abertura da
              operação.
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            <label className={rotulo}>
              Data da OV *
              <input
                type="date"
                name="dataOv"
                required
                className={campo}
              />
            </label>

            <label className={rotulo}>
              Número da OV *
              <input
                type="text"
                name="numeroOv"
                required
                placeholder="Ex.: OV-1026"
                className={campo}
              />
            </label>

            <label className={rotulo}>
              Data de emissão da NF
              <input
                type="date"
                name="dataNotaFiscal"
                className={campo}
              />
            </label>

            <label className={rotulo}>
              Número da Nota Fiscal
              <input
                type="text"
                name="numeroNotaFiscal"
                placeholder="Ex.: 45880"
                className={campo}
              />
            </label>

            <label className={rotulo}>
              Anexar Nota Fiscal
              <input
                type="file"
                name="arquivoNfCliente"
                accept=".pdf,.xml,.jpg,.jpeg,.png,application/pdf,application/xml,text/xml,image/jpeg,image/png"
                className={campoArquivo}
              />
              <span className="mt-1 block text-xs font-normal text-slate-500">
                PDF, XML, JPG ou PNG · máximo 10 MB
              </span>
            </label>
          </div>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-6">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">
              Etapa 3
            </p>

            <h3 className="mt-1 text-lg font-bold">
              Solicitação à transportadora
            </h3>

            <p className="text-sm text-slate-500">
              Dados do envio da solicitação e da programação
              da coleta.
            </p>
          </div>

          <div className="space-y-6">
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
              <label className={`${rotulo} xl:col-span-2`}>
                Transportadora
                <select
                  name="transportadora"
                  defaultValue=""
                  disabled={
                    carregandoCadastros
                  }
                  onChange={
                    selecionarTransportadora
                  }
                  className={campo}
                >
                  <option value="">
                    {carregandoCadastros
                      ? "Carregando transportadoras..."
                      : "Selecione a transportadora"}
                  </option>

                  {transportadoras.map(
                    (
                      transportadora,
                    ) => (
                      <option
                        key={
                          transportadora.id
                        }
                        value={
                          transportadora.nome
                        }
                        data-id={
                          transportadora.id
                        }
                      >
                        {
                          transportadora.nome
                        }
                      </option>
                    ),
                  )}
                </select>
              </label>

              <label className={rotulo}>
                Data da solicitação à transportadora
                <input
                  type="date"
                  name="dataEnvioTransportadora"
                  className={campo}
                />
              </label>

              <label className={rotulo}>
                Data prevista da coleta
                <input
                  type="date"
                  name="dataPrevistaColeta"
                  className={campo}
                />
              </label>
            </div>

            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
              <label className={rotulo}>
                Contato
                <input
                  type="text"
                  name="contatoTransportadora"
                  placeholder="Nome do contato"
                  className={campo}
                />
              </label>

              <label className={rotulo}>
                Telefone
                <input
                  type="text"
                  name="telefoneTransportadora"
                  placeholder="(00) 00000-0000"
                  className={campo}
                />
              </label>

              <label className={`${rotulo} xl:col-span-2`}>
                E-mail
                <input
                  type="email"
                  name="emailTransportadora"
                  placeholder="contato@transportadora.com.br"
                  className={campo}
                />
              </label>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <label className={rotulo}>
                Protocolo da solicitação
                <input
                  type="text"
                  name="protocoloTransportadora"
                  placeholder="Protocolo ou referência"
                  className={campo}
                />
              </label>

              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                <p className="text-sm font-semibold text-emerald-800">
                  Status operacional automático
                </p>

                <p className="mt-1 text-xs leading-5 text-emerald-700">
                  O sistema identificará automaticamente a
                  etapa da coleta conforme os campos forem
                  preenchidos.
                </p>
              </div>
            </div>
          </div>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-6">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">
              Etapas 4 e 5
            </p>

            <h3 className="mt-1 text-lg font-bold">
              Coleta realizada e recebimento na ADS
            </h3>

            <p className="text-sm text-slate-500">
              Informações preenchidas durante o andamento da
              operação.
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            <label className={rotulo}>
              Data efetiva da coleta
              <input
                type="date"
                name="dataEfetivaColeta"
                className={campo}
              />
            </label>

            <label className={rotulo}>
              Conhecimento / CT-e
              <input
                type="text"
                name="conhecimento"
                placeholder="Número do documento"
                className={campo}
              />
            </label>

            <label className={rotulo}>
              Anexar CT-e
              <input
                type="file"
                name="arquivoCte"
                accept=".pdf,.xml,.jpg,.jpeg,.png,application/pdf,application/xml,text/xml,image/jpeg,image/png"
                className={campoArquivo}
              />
              <span className="mt-1 block text-xs font-normal text-slate-500">
                PDF, XML, JPG ou PNG · máximo 10 MB
              </span>
            </label>

            <label className={rotulo}>
              Data de chegada na ADS
              <input
                type="date"
                name="dataChegadaAds"
                className={campo}
              />
            </label>

            <label className={rotulo}>
              Peso coletado em kg
              <input
                type="number"
                name="peso"
                min="0"
                step="0.01"
                placeholder="Ex.: 125,50"
                className={campo}
              />
            </label>

            <label className={rotulo}>
              Destino
              <input
                type="text"
                name="destino"
                placeholder="Ex.: ADS Logística Ambiental"
                className={campo}
              />
            </label>

            <label className={rotulo}>
              Responsável pelo recebimento
              <input
                type="text"
                name="responsavelRecebimento"
                placeholder="Nome do responsável"
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
              rows={5}
              placeholder="Digite informações adicionais sobre a coleta..."
              className={campo}
            />
          </label>
        </article>
      </div>

      <div
        className={
          abaAtiva === "transportadora"
            ? "space-y-6"
            : "hidden"
        }
      >
        <article className="rounded-2xl border border-blue-200 bg-white p-6 shadow-sm">
          <div className="mb-6">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-700">
              Financeiro — Transportadora
            </p>

            <h3 className="mt-1 text-lg font-bold">
              Pagamento do frete e do CT-e
            </h3>

            <p className="text-sm text-slate-500">
              Controle da cobrança apresentada pela
              transportadora.
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            <label className={rotulo}>
              Valor do frete
              <input
                type="number"
                name="valorFrete"
                min="0"
                step="0.01"
                placeholder="Ex.: 850,00"
                className={campo}
              />
            </label>

            <label className={rotulo}>
              Data de recebimento da cobrança
              <input
                type="date"
                name="dataRecebimentoCobrancaTransportadora"
                className={campo}
              />
            </label>

            <label className={rotulo}>
              Data de vencimento
              <input
                type="date"
                name="vencimentoTransportadora"
                className={campo}
              />
            </label>

            <label className={rotulo}>
              Situação do pagamento
              <select
                name="statusPagamentoTransportadora"
                defaultValue="Não cobrado"
                className={campo}
              >
                <option value="Não cobrado">
                  Não cobrado
                </option>

                <option value="Aguardando pagamento">
                  Aguardando pagamento
                </option>

                <option value="Pago">
                  Pago
                </option>

                <option value="Vencido">
                  Vencido
                </option>

                <option value="Contestado">
                  Contestado
                </option>
              </select>
            </label>

            <label className={rotulo}>
              Data do pagamento
              <input
                type="date"
                name="dataPagamentoTransportadora"
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
              rows={5}
              placeholder="Informe boleto, contestação, comprovante ou outros detalhes..."
              className={campo}
            />
          </label>
        </article>
      </div>

      <div
        className={
          abaAtiva === "ads"
            ? "space-y-6"
            : "hidden"
        }
      >
        <article className="rounded-2xl border border-violet-200 bg-white p-6 shadow-sm">
          <div className="mb-6">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-violet-700">
              Financeiro — ADS
            </p>

            <h3 className="mt-1 text-lg font-bold">
              Nota Fiscal de cobrança ao cliente
            </h3>

            <p className="text-sm text-slate-500">
              Controle da cobrança emitida pela ADS após a
              coleta.
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            <label className={rotulo}>
              Número da NF de cobrança
              <input
                type="text"
                name="numeroNfCobrancaAds"
                placeholder="Número da NF emitida pela ADS"
                className={campo}
              />
            </label>

            <label className={rotulo}>
              Anexar NF de cobrança
              <input
                type="file"
                name="arquivoNfCobrancaAds"
                accept=".pdf,.xml,.jpg,.jpeg,.png,application/pdf,application/xml,text/xml,image/jpeg,image/png"
                className={campoArquivo}
              />
              <span className="mt-1 block text-xs font-normal text-slate-500">
                PDF, XML, JPG ou PNG · máximo 10 MB
              </span>
            </label>

            <label className={rotulo}>
              Data de emissão
              <input
                type="date"
                name="dataEmissaoNfCobrancaAds"
                className={campo}
              />
            </label>

            <label className={rotulo}>
              Valor da cobrança
              <input
                type="number"
                name="valorNfCobrancaAds"
                min="0"
                step="0.01"
                placeholder="Ex.: 1250,00"
                className={campo}
              />
            </label>

            <label className={rotulo}>
              Data de vencimento
              <input
                type="date"
                name="vencimentoNfCobrancaAds"
                className={campo}
              />
            </label>

            <label className={rotulo}>
              Situação do recebimento
              <select
                name="statusRecebimentoAds"
                defaultValue="Não emitida"
                className={campo}
              >
                <option value="Não emitida">
                  Não emitida
                </option>

                <option value="Emitida">
                  Emitida
                </option>

                <option value="Aguardando recebimento">
                  Aguardando recebimento
                </option>

                <option value="Paga">
                  Paga
                </option>

                <option value="Vencida">
                  Vencida
                </option>

                <option value="Cancelada">
                  Cancelada
                </option>
              </select>
            </label>

            <label className={rotulo}>
              Data do recebimento
              <input
                type="date"
                name="dataRecebimentoPagamentoAds"
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
              rows={5}
              placeholder="Informe boleto, comprovante, negociação ou outros detalhes..."
              className={campo}
            />
          </label>
        </article>
      </div>

      <div className="flex flex-col-reverse justify-end gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row">
        <Link
          href="/"
          className="rounded-xl border border-slate-300 bg-white px-6 py-3 text-center text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          Cancelar
        </Link>

        <button
          type="reset"
          onClick={() => {
            setMensagem("");
            setAbaAtiva("operacao");
            setUnidades([]);
            setBuscaUnidade("");
            setUnidadeSelecionada(null);
            setListaUnidadesAberta(false);
            setClienteSelecionadoId(null);
          }}
          disabled={salvando}
          className="rounded-xl border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Limpar formulário
        </button>

        <button
          type="submit"
          disabled={salvando}
          className="rounded-xl bg-emerald-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {salvando
            ? "Salvando..."
            : "Salvar coleta"}
        </button>
      </div>
    </form>
  );
}