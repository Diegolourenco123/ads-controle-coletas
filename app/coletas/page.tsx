"use client";

import Link from "next/link";
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
  numero_nf: string | null;
  transportadora: string | null;
  data_prevista_coleta: string | null;
  data_coleta: string | null;
  status: string | null;
  created_at: string | null;
};

function formatarData(data: string | null) {
  if (!data) {
    return "—";
  }

  const [ano, mes, dia] = data.split("-");

  return ano && mes && dia ? `${dia}/${mes}/${ano}` : data;
}

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

export default function TodasAsColetasPage() {
  const [coletas, setColetas] = useState<Coleta[]>([]);
  const [pesquisa, setPesquisa] = useState("");
  const [status, setStatus] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  useEffect(() => {
    async function carregarColetas() {
      setCarregando(true);
      setErro("");

      const { data, error } = await supabase
        .from("coletas")
        .select(
          "id, data_solicitacao, numero_ov, cliente, loja, cidade, estado, numero_nf, transportadora, data_prevista_coleta, data_coleta, status, created_at",
        )
        .order("created_at", { ascending: false });

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

    return coletas.filter((coleta) => {
      const correspondeStatus = !status || coleta.status === status;

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

      const correspondePesquisa = !termo || conteudo.includes(termo);

      return correspondeStatus && correspondePesquisa;
    });
  }, [coletas, pesquisa, status]);

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <Header />

      <div className="mx-auto grid max-w-[1500px] grid-cols-1 lg:grid-cols-[230px_1fr]">
        <Sidebar />

        <section className="min-w-0 p-5 md:p-8">
          <div className="mb-7">
            <p className="text-sm font-medium text-emerald-700">
              Controle operacional
            </p>

            <h2 className="mt-1 text-3xl font-bold">
              Todas as coletas
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Consulte os registros cadastrados no banco de dados.
            </p>
          </div>

          <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="grid gap-4 border-b border-slate-200 p-5 md:grid-cols-[1fr_260px]">
              <input
                type="search"
                value={pesquisa}
                onChange={(evento) => setPesquisa(evento.target.value)}
                placeholder="Pesquisar cliente, OV, NF, cidade..."
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-emerald-600"
              />

              <select
                value={status}
                onChange={(evento) => setStatus(evento.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-emerald-600"
              >
                <option value="">Todos os status</option>
                <option value="Aguardando NF">
                  Aguardando NF
                </option>
                <option value="Aguardando transportadora">
                  Aguardando transportadora
                </option>
                <option value="Coleta solicitada">
                  Coleta solicitada
                </option>
                <option value="Coleta agendada">
                  Coleta agendada
                </option>
                <option value="Em transporte">
                  Em transporte
                </option>
                <option value="Recebido na ADS">
                  Recebido na ADS
                </option>
                <option value="Finalizado">
                  Finalizado
                </option>
              </select>
            </div>

            {erro && (
              <p className="m-5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {erro}
              </p>
            )}

            <div className="overflow-x-auto">
              <table className="w-full min-w-[1000px] table-fixed text-left">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-4">Solicitação</th>
                    <th className="px-4 py-4">OV</th>
                    <th className="px-4 py-4">
                      Cliente / Unidade
                    </th>
                    <th className="px-4 py-4">NF</th>
                    <th className="px-4 py-4">
                      Transportadora
                    </th>
                    <th className="px-4 py-4">Coleta</th>
                    <th className="px-4 py-4">Status</th>
                    <th className="px-4 py-4">Ações</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100 text-sm">
                  {carregando && (
                    <tr>
                      <td
                        colSpan={8}
                        className="px-5 py-8 text-center text-slate-500"
                      >
                        Carregando coletas...
                      </td>
                    </tr>
                  )}

                  {!carregando &&
                    coletasFiltradas.length === 0 && (
                      <tr>
                        <td
                          colSpan={8}
                          className="px-5 py-8 text-center text-slate-500"
                        >
                          Nenhuma coleta encontrada.
                        </td>
                      </tr>
                    )}

                  {!carregando &&
                    coletasFiltradas.map((coleta) => (
                      <tr
                        key={coleta.id}
                        className="transition hover:bg-slate-50"
                      >
                        <td className="px-4 py-4">
                          {formatarData(coleta.data_solicitacao)}
                        </td>

                        <td className="px-4 py-4 font-semibold text-emerald-700">
                          {coleta.numero_ov || `#${coleta.id}`}
                        </td>

                        <td className="px-4 py-4">
                          <p className="font-medium">
                            {coleta.cliente ||
                              "Cliente não informado"}
                          </p>

                          <p className="text-xs text-slate-500">
                            {[
                              coleta.loja,
                              coleta.cidade,
                              coleta.estado,
                            ]
                              .filter(Boolean)
                              .join(" • ") ||
                              "Unidade não informada"}
                          </p>
                        </td>

                        <td className="px-4 py-4">
                          {coleta.numero_nf || "Aguardando"}
                        </td>

                        <td className="px-4 py-4">
                          {coleta.transportadora ||
                            "Não definida"}
                        </td>

                        <td className="px-4 py-4">
                          {formatarData(
                            coleta.data_coleta ||
                              coleta.data_prevista_coleta,
                          )}
                        </td>

                        <td className="px-4 py-4">
                          <span
                            className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${classeStatus(
                              coleta.status,
                            )}`}
                          >
                            {coleta.status || "Sem status"}
                          </span>
                        </td>

                        <td className="px-4 py-4">
                          <Link
                            href={`/coletas/${coleta.id}`}
                            className="inline-flex rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-blue-700"
                          >
                            Editar
                          </Link>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>

            <div className="border-t border-slate-200 p-4 text-sm text-slate-500">
              {coletasFiltradas.length} coleta(s) exibida(s)
            </div>
          </article>
        </section>
      </div>
    </main>
  );
}
