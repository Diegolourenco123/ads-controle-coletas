"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Header from "../components/Header";
import Sidebar from "../components/Sidebar";
import { supabase } from "../lib/supabase";

type Cliente = {
  id: number;
  razao_social: string;
  nome_fantasia: string | null;
  cnpj: string | null;
  inscricao_estadual: string | null;

  unidade: string | null;
  cep: string | null;
  endereco: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string;
  estado: string;

  responsavel: string | null;
  telefone: string | null;
  celular: string | null;
  email: string | null;

  transportadora_padrao: string | null;
  observacoes: string | null;

  created_at: string;
  updated_at: string;
};

const campo =
  "mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100";

const rotulo = "text-sm font-semibold text-slate-700";

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

export default function ClientesPage() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [pesquisa, setPesquisa] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [clienteEmEdicao, setClienteEmEdicao] =
    useState<Cliente | null>(null);

  async function carregarClientes() {
    setCarregando(true);

    const { data, error } = await supabase
      .from("clientes")
      .select("*")
      .order("razao_social", { ascending: true });

    if (error) {
      console.error(error);
      setMensagem(
        `Não foi possível carregar os clientes: ${error.message}`,
      );
      setCarregando(false);
      return;
    }

    setClientes((data ?? []) as Cliente[]);
    setCarregando(false);
  }

  useEffect(() => {
    carregarClientes();
  }, []);

  async function salvarCliente(
    evento: FormEvent<HTMLFormElement>,
  ) {
    evento.preventDefault();

    const formulario = evento.currentTarget;

    if (!formulario.checkValidity()) {
      formulario.reportValidity();
      return;
    }

    setSalvando(true);

    setMensagem(
      clienteEmEdicao
        ? "Salvando alterações..."
        : "Cadastrando cliente...",
    );

    const dados = new FormData(formulario);

    const valorOuNulo = (nome: string) => {
      const valor = dados.get(nome)?.toString().trim();
      return valor ? valor : null;
    };

    const dadosCliente = {
      razao_social: valorOuNulo("razaoSocial"),
      nome_fantasia: valorOuNulo("nomeFantasia"),
      cnpj: valorOuNulo("cnpj"),
      inscricao_estadual: valorOuNulo("inscricaoEstadual"),

      unidade: valorOuNulo("unidade"),
      cep: valorOuNulo("cep"),
      endereco: valorOuNulo("endereco"),
      numero: valorOuNulo("numero"),
      complemento: valorOuNulo("complemento"),
      bairro: valorOuNulo("bairro"),
      cidade: valorOuNulo("cidade"),
      estado: valorOuNulo("estado"),

      responsavel: valorOuNulo("responsavel"),
      telefone: valorOuNulo("telefone"),
      celular: valorOuNulo("celular"),
      email: valorOuNulo("email"),

      transportadora_padrao: valorOuNulo(
        "transportadoraPadrao",
      ),
      observacoes: valorOuNulo("observacoes"),

      updated_at: new Date().toISOString(),
    };

    let error;

    if (clienteEmEdicao) {
      const resultado = await supabase
        .from("clientes")
        .update(dadosCliente)
        .eq("id", clienteEmEdicao.id);

      error = resultado.error;
    } else {
      const resultado = await supabase
        .from("clientes")
        .insert(dadosCliente);

      error = resultado.error;
    }

    if (error) {
      console.error(error);
      setMensagem(`Não foi possível salvar: ${error.message}`);
      setSalvando(false);
      return;
    }

    formulario.reset();
    setClienteEmEdicao(null);
    setSalvando(false);

    setMensagem(
      clienteEmEdicao
        ? "Cliente atualizado com sucesso!"
        : "Cliente cadastrado com sucesso!",
    );

    await carregarClientes();

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  function editarCliente(cliente: Cliente) {
    setClienteEmEdicao(cliente);
    setMensagem("Editando cliente selecionado.");

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  function cancelarEdicao() {
    setClienteEmEdicao(null);
    setMensagem("");
  }

  async function excluirCliente(
    id: number,
    nomeCliente: string,
  ) {
    const confirmou = window.confirm(
      `Deseja realmente excluir o cliente "${nomeCliente}"?`,
    );

    if (!confirmou) {
      return;
    }

    const { error } = await supabase
      .from("clientes")
      .delete()
      .eq("id", id);

    if (error) {
      console.error(error);
      setMensagem(`Não foi possível excluir: ${error.message}`);
      return;
    }

    setMensagem("Cliente excluído com sucesso!");

    if (clienteEmEdicao?.id === id) {
      setClienteEmEdicao(null);
    }

    await carregarClientes();
  }

  const clientesFiltrados = useMemo(() => {
    const termo = pesquisa.trim().toLowerCase();

    if (!termo) {
      return clientes;
    }

    return clientes.filter((cliente) => {
      const conteudo = [
        cliente.razao_social,
        cliente.nome_fantasia,
        cliente.cnpj,
        cliente.unidade,
        cliente.cidade,
        cliente.estado,
        cliente.responsavel,
        cliente.email,
        cliente.telefone,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return conteudo.includes(termo);
    });
  }, [clientes, pesquisa]);

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
              Clientes
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Cadastre e consulte clientes e unidades atendidas
              pela ADS.
            </p>
          </div>

          {mensagem && (
            <div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-800">
              {mensagem}
            </div>
          )}

          <form
            key={clienteEmEdicao?.id ?? "novo"}
            onSubmit={salvarCliente}
            className="mb-7 space-y-6"
          >
            <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-6">
                <h3 className="text-lg font-bold">
                  {clienteEmEdicao
                    ? "Editar cliente"
                    : "Cadastrar cliente"}
                </h3>

                <p className="text-sm text-slate-500">
                  Informe os dados cadastrais da empresa.
                </p>
              </div>

              <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
                <label className={`${rotulo} xl:col-span-2`}>
                  Razão Social *
                  <input
                    type="text"
                    name="razaoSocial"
                    required
                    defaultValue={
                      clienteEmEdicao?.razao_social ?? ""
                    }
                    placeholder="Razão Social da empresa"
                    className={campo}
                  />
                </label>

                <label className={rotulo}>
                  Nome Fantasia
                  <input
                    type="text"
                    name="nomeFantasia"
                    defaultValue={
                      clienteEmEdicao?.nome_fantasia ?? ""
                    }
                    placeholder="Nome comercial"
                    className={campo}
                  />
                </label>

                <label className={rotulo}>
                  Loja / Unidade
                  <input
                    type="text"
                    name="unidade"
                    defaultValue={
                      clienteEmEdicao?.unidade ?? ""
                    }
                    placeholder="Ex.: Loja Campinas"
                    className={campo}
                  />
                </label>

                <label className={rotulo}>
                  CNPJ
                  <input
                    type="text"
                    name="cnpj"
                    defaultValue={clienteEmEdicao?.cnpj ?? ""}
                    placeholder="00.000.000/0000-00"
                    className={campo}
                  />
                </label>

                <label className={rotulo}>
                  Inscrição Estadual
                  <input
                    type="text"
                    name="inscricaoEstadual"
                    defaultValue={
                      clienteEmEdicao?.inscricao_estadual ?? ""
                    }
                    placeholder="Inscrição Estadual"
                    className={campo}
                  />
                </label>
              </div>
            </article>

            <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-6">
                <h3 className="text-lg font-bold">
                  Endereço
                </h3>

                <p className="text-sm text-slate-500">
                  Endereço da unidade onde será realizada a
                  coleta.
                </p>
              </div>

              <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
                <label className={rotulo}>
                  CEP
                  <input
                    type="text"
                    name="cep"
                    defaultValue={clienteEmEdicao?.cep ?? ""}
                    placeholder="00000-000"
                    className={campo}
                  />
                </label>

                <label className={`${rotulo} xl:col-span-2`}>
                  Endereço
                  <input
                    type="text"
                    name="endereco"
                    defaultValue={
                      clienteEmEdicao?.endereco ?? ""
                    }
                    placeholder="Rua, avenida ou rodovia"
                    className={campo}
                  />
                </label>

                <label className={rotulo}>
                  Número
                  <input
                    type="text"
                    name="numero"
                    defaultValue={
                      clienteEmEdicao?.numero ?? ""
                    }
                    placeholder="Número"
                    className={campo}
                  />
                </label>

                <label className={rotulo}>
                  Complemento
                  <input
                    type="text"
                    name="complemento"
                    defaultValue={
                      clienteEmEdicao?.complemento ?? ""
                    }
                    placeholder="Complemento"
                    className={campo}
                  />
                </label>

                <label className={rotulo}>
                  Bairro
                  <input
                    type="text"
                    name="bairro"
                    defaultValue={
                      clienteEmEdicao?.bairro ?? ""
                    }
                    placeholder="Bairro"
                    className={campo}
                  />
                </label>

                <label className={rotulo}>
                  Cidade *
                  <input
                    type="text"
                    name="cidade"
                    required
                    defaultValue={
                      clienteEmEdicao?.cidade ?? ""
                    }
                    placeholder="Cidade"
                    className={campo}
                  />
                </label>

                <label className={rotulo}>
                  Estado *
                  <select
                    name="estado"
                    required
                    defaultValue={
                      clienteEmEdicao?.estado ?? ""
                    }
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
              </div>
            </article>

            <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-6">
                <h3 className="text-lg font-bold">
                  Contato e operação
                </h3>

                <p className="text-sm text-slate-500">
                  Dados do responsável pela unidade.
                </p>
              </div>

              <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
                <label className={rotulo}>
                  Responsável
                  <input
                    type="text"
                    name="responsavel"
                    defaultValue={
                      clienteEmEdicao?.responsavel ?? ""
                    }
                    placeholder="Nome do responsável"
                    className={campo}
                  />
                </label>

                <label className={rotulo}>
                  Telefone
                  <input
                    type="text"
                    name="telefone"
                    defaultValue={
                      clienteEmEdicao?.telefone ?? ""
                    }
                    placeholder="(00) 0000-0000"
                    className={campo}
                  />
                </label>

                <label className={rotulo}>
                  Celular
                  <input
                    type="text"
                    name="celular"
                    defaultValue={
                      clienteEmEdicao?.celular ?? ""
                    }
                    placeholder="(00) 00000-0000"
                    className={campo}
                  />
                </label>

                <label className={rotulo}>
                  E-mail
                  <input
                    type="email"
                    name="email"
                    defaultValue={
                      clienteEmEdicao?.email ?? ""
                    }
                    placeholder="contato@cliente.com.br"
                    className={campo}
                  />
                </label>

                <label className={`${rotulo} xl:col-span-2`}>
                  Transportadora padrão
                  <input
                    type="text"
                    name="transportadoraPadrao"
                    defaultValue={
                      clienteEmEdicao?.transportadora_padrao ??
                      ""
                    }
                    placeholder="Transportadora utilizada normalmente"
                    className={campo}
                  />
                </label>
              </div>

              <label className={`${rotulo} mt-5 block`}>
                Observações
                <textarea
                  name="observacoes"
                  rows={4}
                  defaultValue={
                    clienteEmEdicao?.observacoes ?? ""
                  }
                  placeholder="Horários, orientações e informações adicionais..."
                  className={campo}
                />
              </label>
            </article>

            <div className="flex flex-col-reverse justify-end gap-3 sm:flex-row">
              {clienteEmEdicao && (
                <button
                  type="button"
                  onClick={cancelarEdicao}
                  className="rounded-xl border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Cancelar edição
                </button>
              )}

              <button
                type="submit"
                disabled={salvando}
                className="rounded-xl bg-emerald-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {salvando
                  ? "Salvando..."
                  : clienteEmEdicao
                    ? "Salvar alterações"
                    : "Cadastrar cliente"}
              </button>
            </div>
          </form>

          <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col justify-between gap-4 border-b border-slate-200 p-5 md:flex-row md:items-center">
              <div>
                <h3 className="text-lg font-bold">
                  Clientes cadastrados
                </h3>

                <p className="text-sm text-slate-500">
                  {clientesFiltrados.length} registro(s)
                  encontrado(s)
                </p>
              </div>

              <input
                type="search"
                value={pesquisa}
                onChange={(evento) =>
                  setPesquisa(evento.target.value)
                }
                placeholder="Pesquisar cliente, CNPJ ou cidade..."
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-emerald-600 md:w-96"
              />
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[1100px] text-left">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-5 py-4">
                      Cliente / Unidade
                    </th>
                    <th className="px-5 py-4">CNPJ</th>
                    <th className="px-5 py-4">
                      Cidade / Estado
                    </th>
                    <th className="px-5 py-4">Responsável</th>
                    <th className="px-5 py-4">Telefone</th>
                    <th className="px-5 py-4">E-mail</th>
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
                        Carregando clientes...
                      </td>
                    </tr>
                  )}

                  {!carregando &&
                    clientesFiltrados.length === 0 && (
                      <tr>
                        <td
                          colSpan={7}
                          className="px-5 py-8 text-center text-slate-500"
                        >
                          Nenhum cliente cadastrado.
                        </td>
                      </tr>
                    )}

                  {!carregando &&
                    clientesFiltrados.map((cliente) => (
                      <tr
                        key={cliente.id}
                        className="transition hover:bg-slate-50"
                      >
                        <td className="px-5 py-4">
                          <p className="font-semibold text-slate-900">
                            {cliente.nome_fantasia ||
                              cliente.razao_social}
                          </p>

                          <p className="text-xs text-slate-500">
                            {cliente.unidade ||
                              cliente.razao_social}
                          </p>
                        </td>

                        <td className="px-5 py-4">
                          {cliente.cnpj || "—"}
                        </td>

                        <td className="px-5 py-4">
                          {cliente.cidade}/{cliente.estado}
                        </td>

                        <td className="px-5 py-4">
                          {cliente.responsavel || "—"}
                        </td>

                        <td className="px-5 py-4">
                          {cliente.celular ||
                            cliente.telefone ||
                            "—"}
                        </td>

                        <td className="px-5 py-4">
                          {cliente.email || "—"}
                        </td>

                        <td className="px-5 py-4">
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                editarCliente(cliente)
                              }
                              className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-blue-700"
                            >
                              Editar
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                excluirCliente(
                                  cliente.id,
                                  cliente.nome_fantasia ||
                                    cliente.razao_social,
                                )
                              }
                              className="rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-red-700"
                            >
                              Excluir
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </article>
        </section>
      </div>
    </main>
  );
}