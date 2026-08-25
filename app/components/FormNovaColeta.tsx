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

type MunicipioTodoBrasil = {
  regiao: string;
  uf: string;
  municipio: string;
  classificacao: string;
  ativo: boolean;
};

type TarifaTodoBrasil = {
  regiao: string;
  uf: string;
  localidade: string;
  frete_ate_30: number;
  frete_30_50: number;
  frete_50_70: number;
  frete_70_100: number;
  valor_kg_excedente: number;
  ad_valorem_percentual: number;
  gris_percentual: number;
  pedagio_fracao_100kg: number;
  taxa_despacho: number;
  prazo_minimo_dias: number;
  prazo_maximo_dias: number;
  vigencia_inicio: string | null;
  vigencia_fim: string | null;
  ativo: boolean;
};

type DetalhesFrete = {
  classificacao: string;
  fretePeso: number;
  pedagio: number;
  taxaDespacho: number;
  adValoremPercentual: number;
  adValorem: number;
  grisPercentual: number;
  gris: number;
  subtotal: number;
  icmsPercentual: number;
  valorIcms: number;
  total: number;
  prazoMinimo: number;
  prazoMaximo: number;
};

const campo =
  "mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400";

const rotulo =
  "text-[13px] font-semibold text-slate-700";

const campoArquivo =
  "mt-1.5 block w-full cursor-pointer rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-xs text-slate-700 transition hover:border-emerald-300 hover:bg-emerald-50/40 file:mr-3 file:rounded-lg file:border-0 file:bg-emerald-100 file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-emerald-700 hover:file:bg-emerald-200";

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

  const dataNotaFiscal = obterValor("dataNotaFiscal");
  const numeroNotaFiscal = obterValor("numeroNotaFiscal");
  const transportadora = obterValor("transportadora");
  const dataPrevistaColeta = obterValor("dataPrevistaColeta");
  const dataEfetivaColeta = obterValor("dataEfetivaColeta");
  const dataChegadaAds = obterValor("dataChegadaAds");

  const statusRecebimentoAds = normalizarTexto(
    obterValor("statusRecebimentoAds"),
  );

  /*
   * REGRA ESPECIAL — COLETAS REALIZADAS PELA PRÓPRIA ADS
   *
   * Quando a transportadora for ADS Logística Ambiental e já existir
   * uma data prevista de coleta, a operação pode avançar para
   * "Aguardando coleta" mesmo sem NF do cliente.
   */
  const coletaRealizadaPelaAds =
    normalizarTexto(transportadora) ===
    normalizarTexto("ADS Logística Ambiental");

  if (statusRecebimentoAds === "paga") {
    return "Finalizado";
  }

  if (dataChegadaAds) {
    return "Recebido na ADS";
  }

  if (dataEfetivaColeta) {
    return "Coleta realizada";
  }

  if (coletaRealizadaPelaAds && dataPrevistaColeta) {
    return "Aguardando coleta";
  }

  if (dataNotaFiscal && numeroNotaFiscal) {
    return "Aguardando coleta";
  }

  return "Aguardando NF";
}

export default function FormNovaColeta() {
  const formularioRef =
    useRef<HTMLFormElement>(null);

  const autocompleteUnidadeRef =
    useRef<HTMLDivElement>(null);

  const autocompleteTransportadoraRef =
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
    buscaTransportadora,
    setBuscaTransportadora,
  ] = useState("");

  const [
    transportadoraSelecionada,
    setTransportadoraSelecionada,
  ] = useState<TransportadoraMestre | null>(null);

  const [
    listaTransportadorasAberta,
    setListaTransportadorasAberta,
  ] = useState(false);

  const [
    filialTodoBrasilSugerida,
    setFilialTodoBrasilSugerida,
  ] = useState<TransportadoraMestre | null>(null);

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

  const [pesoInformado, setPesoInformado] =
    useState("");

  const [valorNotaFiscal, setValorNotaFiscal] =
    useState("");

  const [valorFreteAutomatico, setValorFreteAutomatico] =
    useState("");

  const [calculandoFrete, setCalculandoFrete] =
    useState(false);

  const [erroCalculoFrete, setErroCalculoFrete] =
    useState("");

  const [detalhesFrete, setDetalhesFrete] =
    useState<DetalhesFrete | null>(null);

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

      if (
        autocompleteTransportadoraRef.current &&
        !autocompleteTransportadoraRef.current.contains(
          alvo,
        )
      ) {
        setListaTransportadorasAberta(false);
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

  function aplicarTransportadoraPorNome(
    nomeTransportadora: string | null | undefined,
  ) {
    const nome = nomeTransportadora?.trim() ?? "";

    const transportadoraEncontrada =
      nome
        ? transportadoras.find(
            (transportadora) =>
              normalizarTexto(transportadora.nome) ===
              normalizarTexto(nome),
          ) ?? null
        : null;

    preencherCampo(
      "transportadora",
      transportadoraEncontrada?.nome ?? nome,
    );

    setTransportadoraSelecionada(
      transportadoraEncontrada,
    );

    setBuscaTransportadora(
      transportadoraEncontrada?.nome ?? nome,
    );

    setListaTransportadorasAberta(false);

    if (!nome) {
      preencherCampo("contatoTransportadora", "");
      preencherCampo("telefoneTransportadora", "");
      preencherCampo("emailTransportadora", "");
      return;
    }

    preencherCampo(
      "contatoTransportadora",
      transportadoraEncontrada?.contato ?? "",
    );

    preencherCampo(
      "telefoneTransportadora",
      transportadoraEncontrada?.telefone ?? "",
    );

    preencherCampo(
      "emailTransportadora",
      transportadoraEncontrada?.email ?? "",
    );
  }

  function identificarFilialTodoBrasilPorEstado(
    estado: string | null | undefined,
  ) {
    const uf = estado?.trim().toUpperCase() ?? "";

    if (!uf) {
      setFilialTodoBrasilSugerida(null);
      return null;
    }

    const nomeFilial = `Todo Brasil - Filial ${uf}`;

    const filialEncontrada =
      transportadoras.find(
        (transportadora) =>
          normalizarTexto(transportadora.nome) ===
          normalizarTexto(nomeFilial),
      ) ?? null;

    setFilialTodoBrasilSugerida(filialEncontrada);

    return filialEncontrada;
  }

  function preencherFilialTodoBrasilSeNfCompleta() {
    const formulario = formularioRef.current;

    if (!formulario || !filialTodoBrasilSugerida) {
      return;
    }

    const dataNf = (
      formulario.elements.namedItem(
        "dataNotaFiscal",
      ) as HTMLInputElement | null
    )?.value.trim();

    const numeroNf = (
      formulario.elements.namedItem(
        "numeroNotaFiscal",
      ) as HTMLInputElement | null
    )?.value.trim();

    if (dataNf && numeroNf) {
      aplicarTransportadoraPorNome(
        filialTodoBrasilSugerida.nome,
      );
    } else {
      const transportadoraAtual = (
        formulario.elements.namedItem(
          "transportadora",
        ) as HTMLSelectElement | null
      )?.value.trim();

      if (
        transportadoraAtual &&
        normalizarTexto(transportadoraAtual).startsWith(
          "todo brasil - filial",
        )
      ) {
        aplicarTransportadoraPorNome("");
      }
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

    const nomeClienteSelecionado =
      normalizarTexto(
        nomeCliente(clienteSelecionado),
      );

    const transportadoraPadrao =
      clienteSelecionado.transportadora_padrao?.trim() ??
      "";

    const transportadoraPadraoNormalizada =
      normalizarTexto(transportadoraPadrao);

    const ehTodoBrasil =
      transportadoraPadraoNormalizada ===
        "todo brasil" ||
      transportadoraPadraoNormalizada.startsWith(
        "todo brasil - filial",
      );

    const ehAssai =
      nomeClienteSelecionado.includes("assai");

    setFilialTodoBrasilSugerida(null);

    if (ehTodoBrasil || ehAssai) {
      // Para a Todo Brasil, a filial só será sugerida após
      // a escolha da unidade e só será preenchida quando
      // Data da NF + Número da NF estiverem informados.
      aplicarTransportadoraPorNome("");
    } else if (transportadoraPadrao) {
      aplicarTransportadoraPorNome(
        transportadoraPadrao,
      );
    } else {
      aplicarTransportadoraPorNome("");
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

    const clienteSelecionado =
      clientes.find(
        (cliente) =>
          cliente.id === clienteSelecionadoId,
      );

    const transportadoraPadrao =
      clienteSelecionado?.transportadora_padrao?.trim() ??
      "";

    const transportadoraPadraoNormalizada =
      normalizarTexto(transportadoraPadrao);

    const ehTodoBrasil =
      transportadoraPadraoNormalizada ===
        "todo brasil" ||
      transportadoraPadraoNormalizada.startsWith(
        "todo brasil - filial",
      );

    const ehAssai =
      normalizarTexto(
        clienteSelecionado
          ? nomeCliente(clienteSelecionado)
          : "",
      ).includes("assai");

    if (ehTodoBrasil || ehAssai) {
      const filial =
        identificarFilialTodoBrasilPorEstado(
          unidade.estado,
        );

      if (!filial) {
        aplicarTransportadoraPorNome("");
        setTipoMensagem("erro");
        setMensagem(
          `Não encontrei a transportadora "Todo Brasil - Filial ${unidade.estado ?? ""}" cadastrada. Verifique o cadastro da filial.`,
        );
      } else {
        // Mantém a transportadora vazia enquanto a NF estiver pendente.
        aplicarTransportadoraPorNome("");
        setMensagem("");
      }
    } else if (transportadoraPadrao) {
      setFilialTodoBrasilSugerida(null);
      aplicarTransportadoraPorNome(
        transportadoraPadrao,
      );
    } else {
      setFilialTodoBrasilSugerida(null);
      aplicarTransportadoraPorNome("");
    }
  }

  function selecionarTransportadora(
    transportadora: TransportadoraMestre,
  ) {
    setTransportadoraSelecionada(
      transportadora,
    );

    setBuscaTransportadora(
      transportadora.nome,
    );

    setListaTransportadorasAberta(false);

    preencherCampo(
      "transportadora",
      transportadora.nome,
    );

    preencherCampo(
      "contatoTransportadora",
      transportadora.contato ?? "",
    );

    preencherCampo(
      "telefoneTransportadora",
      transportadora.telefone ?? "",
    );

    preencherCampo(
      "emailTransportadora",
      transportadora.email ?? "",
    );
  }

  function transportadoraUsaTabelaTodoBrasil(nome: string) {
    const nomeNormalizado = normalizarTexto(nome);

    return (
      nomeNormalizado.includes("todo brasil") ||
      nomeNormalizado.includes("todobrasil")
    );
  }

  function arredondarMoeda(valor: number) {
    return Math.round((valor + Number.EPSILON) * 100) / 100;
  }

  async function calcularFreteTodoBrasil() {
    const cidade = unidadeSelecionada?.cidade?.trim() ?? "";
    const uf = unidadeSelecionada?.estado?.trim().toUpperCase() ?? "";
    const nomeTransportadora =
      transportadoraSelecionada?.nome ?? buscaTransportadora;
    const peso = Number(pesoInformado.replace(",", "."));
    const valorNf = Number(valorNotaFiscal.replace(",", "."));

    if (!transportadoraUsaTabelaTodoBrasil(nomeTransportadora)) {
      setErroCalculoFrete("");
      setDetalhesFrete(null);
      setValorFreteAutomatico("");
      return;
    }

    if (
      !cidade ||
      !uf ||
      !pesoInformado ||
      !Number.isFinite(peso) ||
      peso <= 0 ||
      !valorNotaFiscal ||
      !Number.isFinite(valorNf) ||
      valorNf < 0
    ) {
      setErroCalculoFrete("");
      setDetalhesFrete(null);
      setValorFreteAutomatico("");
      return;
    }

    setCalculandoFrete(true);
    setErroCalculoFrete("");

    try {
      const { data: municipios, error: erroMunicipio } =
        await supabase
          .from("municipios_todo_brasil")
          .select("regiao, uf, municipio, classificacao, ativo")
          .eq("uf", uf)
          .eq("ativo", true);

      if (erroMunicipio) {
        throw new Error(
          `Erro ao consultar município: ${erroMunicipio.message}`,
        );
      }

      const cidadeNormalizada = normalizarTexto(cidade)
        .replace(/\s+/g, " ")
        .trim();

      const municipio = ((municipios ?? []) as MunicipioTodoBrasil[]).find(
        (item) => {
          const municipioNormalizado = normalizarTexto(item.municipio)
            .replace(/\s+/g, " ")
            .trim();

          const ufMunicipio = (item.uf ?? "").trim().toUpperCase();

          return (
            ufMunicipio === uf &&
            municipioNormalizado === cidadeNormalizada
          );
        },
      );

      if (!municipio) {
        throw new Error(
          `O município ${cidade}/${uf} não foi encontrado na tabela de localidades da Todo Brasil.`,
        );
      }

      const { data: tarifas, error: erroTarifa } =
        await supabase
          .from("tabela_frete_todo_brasil")
          .select(
            `
              regiao,
              uf,
              localidade,
              frete_ate_30,
              frete_30_50,
              frete_50_70,
              frete_70_100,
              valor_kg_excedente,
              ad_valorem_percentual,
              gris_percentual,
              pedagio_fracao_100kg,
              taxa_despacho,
              prazo_minimo_dias,
              prazo_maximo_dias,
              vigencia_inicio,
              vigencia_fim,
              ativo
            `,
          )
          .eq("uf", uf)
          .eq("localidade", municipio.classificacao)
          .eq("ativo", true)
          .order("vigencia_inicio", { ascending: false })
          .limit(1);

      if (erroTarifa) {
        throw new Error(
          `Erro ao consultar tarifa: ${erroTarifa.message}`,
        );
      }

      const tarifa = ((tarifas ?? []) as TarifaTodoBrasil[])[0];

      if (!tarifa) {
        throw new Error(
          `Não encontrei tarifa ativa para ${uf} / ${municipio.classificacao}.`,
        );
      }

      let fretePeso = 0;

      if (peso <= 30) {
        fretePeso = Number(tarifa.frete_ate_30);
      } else if (peso <= 50) {
        fretePeso = Number(tarifa.frete_30_50);
      } else if (peso <= 70) {
        fretePeso = Number(tarifa.frete_50_70);
      } else if (peso <= 100) {
        fretePeso = Number(tarifa.frete_70_100);
      } else {
        fretePeso =
          Number(tarifa.frete_70_100) +
          (peso - 100) * Number(tarifa.valor_kg_excedente);
      }

      const pedagio =
        Math.ceil(peso / 100) *
        Number(tarifa.pedagio_fracao_100kg ?? 0);

      const taxaDespacho = Number(tarifa.taxa_despacho ?? 0);

      const adValoremPercentual = Number(
        tarifa.ad_valorem_percentual ?? 0,
      );
      const grisPercentual = Number(
        tarifa.gris_percentual ?? 0,
      );

      const adValoremCalculado =
        valorNf * (adValoremPercentual / 100);
      const grisCalculado =
        valorNf * (grisPercentual / 100);

      // Mínimos informados pela transportadora:
      // Ad Valorem: R$ 5,66
      // GRIS: R$ 2,50
      //
      // Importante:
      // mantemos as casas decimais internas durante o cálculo
      // e arredondamos apenas para exibição / valor final.
      const adValorem = Math.max(
        adValoremCalculado,
        5.66,
      );
      const gris = Math.max(
        grisCalculado,
        2.5,
      );

      const subtotal =
        fretePeso +
        pedagio +
        taxaDespacho +
        adValorem +
        gris;

      // ICMS de 12% calculado "por dentro":
      // total = subtotal / (1 - 0,12) = subtotal / 0,88
      const icmsPercentual = 12;
      const divisorIcms = 1 - icmsPercentual / 100;
      const totalSemArredondar = subtotal / divisorIcms;
      const valorIcms = totalSemArredondar - subtotal;
      const total = arredondarMoeda(totalSemArredondar);

      setValorFreteAutomatico(total.toFixed(2));
      setDetalhesFrete({
        classificacao: municipio.classificacao,
        fretePeso: arredondarMoeda(fretePeso),
        pedagio: arredondarMoeda(pedagio),
        taxaDespacho: arredondarMoeda(taxaDespacho),
        adValoremPercentual,
        adValorem: arredondarMoeda(adValorem),
        grisPercentual,
        gris: arredondarMoeda(gris),
        subtotal: arredondarMoeda(subtotal),
        icmsPercentual,
        valorIcms: arredondarMoeda(valorIcms),
        total,
        prazoMinimo: Number(tarifa.prazo_minimo_dias ?? 0),
        prazoMaximo: Number(tarifa.prazo_maximo_dias ?? 0),
      });
    } catch (erro) {
      console.error("Erro ao calcular frete automaticamente:", erro);

      setValorFreteAutomatico("");
      setDetalhesFrete(null);
      setErroCalculoFrete(
        erro instanceof Error
          ? erro.message
          : "Não foi possível calcular o frete automaticamente.",
      );
    } finally {
      setCalculandoFrete(false);
    }
  }

  useEffect(() => {
    const temporizador = window.setTimeout(() => {
      calcularFreteTodoBrasil();
    }, 350);

    return () => window.clearTimeout(temporizador);
  }, [
    unidadeSelecionada,
    transportadoraSelecionada,
    buscaTransportadora,
    pesoInformado,
    valorNotaFiscal,
  ]);

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

  const termoTransportadora =
    normalizarTexto(buscaTransportadora);

  const transportadorasFiltradas =
    transportadoras
      .filter((transportadora) => {
        if (!termoTransportadora) {
          return true;
        }

        const conteudo = normalizarTexto(
          [
            transportadora.nome,
            transportadora.contato,
            transportadora.telefone,
            transportadora.email,
          ]
            .filter(Boolean)
            .join(" "),
        );

        return conteudo.includes(
          termoTransportadora,
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

      valor_nf_cliente:
        numeroOuNulo(
          "valorNotaFiscal",
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
    setFilialTodoBrasilSugerida(null);
    setBuscaTransportadora("");
    setTransportadoraSelecionada(null);
    setListaTransportadorasAberta(false);
    setPesoInformado("");
    setValorNotaFiscal("");
    setValorFreteAutomatico("");
    setDetalhesFrete(null);
    setErroCalculoFrete("");

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
      "relative flex items-center justify-center gap-3 rounded-xl border px-4 py-3 text-sm font-semibold transition-all duration-200",

      abaAtiva === aba
        ? "border-emerald-600 bg-emerald-600 text-white shadow-md shadow-emerald-900/10"
        : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900",
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
      className="space-y-4"
    >
      {mensagem && (
        <div
          role="status"
          className={`rounded-2xl border px-5 py-4 text-sm font-semibold shadow-sm ${classeMensagem()}`}
        >
          {mensagem}
        </div>
      )}

      {erroCadastros && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm font-semibold text-amber-800 shadow-sm">
          {erroCadastros}
        </div>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-700">
              Fluxo da coleta
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-800">
              Solicitação → OV / NF → Transportadora → Coleta → Recebimento
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {[
              "1 Solicitação",
              "2 OV / NF",
              "3 Transportadora",
              "4 Coleta",
              "5 Recebimento",
            ].map((etapa) => (
              <span
                key={etapa}
                className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-[11px] font-bold text-slate-600"
              >
                {etapa}
              </span>
            ))}
          </div>
        </div>
      </section>

      <nav className="rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
        <div className="grid gap-2 md:grid-cols-3">
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
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/15 text-[11px] font-black">
              01
            </span>
            <span>Operação</span>
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
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-[11px] font-black text-slate-600">
              02
            </span>
            <span>Financeiro — Transportadora</span>
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
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-[11px] font-black text-slate-600">
              03
            </span>
            <span>Financeiro — ADS</span>
          </button>
        </div>
      </nav>

      <div
        className={
          abaAtiva ===
          "operacao"
            ? "space-y-4"
            : "hidden"
        }
      >
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">
              Etapa 1
            </p>

            <h3 className="mt-1.5 text-lg font-bold tracking-tight text-slate-900">
              Solicitação do cliente
            </h3>

            <p className="text-sm text-slate-500">
              Informações do cliente e da unidade
              solicitante.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
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
                  <div className="absolute z-50 mt-2 max-h-80 w-full overflow-y-auto rounded-2xl border border-slate-200 bg-white p-1 shadow-2xl shadow-slate-900/10">
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
                            className="block w-full rounded-xl px-4 py-3 text-left text-sm text-slate-700 transition hover:bg-emerald-50 hover:text-emerald-800"
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
                onChange={(evento) => {
                  const clienteSelecionado =
                    clientes.find(
                      (cliente) =>
                        cliente.id ===
                        clienteSelecionadoId,
                    );

                  const transportadoraPadrao =
                    clienteSelecionado
                      ?.transportadora_padrao
                      ?.trim() ?? "";

                  const transportadoraPadraoNormalizada =
                    normalizarTexto(
                      transportadoraPadrao,
                    );

                  const ehTodoBrasil =
                    transportadoraPadraoNormalizada ===
                      "todo brasil" ||
                    transportadoraPadraoNormalizada.startsWith(
                      "todo brasil - filial",
                    );

                  const ehAssai =
                    normalizarTexto(
                      clienteSelecionado
                        ? nomeCliente(
                            clienteSelecionado,
                          )
                        : "",
                    ).includes("assai");

                  if (ehTodoBrasil || ehAssai) {
                    const filial =
                      identificarFilialTodoBrasilPorEstado(
                        evento.target.value,
                      );

                    if (filial) {
                      aplicarTransportadoraPorNome("");
                      setMensagem("");
                    }
                  }
                }}
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

        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">
              Etapa 2
            </p>

            <h3 className="mt-1.5 text-lg font-bold tracking-tight text-slate-900">
              Ordem de Visita e Nota Fiscal
            </h3>

            <p className="text-sm text-slate-500">
              Documentos utilizados para abertura da
              operação.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <label className={rotulo}>
              Data da OV
              <input
                type="date"
                name="dataOv"
                className={campo}
              />
            </label>

            <label className={rotulo}>
              Número da OV
              <input
                type="text"
                name="numeroOv"
                placeholder="Ex.: OV-1026"
                className={campo}
              />
            </label>

            <label className={rotulo}>
              Data de emissão da NF
              <input
                type="date"
                name="dataNotaFiscal"
                onChange={() => {
                  setTimeout(
                    preencherFilialTodoBrasilSeNfCompleta,
                    0,
                  );
                }}
                className={campo}
              />
            </label>

            <label className={rotulo}>
              Número da Nota Fiscal
              <input
                type="text"
                name="numeroNotaFiscal"
                onChange={() => {
                  setTimeout(
                    preencherFilialTodoBrasilSeNfCompleta,
                    0,
                  );
                }}
                placeholder="Ex.: 45880"
                className={campo}
              />
            </label>

            <label className={rotulo}>
              Valor da Nota Fiscal (R$)
              <input
                type="number"
                name="valorNotaFiscal"
                min="0"
                step="0.01"
                value={valorNotaFiscal}
                onChange={(evento) =>
                  setValorNotaFiscal(evento.target.value)
                }
                placeholder="Ex.: 12500,00"
                className={campo}
              />
              <span className="mt-1 block text-xs font-normal text-slate-500">
                Base para cálculo automático de Ad Valorem e GRIS.
              </span>
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

        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">
              Etapa 3
            </p>

            <h3 className="mt-1.5 text-lg font-bold tracking-tight text-slate-900">
              Solicitação à transportadora
            </h3>

            <p className="text-sm text-slate-500">
              Dados do envio da solicitação e da programação
              da coleta.
            </p>
          </div>

          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div
                ref={autocompleteTransportadoraRef}
                className="relative xl:col-span-2"
              >
                <label className={rotulo}>
                  Transportadora
                </label>

                <input
                  type="hidden"
                  name="transportadora"
                  value={
                    transportadoraSelecionada?.nome ??
                    buscaTransportadora
                  }
                />

                <input
                  type="text"
                  value={buscaTransportadora}
                  disabled={carregandoCadastros}
                  onFocus={() => {
                    if (!carregandoCadastros) {
                      setListaTransportadorasAberta(
                        true,
                      );
                    }
                  }}
                  onChange={(evento) => {
                    setBuscaTransportadora(
                      evento.target.value,
                    );

                    setTransportadoraSelecionada(
                      null,
                    );

                    preencherCampo(
                      "transportadora",
                      evento.target.value,
                    );

                    preencherCampo(
                      "contatoTransportadora",
                      "",
                    );

                    preencherCampo(
                      "telefoneTransportadora",
                      "",
                    );

                    preencherCampo(
                      "emailTransportadora",
                      "",
                    );

                    setListaTransportadorasAberta(
                      true,
                    );
                  }}
                  placeholder={
                    carregandoCadastros
                      ? "Carregando transportadoras..."
                      : "Digite para buscar a transportadora"
                  }
                  autoComplete="off"
                  className={campo}
                />

                {listaTransportadorasAberta &&
                  !carregandoCadastros && (
                    <div className="absolute z-50 mt-2 max-h-80 w-full overflow-y-auto rounded-2xl border border-slate-200 bg-white p-1 shadow-2xl shadow-slate-900/10">
                      {transportadorasFiltradas.length >
                      0 ? (
                        transportadorasFiltradas.map(
                          (transportadora) => (
                            <button
                              key={transportadora.id}
                              type="button"
                              onClick={() =>
                                selecionarTransportadora(
                                  transportadora,
                                )
                              }
                              className="block w-full rounded-xl px-4 py-3 text-left transition hover:bg-emerald-50"
                            >
                              <span className="block text-sm font-semibold text-slate-800">
                                {transportadora.nome}
                              </span>

                              {(transportadora.contato ||
                                transportadora.email) && (
                                <span className="mt-1 block text-xs text-slate-500">
                                  {[
                                    transportadora.contato,
                                    transportadora.email,
                                  ]
                                    .filter(Boolean)
                                    .join(" • ")}
                                </span>
                              )}
                            </button>
                          ),
                        )
                      ) : (
                        <div className="px-4 py-4 text-sm text-slate-500">
                          Nenhuma transportadora
                          encontrada para esta pesquisa.
                        </div>
                      )}

                      {transportadoras.length > 12 &&
                        !termoTransportadora && (
                          <div className="border-t border-slate-100 bg-slate-50 px-4 py-2 text-xs text-slate-500">
                            Digite o nome, contato ou
                            e-mail para filtrar as{" "}
                            {transportadoras.length}{" "}
                            transportadoras.
                          </div>
                        )}
                    </div>
                  )}

                {filialTodoBrasilSugerida && (
                  <span className="mt-2 block text-xs font-medium text-blue-600">
                    Filial sugerida pela UF:{" "}
                    {filialTodoBrasilSugerida.nome}. Ela será
                    preenchida automaticamente após informar
                    Data da NF e Número da NF.
                  </span>
                )}
              </div>

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

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
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

            <div>
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 px-4 py-3">
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

        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">
              Etapas 4 e 5
            </p>

            <h3 className="mt-1.5 text-lg font-bold tracking-tight text-slate-900">
              Coleta realizada e recebimento na ADS
            </h3>

            <p className="text-sm text-slate-500">
              Informações preenchidas durante o andamento da
              operação.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
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
                value={pesoInformado}
                onChange={(evento) =>
                  setPesoInformado(evento.target.value)
                }
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

        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <label className={rotulo}>
            Observações operacionais
            <textarea
              name="observacoes"
              rows={3}
              placeholder="Digite informações adicionais sobre a coleta..."
              className={campo}
            />
          </label>
        </article>
      </div>

      <div
        className={
          abaAtiva === "transportadora"
            ? "space-y-4"
            : "hidden"
        }
      >
        <article className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm">
          <div className="mb-4">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-700">
              Financeiro — Transportadora
            </p>

            <h3 className="mt-1.5 text-lg font-bold tracking-tight text-slate-900">
              Pagamento do frete e do CT-e
            </h3>

            <p className="text-sm text-slate-500">
              Controle da cobrança apresentada pela
              transportadora.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <label className={rotulo}>
              Valor do frete
              <input
                type="number"
                name="valorFrete"
                min="0"
                step="0.01"
                value={valorFreteAutomatico}
                onChange={(evento) =>
                  setValorFreteAutomatico(evento.target.value)
                }
                placeholder={
                  calculandoFrete
                    ? "Calculando..."
                    : "Ex.: 850,00"
                }
                className={campo}
              />

              {calculandoFrete && (
                <span className="mt-2 block text-xs font-medium text-blue-600">
                  Consultando tabela da Todo Brasil...
                </span>
              )}

              {!calculandoFrete && detalhesFrete && (
                <span className="mt-2 block text-xs leading-5 text-emerald-700">
                  Cálculo automático · {detalhesFrete.classificacao} ·
                  Frete peso R$ {detalhesFrete.fretePeso.toFixed(2)} +
                  Ad Valorem {detalhesFrete.adValoremPercentual.toFixed(3)}%
                  {" "}R$ {detalhesFrete.adValorem.toFixed(2)} +
                  GRIS {detalhesFrete.grisPercentual.toFixed(3)}%
                  {" "}R$ {detalhesFrete.gris.toFixed(2)} +
                  pedágio R$ {detalhesFrete.pedagio.toFixed(2)} +
                  despacho R$ {detalhesFrete.taxaDespacho.toFixed(2)}.
                  Subtotal R$ {detalhesFrete.subtotal.toFixed(2)} ·
                  ICMS {detalhesFrete.icmsPercentual.toFixed(0)}% por dentro:
                  R$ {detalhesFrete.valorIcms.toFixed(2)} ·
                  Frete final R$ {detalhesFrete.total.toFixed(2)} ·
                  Prazo: {detalhesFrete.prazoMinimo} a {detalhesFrete.prazoMaximo} dias.
                </span>
              )}

              {!calculandoFrete && erroCalculoFrete && (
                <span className="mt-2 block text-xs leading-5 text-amber-700">
                  {erroCalculoFrete}
                </span>
              )}
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

        <article className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm">
          <label className={rotulo}>
            Observações do pagamento da transportadora
            <textarea
              name="observacoesPagamentoTransportadora"
              rows={3}
              placeholder="Informe boleto, contestação, comprovante ou outros detalhes..."
              className={campo}
            />
          </label>
        </article>
      </div>

      <div
        className={
          abaAtiva === "ads"
            ? "space-y-4"
            : "hidden"
        }
      >
        <article className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm">
          <div className="mb-4">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-700">
              Financeiro — ADS
            </p>

            <h3 className="mt-1.5 text-lg font-bold tracking-tight text-slate-900">
              Nota Fiscal de cobrança ao cliente
            </h3>

            <p className="text-sm text-slate-500">
              Controle da cobrança emitida pela ADS após a
              coleta.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
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

        <article className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm">
          <label className={rotulo}>
            Observações da cobrança ADS
            <textarea
              name="observacoesCobrancaAds"
              rows={3}
              placeholder="Informe boleto, comprovante, negociação ou outros detalhes..."
              className={campo}
            />
          </label>
        </article>
      </div>

      <div className="sticky bottom-4 z-30 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white/95 px-4 py-3 shadow-xl shadow-slate-900/10 backdrop-blur sm:flex-row sm:items-center sm:justify-between">
        <div className="hidden sm:block">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">
            Cadastro operacional
          </p>
          <p className="mt-0.5 text-xs font-semibold text-slate-600">
            O status da coleta será calculado automaticamente ao salvar.
          </p>
        </div>

        <div className="flex flex-col-reverse justify-end gap-2 sm:flex-row">
        <Link
          href="/"
          className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-center text-sm font-semibold text-slate-700 transition hover:bg-slate-50 hover:text-slate-900"
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
            setFilialTodoBrasilSugerida(null);
            setBuscaTransportadora("");
            setTransportadoraSelecionada(null);
            setListaTransportadorasAberta(false);
          }}
          disabled={salvando}
          className="rounded-xl border border-slate-200 bg-slate-50 px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Limpar formulário
        </button>

        <button
          type="submit"
          disabled={salvando}
          className="rounded-xl bg-emerald-600 px-6 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-700 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
        >
          {salvando
            ? "Salvando..."
            : "Salvar coleta"}
        </button>
        </div>
      </div>
    </form>
  );
}