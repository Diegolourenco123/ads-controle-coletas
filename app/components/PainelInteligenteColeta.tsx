type PainelInteligenteColetaProps = {
  numeroOv: string | null;
  cliente: string | null;
  loja: string | null;
  cidade: string | null;
  estado: string | null;

  status: string | null;
  dataSolicitacao: string | null;

  dataNf: string | null;
  numeroNf: string | null;

  transportadora: string | null;
  dataEnvioTransportadora: string | null;
  dataPrevistaColeta: string | null;

  dataEfetivaColeta: string | null;
  conhecimento: string | null;

  dataChegadaAds: string | null;
  destino: string | null;

  statusPagamentoTransportadora: string | null;
  vencimentoTransportadora: string | null;
  dataPagamentoTransportadora: string | null;

  statusRecebimentoAds: string | null;
  vencimentoNfCobrancaAds: string | null;
  dataRecebimentoPagamentoAds: string | null;
};

type SituacaoPainel = {
  status: string;
  progresso: number;
  proximaAcao: string;
  moduloDestino: "operacao" | "transportadora" | "ads";
};

function normalizarTexto(texto: string | null | undefined) {
  return (texto ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

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
  if (!data) {
    return "Não informada";
  }

  const [ano, mes, dia] = data.split("-");

  if (!ano || !mes || !dia) {
    return data;
  }

  return `${dia}/${mes}/${ano}`;
}

function calcularDiferencaEmDias(
  dataInicial: string | null,
  dataFinal?: string | null,
) {
  const inicio = criarDataLocal(dataInicial);

  if (!inicio) {
    return 0;
  }

  const fim = criarDataLocal(dataFinal ?? null) ?? new Date();
  fim.setHours(0, 0, 0, 0);

  const diferenca = fim.getTime() - inicio.getTime();

  return Math.max(
    0,
    Math.floor(diferenca / (1000 * 60 * 60 * 24)),
  );
}

function dataVencida(data: string | null) {
  const vencimento = criarDataLocal(data);

  if (!vencimento) {
    return false;
  }

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  return vencimento < hoje;
}

function dataEhHoje(data: string | null) {
  const dataInformada = criarDataLocal(data);

  if (!dataInformada) {
    return false;
  }

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  return dataInformada.getTime() === hoje.getTime();
}

function calcularSituacao({
  dataNf,
  numeroNf,
  transportadora,
  dataEnvioTransportadora,
  dataEfetivaColeta,
  dataChegadaAds,
  statusPagamentoTransportadora,
  dataPagamentoTransportadora,
  statusRecebimentoAds,
  dataRecebimentoPagamentoAds,
}: {
  dataNf: string | null;
  numeroNf: string | null;
  transportadora: string | null;
  dataEnvioTransportadora: string | null;
  dataEfetivaColeta: string | null;
  dataChegadaAds: string | null;
  statusPagamentoTransportadora: string | null;
  dataPagamentoTransportadora: string | null;
  statusRecebimentoAds: string | null;
  dataRecebimentoPagamentoAds: string | null;
}): SituacaoPainel {
  const pagamentoTransportadora = normalizarTexto(
    statusPagamentoTransportadora,
  );

  const recebimentoAds = normalizarTexto(
    statusRecebimentoAds,
  );

  const transportadoraPaga =
    pagamentoTransportadora === "pago" ||
    Boolean(dataPagamentoTransportadora);

  const cobrancaAdsPaga =
    recebimentoAds === "paga" ||
    Boolean(dataRecebimentoPagamentoAds);

  if (transportadoraPaga && cobrancaAdsPaga) {
    return {
      status: "Finalizado",
      progresso: 100,
      proximaAcao: "Processo concluído. Nenhuma ação pendente.",
      moduloDestino: "ads",
    };
  }

  if (dataChegadaAds && !transportadoraPaga) {
    return {
      status: "Resíduos recebidos na ADS",
      progresso: 75,
      proximaAcao:
        "Conferir a cobrança e efetuar o pagamento da transportadora.",
      moduloDestino: "transportadora",
    };
  }

  if (dataChegadaAds && transportadoraPaga && !cobrancaAdsPaga) {
    return {
      status: "Aguardando recebimento da ADS",
      progresso: 88,
      proximaAcao:
        "Acompanhar o pagamento da Nota Fiscal de cobrança da ADS.",
      moduloDestino: "ads",
    };
  }

  if (dataEfetivaColeta) {
    return {
      status: "Coleta realizada",
      progresso: 63,
      proximaAcao:
        "Acompanhar o transporte até o recebimento dos resíduos na ADS.",
      moduloDestino: "operacao",
    };
  }

  if (
    dataNf &&
    numeroNf &&
    transportadora &&
    dataEnvioTransportadora
  ) {
    return {
      status: "Aguardando coleta",
      progresso: 50,
      proximaAcao:
        "Acompanhar a transportadora e confirmar a realização da coleta.",
      moduloDestino: "operacao",
    };
  }

  if (dataNf && numeroNf && !transportadora) {
    return {
      status: "Transportadora não definida",
      progresso: 38,
      proximaAcao:
        "Selecionar a transportadora responsável pela coleta.",
      moduloDestino: "operacao",
    };
  }

  if (dataNf && numeroNf && !dataEnvioTransportadora) {
    return {
      status: "Solicitação não enviada",
      progresso: 38,
      proximaAcao:
        "Enviar a solicitação de coleta para a transportadora.",
      moduloDestino: "operacao",
    };
  }

  return {
    status: "Aguardando NF",
    progresso: 25,
    proximaAcao:
      "Solicitar e registrar a Nota Fiscal emitida pelo cliente.",
    moduloDestino: "operacao",
  };
}

function classeStatus(status: string) {
  if (status === "Finalizado") {
    return {
      fundo: "border-emerald-200 bg-emerald-50",
      texto: "text-emerald-800",
      faixa: "bg-emerald-600",
      circulo: "bg-emerald-600",
    };
  }

  if (
    status === "Resíduos recebidos na ADS" ||
    status === "Aguardando recebimento da ADS"
  ) {
    return {
      fundo: "border-emerald-200 bg-emerald-50",
      texto: "text-emerald-800",
      faixa: "bg-emerald-600",
      circulo: "bg-emerald-600",
    };
  }

  if (status === "Coleta realizada") {
    return {
      fundo: "border-blue-200 bg-blue-50",
      texto: "text-blue-800",
      faixa: "bg-blue-600",
      circulo: "bg-blue-600",
    };
  }

  if (
    status === "Aguardando coleta" ||
    status === "Transportadora não definida" ||
    status === "Solicitação não enviada"
  ) {
    return {
      fundo: "border-violet-200 bg-violet-50",
      texto: "text-violet-800",
      faixa: "bg-violet-600",
      circulo: "bg-violet-600",
    };
  }

  return {
    fundo: "border-amber-200 bg-amber-50",
    texto: "text-amber-800",
    faixa: "bg-amber-500",
    circulo: "bg-amber-500",
  };
}

export default function PainelInteligenteColeta({
  numeroOv,
  cliente,
  loja,
  cidade,
  estado,
  status,
  dataSolicitacao,
  dataNf,
  numeroNf,
  transportadora,
  dataEnvioTransportadora,
  dataPrevistaColeta,
  dataEfetivaColeta,
  conhecimento,
  dataChegadaAds,
  destino,
  statusPagamentoTransportadora,
  vencimentoTransportadora,
  dataPagamentoTransportadora,
  statusRecebimentoAds,
  vencimentoNfCobrancaAds,
  dataRecebimentoPagamentoAds,
}: PainelInteligenteColetaProps) {
  const situacao = calcularSituacao({
    dataNf,
    numeroNf,
    transportadora,
    dataEnvioTransportadora,
    dataEfetivaColeta,
    dataChegadaAds,
    statusPagamentoTransportadora,
    dataPagamentoTransportadora,
    statusRecebimentoAds,
    dataRecebimentoPagamentoAds,
  });

  const visual = classeStatus(situacao.status);

  const encerrada =
    situacao.status === "Finalizado" &&
    Boolean(dataRecebimentoPagamentoAds);

  const diasOperacao = calcularDiferencaEmDias(
    dataSolicitacao,
    encerrada ? dataRecebimentoPagamentoAds : null,
  );

  const pagamentoTransportadora = normalizarTexto(
    statusPagamentoTransportadora,
  );

  const recebimentoAds = normalizarTexto(
    statusRecebimentoAds,
  );

  const alertas: string[] = [];

  if (
    dataPrevistaColeta &&
    !dataEfetivaColeta &&
    dataVencida(dataPrevistaColeta)
  ) {
    alertas.push(
      `Coleta atrasada. A previsão era ${formatarData(
        dataPrevistaColeta,
      )}.`,
    );
  }

  if (
    dataPrevistaColeta &&
    !dataEfetivaColeta &&
    dataEhHoje(dataPrevistaColeta)
  ) {
    alertas.push("A coleta está prevista para hoje.");
  }

  if (
    vencimentoTransportadora &&
    pagamentoTransportadora !== "pago" &&
    !dataPagamentoTransportadora &&
    dataVencida(vencimentoTransportadora)
  ) {
    alertas.push(
      `Pagamento da transportadora vencido desde ${formatarData(
        vencimentoTransportadora,
      )}.`,
    );
  }

  if (
    vencimentoNfCobrancaAds &&
    recebimentoAds !== "paga" &&
    !dataRecebimentoPagamentoAds &&
    dataVencida(vencimentoNfCobrancaAds)
  ) {
    alertas.push(
      `Cobrança da ADS vencida desde ${formatarData(
        vencimentoNfCobrancaAds,
      )}.`,
    );
  }

  if (diasOperacao >= 7 && situacao.status !== "Finalizado") {
    alertas.push(
      `A operação está aberta há ${diasOperacao} dias.`,
    );
  }

  const statusExibido = status || situacao.status;

  return (
    <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className={`h-1.5 w-full ${visual.faixa}`} />

      <div className="p-6 md:p-7">
        <div className="flex flex-col justify-between gap-6 xl:flex-row xl:items-start">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-700">
              Centro de inteligência operacional
            </p>

            <h2 className="mt-2 text-2xl font-black text-slate-900 md:text-3xl">
              {numeroOv || "Coleta sem número de OV"}
            </h2>

            <p className="mt-2 text-sm font-medium text-slate-600">
              {[cliente, loja].filter(Boolean).join(" • ") ||
                "Cliente e unidade não informados"}
            </p>

            <p className="mt-1 text-sm text-slate-500">
              {[cidade, estado].filter(Boolean).join(" / ") ||
                "Localização não informada"}
            </p>
          </div>

          <div
            className={`min-w-64 rounded-2xl border p-4 ${visual.fundo}`}
          >
            <p
              className={`text-xs font-bold uppercase tracking-[0.16em] ${visual.texto}`}
            >
              Status atual
            </p>

            <div className="mt-2 flex items-center gap-3">
              <span
                className={`h-3 w-3 rounded-full ${visual.circulo}`}
              />

              <p className={`font-bold ${visual.texto}`}>
                {statusExibido}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-7">
          <div className="mb-2 flex items-center justify-between gap-4">
            <p className="text-sm font-semibold text-slate-600">
              Progresso geral da operação
            </p>

            <p className="text-lg font-black text-emerald-700">
              {situacao.progresso}%
            </p>
          </div>

          <div className="h-3 overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full rounded-full bg-emerald-600 transition-all duration-700"
              style={{
                width: `${situacao.progresso}%`,
              }}
            />
          </div>
        </div>

        <div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <article className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
              Tempo da operação
            </p>

            <p className="mt-2 text-xl font-black text-slate-900">
              {diasOperacao} {diasOperacao === 1 ? "dia" : "dias"}
            </p>

            <p className="mt-1 text-xs text-slate-500">
              Desde {formatarData(dataSolicitacao)}
            </p>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
              Transportadora
            </p>

            <p className="mt-2 truncate text-base font-bold text-slate-900">
              {transportadora || "Não definida"}
            </p>

            <p className="mt-1 text-xs text-slate-500">
              {conhecimento
                ? `CT-e: ${conhecimento}`
                : "CT-e não informado"}
            </p>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
              Destino
            </p>

            <p className="mt-2 truncate text-base font-bold text-slate-900">
              {destino || "ADS Logística Ambiental"}
            </p>

            <p className="mt-1 text-xs text-slate-500">
              {dataChegadaAds
                ? `Recebido em ${formatarData(dataChegadaAds)}`
                : "Recebimento pendente"}
            </p>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
              Documentação
            </p>

            <p className="mt-2 text-base font-bold text-slate-900">
              {numeroNf ? `NF ${numeroNf}` : "NF pendente"}
            </p>

            <p className="mt-1 text-xs text-slate-500">
              {dataNf
                ? `Emitida em ${formatarData(dataNf)}`
                : "Data não informada"}
            </p>
          </article>
        </div>

        <div className="mt-6 grid gap-4 xl:grid-cols-[1.4fr_1fr]">
          <article className="rounded-2xl border border-blue-200 bg-blue-50 p-5">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-700">
              Próxima ação recomendada
            </p>

            <p className="mt-2 text-base font-bold leading-6 text-blue-900">
              {situacao.proximaAcao}
            </p>

            <p className="mt-2 text-xs font-medium text-blue-700">
              Módulo indicado:{" "}
              {situacao.moduloDestino === "operacao"
                ? "Operação"
                : situacao.moduloDestino === "transportadora"
                  ? "Financeiro — Transportadora"
                  : "Financeiro — ADS"}
            </p>
          </article>

          <article
            className={[
              "rounded-2xl border p-5",
              alertas.length > 0
                ? "border-red-200 bg-red-50"
                : "border-emerald-200 bg-emerald-50",
            ].join(" ")}
          >
            <p
              className={[
                "text-xs font-bold uppercase tracking-[0.16em]",
                alertas.length > 0
                  ? "text-red-700"
                  : "text-emerald-700",
              ].join(" ")}
            >
              Alertas da operação
            </p>

            {alertas.length === 0 ? (
              <p className="mt-2 text-sm font-semibold text-emerald-800">
                Nenhum alerta crítico identificado.
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {alertas.slice(0, 3).map((alerta) => (
                  <li
                    key={alerta}
                    className="text-sm font-medium leading-5 text-red-800"
                  >
                    • {alerta}
                  </li>
                ))}
              </ul>
            )}
          </article>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <article className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-blue-700">
              Financeiro — Transportadora
            </p>

            <p className="mt-2 font-bold text-blue-900">
              {statusPagamentoTransportadora || "Não cobrado"}
            </p>

            <p className="mt-1 text-xs text-blue-700">
              Vencimento:{" "}
              {formatarData(vencimentoTransportadora)}
            </p>
          </article>

          <article className="rounded-2xl border border-violet-200 bg-violet-50 p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-violet-700">
              Financeiro — ADS
            </p>

            <p className="mt-2 font-bold text-violet-900">
              {statusRecebimentoAds || "Não emitida"}
            </p>

            <p className="mt-1 text-xs text-violet-700">
              Vencimento:{" "}
              {formatarData(vencimentoNfCobrancaAds)}
            </p>
          </article>
        </div>
      </div>
    </section>
  );
}