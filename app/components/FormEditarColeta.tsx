"use client";

import Link from "next/link";
import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";
import PainelInteligenteColeta from "./PainelInteligenteColeta";
import TimelineColeta from "./TimelineColeta";
import HistoricoColeta from "./HistoricoColeta";

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

  transportadora: string | null;
  data_envio_transportadora: string | null;
  data_prevista_coleta: string | null;
  protocolo_transportadora: string | null;
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
  "mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100";

const rotulo = "text-sm font-semibold text-slate-700";

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
  const [mensagem, setMensagem] = useState("");
  const [atualizarHistorico, setAtualizarHistorico] = useState(0);
  const [tipoMensagem, setTipoMensagem] = useState<
    "sucesso" | "erro" | "carregando"
  >("sucesso");

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

  async function salvarAlteracoes(
    evento: FormEvent<HTMLFormElement>,
  ) {
    evento.preventDefault();

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

    const atualizacao = {
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

      transportadora: valorOuNulo("transportadora"),
      data_envio_transportadora: valorOuNulo("dataEnvioTransportadora"),
      data_prevista_coleta: valorOuNulo("dataPrevistaColeta"),
      protocolo_transportadora: valorOuNulo("protocoloTransportadora"),
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

    const { error } = await supabase
      .from("coletas")
      .update(atualizacao)
      .eq("id", id);

    if (error) {
      console.error("Erro ao salvar alterações:", error);
      setTipoMensagem("erro");
      setMensagem(`Não foi possível salvar: ${error.message}`);
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

    setColeta((anterior) =>
      anterior
        ? ({
            ...anterior,
            ...atualizacao,
            id,
          } as Coleta)
        : anterior,
    );

    setTipoMensagem("sucesso");
    setMensagem(
      `Alterações salvas com sucesso! Status atualizado para: ${statusAutomatico}.${avisoHistorico}`,
    );
    setSalvando(false);
    router.refresh();

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
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

  if (carregando) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500 shadow-sm">
        Carregando coleta...
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

      <HistoricoColeta
        coletaId={id}
        atualizarEm={atualizarHistorico}
      />

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
        <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
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
                disabled={carregandoCadastros}
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
                required
                defaultValue={coleta.cidade ?? ""}
                className={campo}
              />
            </label>

            <label className={rotulo}>
              Estado *
              <select
                name="estado"
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
              Data da OV *
              <input
                type="date"
                name="dataOv"
                required
                defaultValue={coleta.data_ov ?? ""}
                className={campo}
              />
            </label>

            <label className={rotulo}>
              Número da OV *
              <input
                type="text"
                name="numeroOv"
                required
                defaultValue={coleta.numero_ov ?? ""}
                className={campo}
              />
            </label>

            <label className={rotulo}>
              Data de emissão da NF
              <input
                type="date"
                name="dataNotaFiscal"
                defaultValue={coleta.data_nf ?? ""}
                className={campo}
              />
            </label>

            <label className={rotulo}>
              Número da Nota Fiscal
              <input
                type="text"
                name="numeroNotaFiscal"
                defaultValue={coleta.numero_nf ?? ""}
                className={campo}
              />
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
              Dados do envio da solicitação e da programação da coleta.
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            <label className={rotulo}>
              Transportadora
              <select
                name="transportadora"
                defaultValue={coleta.transportadora ?? ""}
                disabled={carregandoCadastros}
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
                defaultValue={coleta.data_envio_transportadora ?? ""}
                className={campo}
              />
            </label>

            <label className={rotulo}>
              Data prevista da coleta
              <input
                type="date"
                name="dataPrevistaColeta"
                defaultValue={coleta.data_prevista_coleta ?? ""}
                className={campo}
              />
            </label>

            <label className={rotulo}>
              Protocolo da solicitação
              <input
                type="text"
                name="protocoloTransportadora"
                defaultValue={coleta.protocolo_transportadora ?? ""}
                className={campo}
              />
            </label>

            <label className={rotulo}>
              Contato da transportadora
              <input
                type="text"
                name="contatoTransportadora"
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

        <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
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
                defaultValue={coleta.conhecimento ?? ""}
                className={campo}
              />
            </label>

            <label className={rotulo}>
              Data de chegada na ADS
              <input
                type="date"
                name="dataChegadaAds"
                defaultValue={coleta.data_chegada_ads ?? ""}
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
                defaultValue={coleta.peso ?? ""}
                className={campo}
              />
            </label>

            <label className={rotulo}>
              Destino
              <input
                type="text"
                name="destino"
                defaultValue={coleta.destino ?? ""}
                className={campo}
              />
            </label>

            <label className={rotulo}>
              Responsável pelo recebimento
              <input
                type="text"
                name="responsavelRecebimento"
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
        <article className="rounded-2xl border border-blue-200 bg-white p-6 shadow-sm">
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
                defaultValue={coleta.vencimento_transportadora ?? ""}
                className={campo}
              />
            </label>

            <label className={rotulo}>
              Situação do pagamento
              <select
                name="statusPagamentoTransportadora"
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
        <article className="rounded-2xl border border-violet-200 bg-white p-6 shadow-sm">
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
                defaultValue={coleta.numero_nf_cobranca_ads ?? ""}
                className={campo}
              />
            </label>

            <label className={rotulo}>
              Data de emissão
              <input
                type="date"
                name="dataEmissaoNfCobrancaAds"
                defaultValue={coleta.data_emissao_nf_cobranca_ads ?? ""}
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
                defaultValue={coleta.valor_nf_cobranca_ads ?? ""}
                className={campo}
              />
            </label>

            <label className={rotulo}>
              Data de vencimento
              <input
                type="date"
                name="vencimentoNfCobrancaAds"
                defaultValue={coleta.vencimento_nf_cobranca_ads ?? ""}
                className={campo}
              />
            </label>

            <label className={rotulo}>
              Situação do recebimento
              <select
                name="statusRecebimentoAds"
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
              rows={5}
              defaultValue={coleta.observacoes_cobranca_ads ?? ""}
              className={campo}
            />
          </label>
        </article>
      </div>

      <div className="flex flex-col-reverse justify-end gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row">
        <Link
          href="/coletas"
          className="rounded-xl border border-slate-300 bg-white px-6 py-3 text-center text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          Voltar
        </Link>

        <button
          type="submit"
          disabled={salvando}
          className="rounded-xl bg-emerald-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {salvando ? "Salvando..." : "Salvar alterações"}
        </button>
      </div>
    </form>
  );
}