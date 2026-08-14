"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

type Coleta = {
  id: number;
  numero_ov: string | null;
  cliente: string | null;
  loja: string | null;
  numero_nf: string | null;
  transportadora: string | null;
  data_coleta: string | null;
  data_prevista_coleta: string | null;
  status: string | null;
};

type Alerta = {
  id: string;
  coletaId: number;
  titulo: string;
  descricao: string;
  referencia: string;
  prioridade: number;
  classes: string;
  marcador: string;
};

function normalizarTexto(texto: string | null | undefined) {
  return (texto ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function criarDataLocal(data: string) {
  const [ano, mes, dia] = data.split("-").map(Number);

  return new Date(ano, mes - 1, dia);
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

function estaFinalizada(status: string) {
  return [
    "finalizado",
    "finalizada",
    "recebido na ads",
    "concluido",
    "concluida",
  ].includes(status);
}

export default function AlertasOperacionais() {
  const [coletas, setColetas] = useState<Coleta[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  useEffect(() => {
    async function carregarAlertas() {
      setCarregando(true);
      setErro("");

      const { data, error } = await supabase
        .from("coletas")
        .select(
          "id, numero_ov, cliente, loja, numero_nf, transportadora, data_coleta, data_prevista_coleta, status",
        )
        .order("data_prevista_coleta", { ascending: true });

      if (error) {
        console.error("Erro ao carregar alertas:", error);
        setErro("Não foi possível carregar os alertas operacionais.");
        setCarregando(false);
        return;
      }

      setColetas((data ?? []) as Coleta[]);
      setCarregando(false);
    }

    carregarAlertas();

    const canal = supabase
      .channel("alertas-operacionais")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "coletas",
        },
        () => {
          carregarAlertas();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(canal);
    };
  }, []);

  const alertas = useMemo(() => {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const resultado: Alerta[] = [];

    coletas.forEach((coleta) => {
      const status = normalizarTexto(coleta.status);

      const referencia =
        coleta.numero_ov ||
        coleta.cliente ||
        `Coleta #${coleta.id}`;

      if (estaFinalizada(status)) {
        return;
      }

      // CRÍTICO: coleta com data prevista vencida
      if (
        coleta.data_prevista_coleta &&
        !coleta.data_coleta
      ) {
        const dataPrevista = criarDataLocal(
          coleta.data_prevista_coleta,
        );

        dataPrevista.setHours(0, 0, 0, 0);

        if (dataPrevista < hoje) {
          resultado.push({
            id: `atrasada-${coleta.id}`,
            coletaId: coleta.id,
            titulo: "Coleta atrasada",
            descricao: `Previsão para ${formatarData(
              coleta.data_prevista_coleta,
            )} e coleta ainda não realizada.`,
            referencia,
            prioridade: 1,
            classes:
              "border-red-200 bg-red-50 text-red-800",
            marcador: "bg-red-500",
          });

          return;
        }
      }

      // INFORMAÇÃO FALTANTE: Nota Fiscal
      if (
        status === "aguardando nf" ||
        status === "aguardando nota fiscal" ||
        !coleta.numero_nf
      ) {
        resultado.push({
          id: `nf-${coleta.id}`,
          coletaId: coleta.id,
          titulo: "Aguardando nota fiscal",
          descricao:
            "A nota fiscal ainda não foi registrada.",
          referencia,
          prioridade: 2,
          classes:
            "border-amber-200 bg-amber-50 text-amber-800",
          marcador: "bg-amber-500",
        });

        return;
      }

      // INFORMAÇÃO FALTANTE: Transportadora
      if (!coleta.transportadora) {
        resultado.push({
          id: `transportadora-${coleta.id}`,
          coletaId: coleta.id,
          titulo: "Transportadora não definida",
          descricao:
            "É necessário selecionar a transportadora responsável.",
          referencia,
          prioridade: 3,
          classes:
            "border-amber-200 bg-amber-50 text-amber-800",
          marcador: "bg-amber-500",
        });

        return;
      }

      // PENDÊNCIA OPERACIONAL: aguardando coleta
      if (
        status === "aguardando coleta" ||
        status === "coleta solicitada" ||
        status === "aguardando transportadora" ||
        status === "solicitado a transportadora"
      ) {
        const semDataPrevista =
          !coleta.data_prevista_coleta;

        resultado.push({
          id: `coleta-${coleta.id}`,
          coletaId: coleta.id,
          titulo: "Aguardando realização da coleta",
          descricao: semDataPrevista
            ? "Data prevista ainda não informada."
            : `Data prevista: ${formatarData(
                coleta.data_prevista_coleta,
              )}.`,
          referencia,
          prioridade: semDataPrevista ? 3 : 4,
          classes: semDataPrevista
            ? "border-orange-300 bg-orange-100 text-orange-900"
            : "border-orange-200 bg-orange-50 text-orange-800",
          marcador: semDataPrevista
            ? "bg-orange-600"
            : "bg-orange-500",
        });

        return;
      }

      // INFORMAÇÃO: em transporte
      if (
        status === "em transporte" ||
        status === "em transito" ||
        status === "coletado"
      ) {
        resultado.push({
          id: `transporte-${coleta.id}`,
          coletaId: coleta.id,
          titulo: "Coleta em transporte",
          descricao:
            "Carga coletada e ainda não recebida na ADS.",
          referencia,
          prioridade: 5,
          classes:
            "border-blue-200 bg-blue-50 text-blue-800",
          marcador: "bg-blue-500",
        });

        return;
      }

      // INFORMAÇÃO FALTANTE: data prevista
      if (
        !coleta.data_prevista_coleta &&
        !coleta.data_coleta
      ) {
        resultado.push({
          id: `data-${coleta.id}`,
          coletaId: coleta.id,
          titulo: "Data da coleta não informada",
          descricao:
            "Cadastre uma data prevista para acompanhamento.",
          referencia,
          prioridade: 6,
          classes:
            "border-amber-200 bg-amber-50 text-amber-800",
          marcador: "bg-amber-500",
        });
      }
    });

    return resultado
      .sort(
        (a, b) =>
          a.prioridade - b.prioridade,
      )
      .slice(0, 6);
  }, [coletas]);

  return (
    <section className="mt-7">
      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold text-slate-900">
            Alertas operacionais
          </h3>

          <p className="text-sm text-slate-500">
            Pendências que precisam de acompanhamento.
          </p>
        </div>

        {!carregando && (
          <span className="rounded-full bg-slate-200 px-3 py-1 text-xs font-semibold text-slate-700">
            {alertas.length} alerta(s)
          </span>
        )}
      </div>

      {erro && (
        <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {erro}
        </p>
      )}

      {carregando && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">
          Carregando alertas...
        </div>
      )}

      {!carregando &&
        !erro &&
        alertas.length === 0 && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 shadow-sm">
            <p className="font-semibold text-emerald-800">
              Operação sem pendências críticas
            </p>

            <p className="mt-1 text-sm text-emerald-700">
              Nenhum alerta operacional foi identificado neste momento.
            </p>
          </div>
        )}

      {!carregando &&
        alertas.length > 0 && (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {alertas.map((alerta) => (
              <article
                key={alerta.id}
                className={`relative overflow-hidden rounded-2xl border p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${alerta.classes}`}
              >
                <div
                  className={`absolute bottom-0 left-0 top-0 w-1.5 ${alerta.marcador}`}
                />

                <div className="pl-2">
                  <p className="text-xs font-bold uppercase tracking-wide opacity-70">
                    {alerta.referencia}
                  </p>

                  <h4 className="mt-2 font-bold">
                    {alerta.titulo}
                  </h4>

                  <p className="mt-1 text-sm opacity-80">
                    {alerta.descricao}
                  </p>
                </div>
              </article>
            ))}
          </div>
        )}
    </section>
  );
}