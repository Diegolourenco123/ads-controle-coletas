type TimelineColetaProps = {
  dataSolicitacao: string | null;
  dataOv: string | null;
  numeroOv: string | null;
  dataNf: string | null;
  numeroNf: string | null;
  transportadora: string | null;
  dataEnvioTransportadora: string | null;
  dataEfetivaColeta: string | null;
  conhecimento: string | null;
  dataChegadaAds: string | null;
  statusPagamentoTransportadora: string | null;
  dataPagamentoTransportadora: string | null;
  statusRecebimentoAds: string | null;
  dataRecebimentoPagamentoAds: string | null;
};

type Etapa = {
  titulo: string;
  descricao: string;
  data: string | null;
  concluida: boolean;
};

function normalizarTexto(texto: string | null | undefined) {
  return (texto ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function formatarData(data: string | null) {
  if (!data) {
    return null;
  }

  const [ano, mes, dia] = data.split("-");

  if (!ano || !mes || !dia) {
    return data;
  }

  return `${dia}/${mes}/${ano}`;
}

export default function TimelineColeta({
  dataSolicitacao,
  dataOv,
  numeroOv,
  dataNf,
  numeroNf,
  transportadora,
  dataEnvioTransportadora,
  dataEfetivaColeta,
  conhecimento,
  dataChegadaAds,
  statusPagamentoTransportadora,
  dataPagamentoTransportadora,
  statusRecebimentoAds,
  dataRecebimentoPagamentoAds,
}: TimelineColetaProps) {
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

  const etapas: Etapa[] = [
    {
      titulo: "Solicitação recebida",
      descricao: "Solicitação de coleta registrada no sistema.",
      data: dataSolicitacao,
      concluida: Boolean(dataSolicitacao),
    },
    {
      titulo: "Ordem de Visita emitida",
      descricao: numeroOv
        ? `Ordem de Visita ${numeroOv}.`
        : "Ordem de Visita ainda não informada.",
      data: dataOv,
      concluida: Boolean(dataOv && numeroOv),
    },
    {
      titulo: "Nota Fiscal recebida",
      descricao: numeroNf
        ? `Nota Fiscal ${numeroNf}.`
        : "Nota Fiscal do cliente ainda não informada.",
      data: dataNf,
      concluida: Boolean(dataNf && numeroNf),
    },
    {
      titulo: "Solicitação enviada à transportadora",
      descricao: transportadora
        ? `Transportadora responsável: ${transportadora}.`
        : "Transportadora ainda não definida.",
      data: dataEnvioTransportadora,
      concluida: Boolean(
        transportadora && dataEnvioTransportadora,
      ),
    },
    {
      titulo: "Coleta realizada",
      descricao: conhecimento
        ? `Conhecimento / CT-e: ${conhecimento}.`
        : "Aguardando confirmação da coleta ou emissão do CT-e.",
      data: dataEfetivaColeta,
      concluida: Boolean(dataEfetivaColeta),
    },
    {
      titulo: "Resíduos recebidos na ADS",
      descricao: dataChegadaAds
        ? "Recebimento do resíduo confirmado."
        : "Resíduo ainda não recebido na ADS.",
      data: dataChegadaAds,
      concluida: Boolean(dataChegadaAds),
    },
    {
      titulo: "Pagamento da transportadora",
      descricao: transportadoraPaga
        ? "Pagamento do frete confirmado."
        : pagamentoTransportadora === "aguardando pagamento"
          ? "Pagamento do frete pendente."
          : pagamentoTransportadora === "vencido"
            ? "Pagamento do frete vencido."
            : pagamentoTransportadora === "contestado"
              ? "Cobrança da transportadora contestada."
              : "Cobrança da transportadora ainda não concluída.",
      data: dataPagamentoTransportadora,
      concluida: transportadoraPaga,
    },
    {
      titulo: "Recebimento da cobrança ADS",
      descricao: cobrancaAdsPaga
        ? "Pagamento do cliente confirmado."
        : recebimentoAds === "aguardando recebimento"
          ? "Aguardando pagamento do cliente."
          : recebimentoAds === "vencida"
            ? "Cobrança da ADS vencida."
            : recebimentoAds === "emitida"
              ? "Nota de cobrança emitida."
              : "Cobrança da ADS ainda não concluída.",
      data: dataRecebimentoPagamentoAds,
      concluida: cobrancaAdsPaga,
    },
  ];

  const quantidadeConcluida = etapas.filter(
    (etapa) => etapa.concluida,
  ).length;

  const progresso = Math.round(
    (quantidadeConcluida / etapas.length) * 100,
  );

  const primeiraPendente = etapas.findIndex(
    (etapa) => !etapa.concluida,
  );

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-7 flex flex-col justify-between gap-5 md:flex-row md:items-end">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">
            Timeline inteligente
          </p>

          <h3 className="mt-1 text-xl font-bold text-slate-900">
            Andamento da coleta
          </h3>

          <p className="mt-1 text-sm text-slate-500">
            Acompanhe todas as etapas operacionais e financeiras.
          </p>
        </div>

        <div className="min-w-48">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="font-semibold text-slate-600">
              Progresso
            </span>

            <span className="font-bold text-emerald-700">
              {progresso}%
            </span>
          </div>

          <div className="h-2.5 overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full rounded-full bg-emerald-600 transition-all duration-500"
              style={{ width: `${progresso}%` }}
            />
          </div>

          <p className="mt-2 text-right text-xs text-slate-500">
            {quantidadeConcluida} de {etapas.length} etapas concluídas
          </p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {etapas.map((etapa, indice) => {
          const atual =
            !etapa.concluida && indice === primeiraPendente;

          const classes = etapa.concluida
            ? "border-emerald-200 bg-emerald-50"
            : atual
              ? "border-blue-200 bg-blue-50"
              : "border-slate-200 bg-slate-50";

          const circulo = etapa.concluida
            ? "border-emerald-600 bg-emerald-600 text-white"
            : atual
              ? "border-blue-600 bg-blue-600 text-white"
              : "border-slate-300 bg-white text-slate-400";

          const status = etapa.concluida
            ? "Concluída"
            : atual
              ? "Etapa atual"
              : "Pendente";

          return (
            <article
              key={etapa.titulo}
              className={`relative rounded-2xl border p-5 transition ${classes}`}
            >
              <div className="flex items-start gap-4">
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 text-sm font-bold ${circulo}`}
                >
                  {etapa.concluida ? "✓" : indice + 1}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-start">
                    <div>
                      <h4 className="font-bold text-slate-900">
                        {etapa.titulo}
                      </h4>

                      <p className="mt-1 text-sm leading-5 text-slate-600">
                        {etapa.descricao}
                      </p>
                    </div>

                    <span
                      className={[
                        "shrink-0 rounded-full px-3 py-1 text-xs font-bold",
                        etapa.concluida
                          ? "bg-emerald-100 text-emerald-700"
                          : atual
                            ? "bg-blue-100 text-blue-700"
                            : "bg-slate-200 text-slate-600",
                      ].join(" ")}
                    >
                      {status}
                    </span>
                  </div>

                  <p className="mt-3 text-xs font-semibold text-slate-500">
                    {formatarData(etapa.data) ||
                      "Data não informada"}
                  </p>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}