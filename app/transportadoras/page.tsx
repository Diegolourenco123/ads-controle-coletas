"use client";

import { FormEvent, useEffect, useState } from "react";
import Header from "../components/Header";
import Sidebar from "../components/Sidebar";
import { supabase } from "../lib/supabase";

type Transportadora = {
  id: number;
  nome: string;
  cnpj: string | null;
  contato: string | null;
  telefone: string | null;
  email: string | null;
  prazo_medio: number | null;
  observacoes: string | null;
  created_at: string;
};

const campo =
  "mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100";

const rotulo = "text-sm font-semibold text-slate-700";

export default function TransportadorasPage() {
  const [transportadoras, setTransportadoras] = useState<Transportadora[]>([]);
  const [pesquisa, setPesquisa] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);

  async function carregarTransportadoras() {
    setCarregando(true);

    const { data, error } = await supabase
      .from("transportadoras")
      .select("*")
      .order("nome", { ascending: true });

    if (error) {
      console.error(error);
      setMensagem(
        `Não foi possível carregar as transportadoras: ${error.message}`,
      );
      setCarregando(false);
      return;
    }

    setTransportadoras((data ?? []) as Transportadora[]);
    setCarregando(false);
  }

  useEffect(() => {
    carregarTransportadoras();
  }, []);

  async function cadastrarTransportadora(
    evento: FormEvent<HTMLFormElement>,
  ) {
    evento.preventDefault();

    const formulario = evento.currentTarget;

    if (!formulario.checkValidity()) {
      formulario.reportValidity();
      return;
    }

    setSalvando(true);
    setMensagem("Salvando transportadora...");

    const dados = new FormData(formulario);

    const valorOuNulo = (nome: string) => {
      const valor = dados.get(nome)?.toString().trim();
      return valor ? valor : null;
    };

    const prazoInformado = valorOuNulo("prazoMedio");

    const novaTransportadora = {
      nome: valorOuNulo("nome"),
      cnpj: valorOuNulo("cnpj"),
      contato: valorOuNulo("contato"),
      telefone: valorOuNulo("telefone"),
      email: valorOuNulo("email"),
      prazo_medio: prazoInformado ? Number(prazoInformado) : null,
      observacoes: valorOuNulo("observacoes"),
    };

    const { error } = await supabase
      .from("transportadoras")
      .insert(novaTransportadora);

    if (error) {
      console.error(error);
      setMensagem(`Não foi possível salvar: ${error.message}`);
      setSalvando(false);
      return;
    }

    formulario.reset();
    setMensagem("Transportadora cadastrada com sucesso!");
    setSalvando(false);

    await carregarTransportadoras();
  }

  async function excluirTransportadora(id: number, nome: string) {
    const confirmou = window.confirm(
      `Deseja realmente excluir a transportadora "${nome}"?`,
    );

    if (!confirmou) {
      return;
    }

    const { error } = await supabase
      .from("transportadoras")
      .delete()
      .eq("id", id);

    if (error) {
      console.error(error);
      setMensagem(`Não foi possível excluir: ${error.message}`);
      return;
    }

    setMensagem("Transportadora excluída com sucesso!");
    await carregarTransportadoras();
  }

  const termo = pesquisa.trim().toLowerCase();

  const transportadorasFiltradas = transportadoras.filter(
    (transportadora) => {
      if (!termo) {
        return true;
      }

      const conteudo = [
        transportadora.nome,
        transportadora.cnpj,
        transportadora.contato,
        transportadora.telefone,
        transportadora.email,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return conteudo.includes(termo);
    },
  );

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <Header />

      <div className="mx-auto grid max-w-[1500px] grid-cols-1 lg:grid-cols-[230px_1fr]">
        <Sidebar />

        <section className="min-w-0 p-5 md:p-8">
          <div className="mb-7">
            <p className="text-sm font-medium text-emerald-700">
              Cadastros operacionais
            </p>

            <h2 className="mt-1 text-3xl font-bold">
              Transportadoras
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Cadastre e consulte as transportadoras utilizadas nas
              coletas.
            </p>
          </div>

          {mensagem && (
            <div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-800">
              {mensagem}
            </div>
          )}

          <form
            onSubmit={cadastrarTransportadora}
            className="mb-7 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
          >
            <div className="mb-6">
              <h3 className="text-lg font-bold">
                Cadastrar transportadora
              </h3>

              <p className="text-sm text-slate-500">
                Preencha os dados da empresa responsável pelo
                transporte.
              </p>
            </div>

            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              <label className={rotulo}>
                Nome da transportadora *
                <input
                  type="text"
                  name="nome"
                  required
                  placeholder="Ex.: Transportadora Alfa"
                  className={campo}
                />
              </label>

              <label className={rotulo}>
                CNPJ
                <input
                  type="text"
                  name="cnpj"
                  placeholder="00.000.000/0000-00"
                  className={campo}
                />
              </label>

              <label className={rotulo}>
                Contato
                <input
                  type="text"
                  name="contato"
                  placeholder="Nome do responsável"
                  className={campo}
                />
              </label>

              <label className={rotulo}>
                Telefone
                <input
                  type="text"
                  name="telefone"
                  placeholder="(11) 00000-0000"
                  className={campo}
                />
              </label>

              <label className={rotulo}>
                E-mail
                <input
                  type="email"
                  name="email"
                  placeholder="contato@transportadora.com.br"
                  className={campo}
                />
              </label>

              <label className={rotulo}>
                Prazo médio em dias
                <input
                  type="number"
                  name="prazoMedio"
                  min="0"
                  placeholder="Ex.: 3"
                  className={campo}
                />
              </label>
            </div>

            <label className={`${rotulo} mt-5 block`}>
              Observações
              <textarea
                name="observacoes"
                rows={4}
                placeholder="Regiões atendidas, horários, condições especiais..."
                className={campo}
              />
            </label>

            <div className="mt-6 flex justify-end">
              <button
                type="submit"
                disabled={salvando}
                className="rounded-xl bg-emerald-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {salvando
                  ? "Salvando..."
                  : "Cadastrar transportadora"}
              </button>
            </div>
          </form>

          <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col justify-between gap-4 border-b border-slate-200 p-5 md:flex-row md:items-center">
              <div>
                <h3 className="text-lg font-bold">
                  Transportadoras cadastradas
                </h3>

                <p className="text-sm text-slate-500">
                  {transportadorasFiltradas.length} registro(s)
                  encontrado(s)
                </p>
              </div>

              <input
                type="search"
                value={pesquisa}
                onChange={(evento) =>
                  setPesquisa(evento.target.value)
                }
                placeholder="Pesquisar transportadora..."
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-emerald-600 md:w-80"
              />
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[1000px] text-left">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-5 py-4">Transportadora</th>
                    <th className="px-5 py-4">CNPJ</th>
                    <th className="px-5 py-4">Contato</th>
                    <th className="px-5 py-4">Telefone</th>
                    <th className="px-5 py-4">E-mail</th>
                    <th className="px-5 py-4">Prazo</th>
                    <th className="px-5 py-4">Ações</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100 text-sm">
                  {carregando && (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-5 py-8 text-center text-slate-500"
                      >
                        Carregando transportadoras...
                      </td>
                    </tr>
                  )}

                  {!carregando &&
                    transportadorasFiltradas.length === 0 && (
                      <tr>
                        <td
                          colSpan={7}
                          className="px-5 py-8 text-center text-slate-500"
                        >
                          Nenhuma transportadora cadastrada.
                        </td>
                      </tr>
                    )}

                  {!carregando &&
                    transportadorasFiltradas.map(
                      (transportadora) => (
                        <tr
                          key={transportadora.id}
                          className="transition hover:bg-slate-50"
                        >
                          <td className="px-5 py-4 font-semibold text-slate-900">
                            {transportadora.nome}
                          </td>

                          <td className="px-5 py-4">
                            {transportadora.cnpj || "—"}
                          </td>

                          <td className="px-5 py-4">
                            {transportadora.contato || "—"}
                          </td>

                          <td className="px-5 py-4">
                            {transportadora.telefone || "—"}
                          </td>

                          <td className="px-5 py-4">
                            {transportadora.email || "—"}
                          </td>

                          <td className="px-5 py-4">
                            {transportadora.prazo_medio !== null
                              ? `${transportadora.prazo_medio} dia(s)`
                              : "—"}
                          </td>

                          <td className="px-5 py-4">
                            <button
                              type="button"
                              onClick={() =>
                                excluirTransportadora(
                                  transportadora.id,
                                  transportadora.nome,
                                )
                              }
                              className="rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-red-700"
                            >
                              Excluir
                            </button>
                          </td>
                        </tr>
                      ),
                    )}
                </tbody>
              </table>
            </div>
          </article>
        </section>
      </div>
    </main>
  );
}