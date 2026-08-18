"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Header from "../components/Header";
import Sidebar from "../components/Sidebar";
import { supabase } from "../lib/supabase";

type PerfilUsuario =
  | "administrador"
  | "gestor_operacional"
  | "operacional"
  | "financeiro"
  | "consulta";

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
  const [perfil, setPerfil] = useState<PerfilUsuario | null>(null);
  const [carregandoPerfil, setCarregandoPerfil] = useState(true);

  const podeCadastrarOuEditar =
    perfil === "administrador" ||
    perfil === "gestor_operacional" ||
    perfil === "operacional";

  const podeExcluir =
    perfil === "administrador" ||
    perfil === "gestor_operacional";

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

  async function carregarPerfil() {
    try {
      const {
        data: { user },
        error: erroUsuario,
      } = await supabase.auth.getUser();

      if (erroUsuario || !user) {
        setPerfil("consulta");
        setCarregandoPerfil(false);
        return;
      }

      const { data, error } = await supabase
        .from("usuarios_perfis")
        .select("perfil, ativo")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) {
        console.error("Erro ao carregar perfil do usuário:", error);
        setPerfil("consulta");
        setCarregandoPerfil(false);
        return;
      }

      const perfisValidos: PerfilUsuario[] = [
        "administrador",
        "gestor_operacional",
        "operacional",
        "financeiro",
        "consulta",
      ];

      if (
        !data ||
        data.ativo === false ||
        !perfisValidos.includes(data.perfil as PerfilUsuario)
      ) {
        setPerfil("consulta");
        setCarregandoPerfil(false);
        return;
      }

      setPerfil(data.perfil as PerfilUsuario);
      setCarregandoPerfil(false);
    } catch (erro) {
      console.error("Erro inesperado ao carregar perfil:", erro);
      setPerfil("consulta");
      setCarregandoPerfil(false);
    }
  }

  useEffect(() => {
    carregarClientes();
    carregarPerfil();
  }, []);

  async function salvarCliente(
    evento: FormEvent<HTMLFormElement>,
  ) {
    evento.preventDefault();

    if (!podeCadastrarOuEditar) {
      setMensagem(
        "Seu perfil possui acesso somente para consulta aos clientes.",
      );
      return;
    }

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
    if (!podeCadastrarOuEditar) {
      setMensagem(
        "Seu perfil possui acesso somente para consulta aos clientes.",
      );
      return;
    }

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
    if (!podeExcluir) {
      setMensagem(
        "Seu perfil não possui permissão para excluir clientes.",
      );
      return;
    }

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


  const [paginaAtual, setPaginaAtual] = useState(1);
  const [itensPorPagina, setItensPorPagina] = useState(10);
  const [clienteVisualizando, setClienteVisualizando] =
    useState<Cliente | null>(null);

  useEffect(() => {
    setPaginaAtual(1);
  }, [pesquisa, itensPorPagina]);

  const totalPaginas = Math.max(
    1,
    Math.ceil(clientesFiltrados.length / itensPorPagina),
  );

  const paginaSegura = Math.min(paginaAtual, totalPaginas);
  const indiceInicial = (paginaSegura - 1) * itensPorPagina;
  const indiceFinal = Math.min(
    indiceInicial + itensPorPagina,
    clientesFiltrados.length,
  );

  const clientesPaginados = clientesFiltrados.slice(
    indiceInicial,
    indiceFinal,
  );

  const comContatoCompleto = clientes.filter(
    (cliente) =>
      Boolean(cliente.responsavel?.trim()) &&
      Boolean((cliente.celular || cliente.telefone)?.trim()) &&
      Boolean(cliente.email?.trim()),
  ).length;

  const comTransportadoraPadrao = clientes.filter((cliente) =>
    Boolean(cliente.transportadora_padrao?.trim()),
  ).length;

  const estadosAtendidos = new Set(
    clientes.map((cliente) => cliente.estado).filter(Boolean),
  ).size;

  function nomeExibicao(cliente: Cliente) {
    return cliente.nome_fantasia || cliente.razao_social;
  }

  function enderecoCompleto(cliente: Cliente) {
    return [
      cliente.endereco,
      cliente.numero,
      cliente.complemento,
      cliente.bairro,
    ]
      .filter(Boolean)
      .join(", ");
  }

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <Header />

      <div className="mx-auto grid max-w-[1500px] grid-cols-1 lg:grid-cols-[230px_1fr]">
        <Sidebar />

        <section className="min-w-0 p-5 md:p-8">
          <div className="mb-5">
            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.22em] text-emerald-700">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              Cadastros operacionais
            </p>

            <h2 className="mt-2 text-3xl font-bold tracking-tight">
              Clientes
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Cadastre, consulte e atualize clientes e unidades atendidas pela ADS.
            </p>
          </div>

          {mensagem && (
            <div className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
              {mensagem}
            </div>
          )}

          <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold text-slate-500">Total cadastrados</p>
              <p className="mt-1 text-2xl font-bold">{clientes.length}</p>
              <p className="mt-1 text-xs text-slate-400">Clientes / unidades</p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold text-slate-500">Com contato completo</p>
              <p className="mt-1 text-2xl font-bold">{comContatoCompleto}</p>
              <p className="mt-1 text-xs text-slate-400">Responsável, telefone e e-mail</p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold text-slate-500">Transportadora padrão</p>
              <p className="mt-1 text-2xl font-bold">{comTransportadoraPadrao}</p>
              <p className="mt-1 text-xs text-slate-400">Cadastros com preferência</p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold text-slate-500">Estados atendidos</p>
              <p className="mt-1 text-2xl font-bold">{estadosAtendidos}</p>
              <p className="mt-1 text-xs text-slate-400">UFs na base de clientes</p>
            </div>
          </div>

          {!carregandoPerfil && !podeCadastrarOuEditar && (
            <div className="mb-6 rounded-2xl border border-blue-200 bg-blue-50 px-5 py-4">
              <p className="text-sm font-bold text-blue-800">
                Acesso somente para consulta
              </p>
              <p className="mt-1 text-sm text-blue-700">
                Você pode pesquisar e visualizar os clientes cadastrados, mas não pode cadastrar, editar ou excluir registros.
              </p>
            </div>
          )}

          {podeCadastrarOuEditar && (
          <form
            key={clienteEmEdicao?.id ?? "novo"}
            onSubmit={salvarCliente}
            className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-700">
                  {clienteEmEdicao ? "Modo de edição" : "Cadastro"}
                </p>
                <h3 className="mt-1 text-lg font-bold">
                  {clienteEmEdicao ? "Editar cliente" : "Cadastrar cliente"}
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  {clienteEmEdicao
                    ? `Alterando os dados de ${nomeExibicao(clienteEmEdicao)}.`
                    : "Preencha os dados cadastrais e operacionais do cliente."}
                </p>
              </div>

              {clienteEmEdicao && (
                <span className="w-fit rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
                  Editando registro #{clienteEmEdicao.id}
                </span>
              )}
            </div>

            <div className="grid gap-x-4 gap-y-4 md:grid-cols-2 xl:grid-cols-4">
              <label className={`${rotulo} xl:col-span-2`}>
                Razão Social *
                <input type="text" name="razaoSocial" required defaultValue={clienteEmEdicao?.razao_social ?? ""} placeholder="Razão Social da empresa" className={campo} />
              </label>

              <label className={rotulo}>
                Nome Fantasia
                <input type="text" name="nomeFantasia" defaultValue={clienteEmEdicao?.nome_fantasia ?? ""} placeholder="Nome comercial" className={campo} />
              </label>

              <label className={rotulo}>
                Loja / Unidade
                <input type="text" name="unidade" defaultValue={clienteEmEdicao?.unidade ?? ""} placeholder="Ex.: Loja Campinas" className={campo} />
              </label>

              <label className={rotulo}>
                CNPJ
                <input type="text" name="cnpj" defaultValue={clienteEmEdicao?.cnpj ?? ""} placeholder="00.000.000/0000-00" className={campo} />
              </label>

              <label className={rotulo}>
                Inscrição Estadual
                <input type="text" name="inscricaoEstadual" defaultValue={clienteEmEdicao?.inscricao_estadual ?? ""} placeholder="Inscrição Estadual" className={campo} />
              </label>

              <div className="md:col-span-2 xl:col-span-4 mt-1 border-t border-slate-100 pt-4">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Endereço da unidade</p>
              </div>

              <label className={rotulo}>
                CEP
                <input type="text" name="cep" defaultValue={clienteEmEdicao?.cep ?? ""} placeholder="00000-000" className={campo} />
              </label>

              <label className={`${rotulo} xl:col-span-2`}>
                Endereço
                <input type="text" name="endereco" defaultValue={clienteEmEdicao?.endereco ?? ""} placeholder="Rua, avenida ou rodovia" className={campo} />
              </label>

              <label className={rotulo}>
                Número
                <input type="text" name="numero" defaultValue={clienteEmEdicao?.numero ?? ""} placeholder="Número" className={campo} />
              </label>

              <label className={rotulo}>
                Complemento
                <input type="text" name="complemento" defaultValue={clienteEmEdicao?.complemento ?? ""} placeholder="Complemento" className={campo} />
              </label>

              <label className={rotulo}>
                Bairro
                <input type="text" name="bairro" defaultValue={clienteEmEdicao?.bairro ?? ""} placeholder="Bairro" className={campo} />
              </label>

              <label className={rotulo}>
                Cidade *
                <input type="text" name="cidade" required defaultValue={clienteEmEdicao?.cidade ?? ""} placeholder="Cidade" className={campo} />
              </label>

              <label className={rotulo}>
                Estado *
                <select name="estado" required defaultValue={clienteEmEdicao?.estado ?? ""} className={campo}>
                  <option value="" disabled>Selecione</option>
                  {estados.map((estado) => (
                    <option key={estado} value={estado}>{estado}</option>
                  ))}
                </select>
              </label>

              <div className="md:col-span-2 xl:col-span-4 mt-1 border-t border-slate-100 pt-4">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Contato e operação</p>
              </div>

              <label className={rotulo}>
                Responsável
                <input type="text" name="responsavel" defaultValue={clienteEmEdicao?.responsavel ?? ""} placeholder="Nome do responsável" className={campo} />
              </label>

              <label className={rotulo}>
                Telefone
                <input type="text" name="telefone" defaultValue={clienteEmEdicao?.telefone ?? ""} placeholder="(00) 0000-0000" className={campo} />
              </label>

              <label className={rotulo}>
                Celular
                <input type="text" name="celular" defaultValue={clienteEmEdicao?.celular ?? ""} placeholder="(00) 00000-0000" className={campo} />
              </label>

              <label className={rotulo}>
                E-mail
                <input type="email" name="email" defaultValue={clienteEmEdicao?.email ?? ""} placeholder="contato@cliente.com.br" className={campo} />
              </label>

              <label className={`${rotulo} xl:col-span-2`}>
                Transportadora padrão
                <input type="text" name="transportadoraPadrao" defaultValue={clienteEmEdicao?.transportadora_padrao ?? ""} placeholder="Transportadora utilizada normalmente" className={campo} />
              </label>

              <label className={`${rotulo} md:col-span-2`}>
                Observações
                <textarea name="observacoes" rows={2} defaultValue={clienteEmEdicao?.observacoes ?? ""} placeholder="Horários, orientações e informações adicionais..." className={campo} />
              </label>
            </div>

            <div className="mt-5 flex flex-col-reverse justify-end gap-3 border-t border-slate-100 pt-4 sm:flex-row">
              {clienteEmEdicao && (
                <button type="button" onClick={cancelarEdicao} className="rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
                  Cancelar edição
                </button>
              )}

              <button type="submit" disabled={salvando} className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60">
                {salvando ? "Salvando..." : clienteEmEdicao ? "Salvar alterações" : "Cadastrar cliente"}
              </button>
            </div>
          </form>
          )}

          <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col justify-between gap-4 border-b border-slate-200 p-5 md:flex-row md:items-center">
              <div>
                <h3 className="text-lg font-bold">Clientes cadastrados</h3>
                <p className="text-sm text-slate-500">
                  {clientesFiltrados.length} registro(s) encontrado(s)
                </p>
              </div>

              <input
                type="search"
                value={pesquisa}
                onChange={(evento) => setPesquisa(evento.target.value)}
                placeholder="Pesquisar cliente, unidade, CNPJ ou cidade..."
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-emerald-600 md:w-96"
              />
            </div>

            <div className="overflow-x-auto">
              <table className="w-full table-fixed text-left text-sm" style={{ minWidth: "1120px" }}>
                <colgroup>
                  <col style={{ width: "23%" }} />
                  <col style={{ width: "14%" }} />
                  <col style={{ width: "15%" }} />
                  <col style={{ width: "15%" }} />
                  <col style={{ width: "12%" }} />
                  <col style={{ width: "21%" }} />
                </colgroup>

                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-5 py-4">Cliente / Unidade</th>
                    <th className="px-5 py-4">CNPJ</th>
                    <th className="px-5 py-4">Cidade / UF</th>
                    <th className="px-5 py-4">Responsável</th>
                    <th className="px-5 py-4">Telefone</th>
                    <th className="px-5 py-4">Ações</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {carregando && (
                    <tr>
                      <td colSpan={6} className="px-5 py-8 text-center text-slate-500">
                        Carregando clientes...
                      </td>
                    </tr>
                  )}

                  {!carregando && clientesPaginados.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-5 py-8 text-center text-slate-500">
                        Nenhum cliente cadastrado.
                      </td>
                    </tr>
                  )}

                  {!carregando &&
                    clientesPaginados.map((cliente) => (
                      <tr key={cliente.id} className="transition hover:bg-slate-50">
                        <td className="px-5 py-4 align-middle">
                          <p className="font-semibold text-slate-900">
                            {nomeExibicao(cliente)}
                          </p>
                          <p className="mt-1 truncate text-xs text-slate-500">
                            {cliente.unidade || cliente.razao_social}
                          </p>
                        </td>

                        <td className="px-5 py-4 align-middle break-words">
                          {cliente.cnpj || "—"}
                        </td>

                        <td className="px-5 py-4 align-middle">
                          {cliente.cidade}/{cliente.estado}
                        </td>

                        <td className="px-5 py-4 align-middle break-words">
                          {cliente.responsavel || "—"}
                        </td>

                        <td className="px-5 py-4 align-middle">
                          {cliente.celular || cliente.telefone || "—"}
                        </td>

                        <td className="px-5 py-4 align-middle">
                          <div className="flex flex-nowrap items-center gap-2">
                            <button type="button" onClick={() => setClienteVisualizando(cliente)} className="whitespace-nowrap rounded-lg bg-slate-700 px-3 py-2 text-xs font-semibold text-white transition hover:bg-slate-800">
                              Visualizar
                            </button>
                            {podeCadastrarOuEditar && (
                              <button type="button" onClick={() => editarCliente(cliente)} className="whitespace-nowrap rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-700">
                                Editar
                              </button>
                            )}
                            {podeExcluir && (
                              <button type="button" onClick={() => excluirCliente(cliente.id, nomeExibicao(cliente))} className="whitespace-nowrap rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-red-700">
                                Excluir
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>

            {!carregando && clientesFiltrados.length > 0 && (
              <div className="flex flex-col gap-4 border-t border-slate-200 px-5 py-4 md:flex-row md:items-center md:justify-between">
                <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
                  <span>
                    Mostrando <strong>{indiceInicial + 1}</strong> a{" "}
                    <strong>{indiceFinal}</strong> de{" "}
                    <strong>{clientesFiltrados.length}</strong>
                  </span>

                  <select
                    value={itensPorPagina}
                    onChange={(evento) => setItensPorPagina(Number(evento.target.value))}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 outline-none"
                  >
                    <option value={10}>10 por página</option>
                    <option value={20}>20 por página</option>
                    <option value={30}>30 por página</option>
                  </select>
                </div>

                <div className="flex items-center gap-3">
                  <button type="button" disabled={paginaSegura === 1} onClick={() => setPaginaAtual((pagina) => Math.max(1, pagina - 1))} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">
                    Anterior
                  </button>

                  <span className="min-w-16 text-center text-sm font-semibold text-slate-700">
                    {paginaSegura} de {totalPaginas}
                  </span>

                  <button type="button" disabled={paginaSegura === totalPaginas} onClick={() => setPaginaAtual((pagina) => Math.min(totalPaginas, pagina + 1))} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">
                    Próxima
                  </button>
                </div>
              </div>
            )}
          </article>
        </section>
      </div>

      {clienteVisualizando && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-200 p-5">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">
                  Cadastro do cliente
                </p>
                <h3 className="mt-1 text-xl font-bold">
                  {nomeExibicao(clienteVisualizando)}
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  {clienteVisualizando.unidade || "Unidade não informada"}
                </p>
              </div>

              <button type="button" onClick={() => setClienteVisualizando(null)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">
                Fechar
              </button>
            </div>

            <div className="grid gap-4 p-5 sm:grid-cols-2">
              {[
                ["Razão Social", clienteVisualizando.razao_social],
                ["Nome Fantasia", clienteVisualizando.nome_fantasia],
                ["CNPJ", clienteVisualizando.cnpj],
                ["Inscrição Estadual", clienteVisualizando.inscricao_estadual],
                ["Loja / Unidade", clienteVisualizando.unidade],
                ["CEP", clienteVisualizando.cep],
                ["Endereço", enderecoCompleto(clienteVisualizando)],
                ["Cidade / UF", `${clienteVisualizando.cidade}/${clienteVisualizando.estado}`],
                ["Responsável", clienteVisualizando.responsavel],
                ["Telefone", clienteVisualizando.telefone],
                ["Celular", clienteVisualizando.celular],
                ["E-mail", clienteVisualizando.email],
                ["Transportadora padrão", clienteVisualizando.transportadora_padrao],
              ].map(([titulo, valor]) => (
                <div key={titulo} className="rounded-xl bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{titulo}</p>
                  <p className="mt-1 break-words text-sm font-medium text-slate-800">{valor || "—"}</p>
                </div>
              ))}

              <div className="rounded-xl bg-slate-50 p-4 sm:col-span-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Observações
                </p>
                <p className="mt-1 whitespace-pre-wrap text-sm font-medium text-slate-800">
                  {clienteVisualizando.observacoes || "—"}
                </p>
              </div>
            </div>

            {podeCadastrarOuEditar && (
              <div className="flex justify-end gap-3 border-t border-slate-200 p-5">
                <button
                  type="button"
                  onClick={() => {
                    const cliente = clienteVisualizando;
                    setClienteVisualizando(null);
                    editarCliente(cliente);
                  }}
                  className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700"
                >
                  Editar cliente
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}