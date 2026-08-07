"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

type Coleta = {
  id: number;
  numero_ov: string | null;
  cliente: string | null;
  loja: string | null;
  cidade: string | null;
  estado: string | null;
  numero_nf: string | null;
  transportadora: string | null;
  data_coleta: string | null;
  data_prevista_coleta: string | null;
  status: string | null;
  created_at: string | null;
};

function classeStatus(status: string | null) {
  if (status === "Em transporte") {
    return "bg-blue-100 text-blue-700";
  }

  if (status === "Aguardando NF") {
    return "bg-amber-100 text-amber-700";
  }

  if (status === "Finalizado" || status === "Recebido na ADS") {
    return "bg-emerald-100 text-emerald-700";
  }

  return "bg-violet-100 text-violet-700";
}

function formatarData(data: string | null) {
  if (!data) {
    return "—";
  }

  const [ano, mes, dia] = data.split("-");

  if (!ano || !mes || !dia) {
    return data;
  }

  return `${dia}/${mes}/${ano}`;
}

export default function ColetasTable() {
  const [coletas, setColetas] = useState<Coleta[]>([]);
  const [pesquisa, setPesquisa] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  useEffect(() => {
    async function carregarColetas() {
      setCarregando(true);
      setErro("");

      const { data, error } = await supabase
        .from("coletas")
        .select(
          "id, numero_ov, cliente, loja, cidade, estado, numero_nf, transportadora, data_coleta, data_prevista_coleta, status, created_at",
        )
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) {
        console.error(error);
        setErro("Não foi possível carregar as coletas.");
        setCarregando(false);
        return;
      }

      setColetas((data ?? []) as Coleta[]);
      setCarregando(false);
    }

    carregarColetas();
  }, []);

  const coletasFiltradas = useMemo(() => {
    const termo = pesquisa.trim().toLowerCase();

    if (!termo) {
      return coletas;
    }

    return coletas.filter((coleta) => {
      const conteudo = [
        coleta.numero_ov,
        coleta.cliente,
        coleta.loja,
        coleta.cidade,
        coleta.estado,
        coleta.numero_nf,
        coleta.transportadora,
        coleta.status,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return conteudo.includes(termo);
    });
  }, [coletas, pesquisa]);

  return (
    <article className="mt-7 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col justify-between gap-4 border-b border-slate-200 p-5 md:flex-row md:items-center">
        <div>
          <h3 className="text-lg font-bold">Coletas recentes</h3>
          <p className="text-sm text-slate-500">
            Dados reais cadastrados no Supabase
          </p>
        </div>

        <input
          type="search"
          value={pesquisa}
          onChange={(evento) => setPesquisa(evento.target.value)}
          placeholder="Pesquisar OV, NF ou cliente..."
          className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm outline-none focus:border-emerald-600 md:w-72"
        />
      </div>

      {erro && (
        <p className="m-5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {erro}
        </p>
      )}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-left">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-5 py-4">OV</th>
              <th className="px-5 py-4">Cliente / Unidade</th>
              <th className="px-5 py-4">Nota fiscal</th>
              <th className="px-5 py-4">Transportadora</th>
              <th className="px-5 py-4">Data da coleta</th>
              <th className="px-5 py-4">Status</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100 text-sm">
            {carregando && (
              <tr>
                <td className="px-5 py-8 text-center text-slate-500" colSpan={6}>
                  Carregando coletas...
                </td>
              </tr>
            )}

            {!carregando && coletasFiltradas.length === 0 && (
              <tr>
                <td className="px-5 py-8 text-center text-slate-500" colSpan={6}>
                  Nenhuma coleta encontrada.
                </td>
              </tr>
            )}

            {!carregando &&
              coletasFiltradas.map((coleta) => (
                <tr key={coleta.id} className="transition hover:bg-slate-50">
                  <td className="px-5 py-4 font-semibold text-emerald-700">
                    {coleta.numero_ov || `#${coleta.id}`}
                  </td>

                  <td className="px-5 py-4">
                    <p className="font-medium">
                      {coleta.cliente || "Cliente não informado"}
                    </p>
                    <p className="text-xs text-slate-500">
                      {[coleta.loja, coleta.cidade, coleta.estado]
                        .filter(Boolean)
                        .join(" • ") || "Unidade não informada"}
                    </p>
                  </td>

                  <td className="px-5 py-4">
                    {coleta.numero_nf || "Aguardando"}
                  </td>

                  <td className="px-5 py-4">
                    {coleta.transportadora || "Não definida"}
                  </td>

                  <td className="px-5 py-4">
                    {formatarData(
                      coleta.data_coleta || coleta.data_prevista_coleta,
                    )}
                  </td>

                  <td className="px-5 py-4">
                    <span
                      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${classeStatus(
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
    </article>
  );
}
