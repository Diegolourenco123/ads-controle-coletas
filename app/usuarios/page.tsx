"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Header from "../components/Header";
import Sidebar from "../components/Sidebar";
import { supabase } from "../lib/supabase";

type Perfil =
  | "administrador"
  | "gestor_operacional"
  | "operacional"
  | "financeiro"
  | "consulta";

type Usuario = {
  user_id: string;
  nome: string;
  usuario: string | null;
  email: string;
  perfil: Perfil;
  ativo: boolean;
  created_at: string;
  updated_at: string;
};

const PERFIS: { value: Perfil; label: string; descricao: string }[] = [
  {
    value: "administrador",
    label: "Administrador",
    descricao: "Acesso completo ao sistema e gestão de usuários.",
  },
  {
    value: "gestor_operacional",
    label: "Gestor Operacional",
    descricao: "Gerencia coletas e operação, sem administrar usuários.",
  },
  {
    value: "operacional",
    label: "Operacional",
    descricao: "Acesso às rotinas e atualizações operacionais.",
  },
  {
    value: "financeiro",
    label: "Financeiro",
    descricao: "Acesso aos controles de pagamentos e recebimentos.",
  },
  {
    value: "consulta",
    label: "Consulta",
    descricao: "Acesso somente para visualização.",
  },
];

function nomePerfil(perfil: Perfil) {
  return PERFIS.find((item) => item.value === perfil)?.label ?? perfil;
}

function classePerfil(perfil: Perfil) {
  if (perfil === "administrador") {
    return "border-violet-200 bg-violet-50 text-violet-700";
  }

  if (perfil === "gestor_operacional") {
    return "border-blue-200 bg-blue-50 text-blue-700";
  }

  if (perfil === "operacional") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (perfil === "financeiro") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  return "border-slate-200 bg-slate-50 text-slate-600";
}

function iniciais(nome: string) {
  return nome
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte[0]?.toUpperCase())
    .join("");
}

async function tokenAtual() {
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error || !session?.access_token) {
    throw new Error("Sua sessão expirou. Entre novamente no sistema.");
  }

  return session.access_token;
}

export default function UsuariosPage() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [mensagem, setMensagem] = useState("");

  const [modalNovo, setModalNovo] = useState(false);
  const [criando, setCriando] = useState(false);

  const [nome, setNome] = useState("");
  const [usuarioAcesso, setUsuarioAcesso] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [perfil, setPerfil] = useState<Perfil>("operacional");

  const [usuarioEditando, setUsuarioEditando] = useState<Usuario | null>(null);
  const [nomeEdicao, setNomeEdicao] = useState("");
  const [usuarioEdicao, setUsuarioEdicao] = useState("");
  const [emailEdicao, setEmailEdicao] = useState("");
  const [senhaEdicao, setSenhaEdicao] = useState("");
  const [perfilEdicao, setPerfilEdicao] = useState<Perfil>("consulta");
  const [salvandoEdicao, setSalvandoEdicao] = useState(false);

  const [processandoId, setProcessandoId] = useState<string | null>(null);
  const [pesquisa, setPesquisa] = useState("");

  async function carregarUsuarios() {
    setCarregando(true);
    setErro("");

    try {
      const token = await tokenAtual();

      const resposta = await fetch("/api/usuarios", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        cache: "no-store",
      });

      const dados = await resposta.json();

      if (!resposta.ok) {
        throw new Error(
          dados.erro ?? "Não foi possível carregar os usuários.",
        );
      }

      setUsuarios((dados.usuarios ?? []) as Usuario[]);
    } catch (error) {
      setErro(
        error instanceof Error
          ? error.message
          : "Não foi possível carregar os usuários.",
      );
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregarUsuarios();
  }, []);

  const indicadores = useMemo(() => {
    return {
      total: usuarios.length,
      ativos: usuarios.filter((usuario) => usuario.ativo).length,
      administradores: usuarios.filter(
        (usuario) => usuario.perfil === "administrador" && usuario.ativo,
      ).length,
      inativos: usuarios.filter((usuario) => !usuario.ativo).length,
    };
  }, [usuarios]);

  const usuariosFiltrados = useMemo(() => {
    const termo = pesquisa.trim().toLowerCase();

    if (!termo) return usuarios;

    return usuarios.filter((usuario) =>
      [
        usuario.nome,
        usuario.usuario ?? "",
        usuario.email,
        nomePerfil(usuario.perfil),
      ]
        .join(" ")
        .toLowerCase()
        .includes(termo),
    );
  }, [usuarios, pesquisa]);

  function limparFormularioNovo() {
    setNome("");
    setUsuarioAcesso("");
    setEmail("");
    setSenha("");
    setPerfil("operacional");
  }

  async function criarUsuario(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();

    setCriando(true);
    setErro("");
    setMensagem("");

    try {
      const token = await tokenAtual();

      const resposta = await fetch("/api/usuarios", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          nome,
          usuario: usuarioAcesso,
          email,
          senha,
          perfil,
        }),
      });

      const dados = await resposta.json();

      if (!resposta.ok) {
        throw new Error(
          dados.erro ?? "Não foi possível criar o usuário.",
        );
      }

      setMensagem("Usuário criado com sucesso.");
      setModalNovo(false);
      limparFormularioNovo();
      await carregarUsuarios();
    } catch (error) {
      setErro(
        error instanceof Error
          ? error.message
          : "Não foi possível criar o usuário.",
      );
    } finally {
      setCriando(false);
    }
  }

  function abrirEdicao(usuario: Usuario) {
    setUsuarioEditando(usuario);
    setNomeEdicao(usuario.nome);
    setUsuarioEdicao(usuario.usuario ?? "");
    setEmailEdicao(usuario.email);
    setSenhaEdicao("");
    setPerfilEdicao(usuario.perfil);
    setErro("");
    setMensagem("");
  }

  async function salvarEdicao(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();

    if (!usuarioEditando) return;

    setSalvandoEdicao(true);
    setErro("");
    setMensagem("");

    try {
      const token = await tokenAtual();

      const resposta = await fetch("/api/usuarios", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          user_id: usuarioEditando.user_id,
          nome: nomeEdicao,
          usuario: usuarioEdicao,
          email: emailEdicao,
          senha: senhaEdicao || undefined,
          perfil: perfilEdicao,
        }),
      });

      const dados = await resposta.json();

      if (!resposta.ok) {
        throw new Error(
          dados.erro ?? "Não foi possível atualizar o usuário.",
        );
      }

      setMensagem("Usuário atualizado com sucesso.");
      setUsuarioEditando(null);
      await carregarUsuarios();
    } catch (error) {
      setErro(
        error instanceof Error
          ? error.message
          : "Não foi possível atualizar o usuário.",
      );
    } finally {
      setSalvandoEdicao(false);
    }
  }

  async function alternarStatus(usuario: Usuario) {
    const novoStatus = !usuario.ativo;

    const confirmou = window.confirm(
      novoStatus
        ? `Deseja reativar o acesso de ${usuario.nome}?`
        : `Deseja desativar o acesso de ${usuario.nome}?`,
    );

    if (!confirmou) return;

    setProcessandoId(usuario.user_id);
    setErro("");
    setMensagem("");

    try {
      const token = await tokenAtual();

      const resposta = await fetch("/api/usuarios", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          user_id: usuario.user_id,
          ativo: novoStatus,
        }),
      });

      const dados = await resposta.json();

      if (!resposta.ok) {
        throw new Error(
          dados.erro ?? "Não foi possível alterar o status.",
        );
      }

      setMensagem(
        novoStatus
          ? "Usuário reativado com sucesso."
          : "Usuário desativado com sucesso.",
      );

      await carregarUsuarios();
    } catch (error) {
      setErro(
        error instanceof Error
          ? error.message
          : "Não foi possível alterar o status.",
      );
    } finally {
      setProcessandoId(null);
    }
  }

  async function excluirUsuario(usuario: Usuario) {
    const confirmou = window.confirm(
      `ATENÇÃO: deseja excluir permanentemente o usuário ${usuario.nome}?\n\nEssa ação removerá o acesso do usuário e não poderá ser desfeita.`,
    );

    if (!confirmou) return;

    setProcessandoId(usuario.user_id);
    setErro("");
    setMensagem("");

    try {
      const token = await tokenAtual();

      const resposta = await fetch("/api/usuarios", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          user_id: usuario.user_id,
        }),
      });

      const dados = await resposta.json();

      if (!resposta.ok) {
        throw new Error(
          dados.erro ?? "Não foi possível excluir o usuário.",
        );
      }

      setMensagem("Usuário excluído com sucesso.");
      await carregarUsuarios();
    } catch (error) {
      setErro(
        error instanceof Error
          ? error.message
          : "Não foi possível excluir o usuário.",
      );
    } finally {
      setProcessandoId(null);
    }
  }

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <Header />

      <div className="mx-auto grid max-w-[1500px] grid-cols-1 lg:grid-cols-[230px_1fr]">
        <Sidebar />

        <section className="min-w-0 p-5 md:p-8">
          <div className="mb-6 flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
            <div>
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-700">
                  Administração do sistema
                </p>
              </div>

              <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950">
                Usuários e Permissões
              </h2>

              <p className="mt-1.5 max-w-2xl text-sm text-slate-500">
                Gerencie acessos, perfis e usuários autorizados a utilizar o
                ADS Controle de Coletas.
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                setModalNovo(true);
                setErro("");
                setMensagem("");
              }}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-700"
            >
              <span className="text-lg leading-none">+</span>
              Novo usuário
            </button>
          </div>

          {mensagem && (
            <div className="mb-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-semibold text-emerald-800">
              {mensagem}
            </div>
          )}

          {erro && (
            <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-semibold text-red-700">
              {erro}
            </div>
          )}

          <section className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              ["Total de usuários", indicadores.total, "Cadastros no sistema", "bg-slate-500"],
              ["Usuários ativos", indicadores.ativos, "Com acesso liberado", "bg-emerald-500"],
              ["Administradores", indicadores.administradores, "Acesso completo", "bg-violet-500"],
              ["Usuários inativos", indicadores.inativos, "Acesso bloqueado", "bg-red-500"],
            ].map(([titulo, valor, detalhe, cor]) => (
              <article
                key={String(titulo)}
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${cor}`} />
                  <p className="text-xs font-semibold text-slate-500">
                    {titulo}
                  </p>
                </div>

                <p className="mt-2 text-2xl font-black text-slate-900">
                  {carregando ? "..." : String(valor).padStart(2, "0")}
                </p>

                <p className="mt-1 text-[11px] text-slate-400">
                  {detalhe}
                </p>
              </article>
            ))}
          </section>

          <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col justify-between gap-4 border-b border-slate-200 p-5 md:flex-row md:items-center">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Usuários cadastrados
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  Controle de perfis e status de acesso.
                </p>
              </div>

              <input
                type="search"
                value={pesquisa}
                onChange={(evento) => setPesquisa(evento.target.value)}
                placeholder="Pesquisar nome, usuário, e-mail ou perfil..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none transition focus:border-emerald-500 focus:bg-white md:w-80"
              />
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left">
                <thead className="border-b border-slate-200 bg-slate-50/70">
                  <tr className="text-[10px] uppercase tracking-wide text-slate-400">
                    <th className="px-5 py-3.5">Usuário</th>
                    <th className="px-5 py-3.5">Perfil</th>
                    <th className="px-5 py-3.5">Status</th>
                    <th className="px-5 py-3.5">Ações</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100 text-sm">
                  {carregando && (
                    <tr>
                      <td colSpan={4} className="px-5 py-12 text-center text-slate-500">
                        Carregando usuários...
                      </td>
                    </tr>
                  )}

                  {!carregando && usuariosFiltrados.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-5 py-12 text-center text-slate-500">
                        Nenhum usuário encontrado.
                      </td>
                    </tr>
                  )}

                  {!carregando &&
                    usuariosFiltrados.map((usuario) => (
                      <tr
                        key={usuario.user_id}
                        className="transition hover:bg-slate-50/70"
                      >
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-xs font-black text-white">
                              {iniciais(usuario.nome) || "US"}
                            </div>

                            <div className="min-w-0">
                              <p className="font-bold text-slate-900">
                                {usuario.nome}
                              </p>
                              {usuario.usuario && (
                                <p className="mt-0.5 text-xs font-semibold text-emerald-700">
                                  @{usuario.usuario}
                                </p>
                              )}
                              <p className="mt-0.5 text-xs text-slate-500">
                                {usuario.email}
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className="px-5 py-4">
                          <span
                            className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-bold ${classePerfil(
                              usuario.perfil,
                            )}`}
                          >
                            {nomePerfil(usuario.perfil)}
                          </span>
                        </td>

                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2">
                            <span
                              className={`h-2 w-2 rounded-full ${
                                usuario.ativo ? "bg-emerald-500" : "bg-red-500"
                              }`}
                            />
                            <span
                              className={`text-xs font-bold ${
                                usuario.ativo
                                  ? "text-emerald-700"
                                  : "text-red-700"
                              }`}
                            >
                              {usuario.ativo ? "Ativo" : "Inativo"}
                            </span>
                          </div>
                        </td>

                        <td className="px-5 py-4">
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => abrirEdicao(usuario)}
                              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-50"
                            >
                              Editar
                            </button>

                            <button
                              type="button"
                              onClick={() => alternarStatus(usuario)}
                              disabled={processandoId === usuario.user_id}
                              className={[
                                "rounded-lg border px-3 py-2 text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-50",
                                usuario.ativo
                                  ? "border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
                                  : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100",
                              ].join(" ")}
                            >
                              {processandoId === usuario.user_id
                                ? "Processando..."
                                : usuario.ativo
                                  ? "Desativar"
                                  : "Reativar"}
                            </button>

                            <button
                              type="button"
                              onClick={() => excluirUsuario(usuario)}
                              disabled={processandoId === usuario.user_id}
                              className="rounded-lg border border-red-300 bg-white px-3 py-2 text-xs font-bold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {processandoId === usuario.user_id
                                ? "Processando..."
                                : "Excluir"}
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

      {modalNovo && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <form
            onSubmit={criarUsuario}
            className="w-full max-w-2xl overflow-hidden rounded-3xl bg-white shadow-2xl"
          >
            <div className="flex items-start justify-between border-b border-slate-200 p-6">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-700">
                  Administração
                </p>
                <h3 className="mt-1 text-xl font-black text-slate-950">
                  Novo usuário
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  Crie um novo acesso e defina o nível de permissão.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setModalNovo(false);
                  limparFormularioNovo();
                }}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-lg font-bold text-slate-500 transition hover:bg-slate-200"
              >
                ×
              </button>
            </div>

            <div className="grid gap-4 p-6 md:grid-cols-2">
              <label className="text-sm font-semibold text-slate-700 md:col-span-2">
                Nome completo
                <input
                  type="text"
                  required
                  value={nome}
                  onChange={(evento) => setNome(evento.target.value)}
                  placeholder="Nome do usuário"
                  className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                />
              </label>

              <label className="text-sm font-semibold text-slate-700">
                Usuário de acesso
                <input
                  type="text"
                  required
                  value={usuarioAcesso}
                  onChange={(evento) =>
                    setUsuarioAcesso(
                      evento.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, ""),
                    )
                  }
                  placeholder="Ex.: diego"
                  autoComplete="username"
                  className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                />
                <span className="mt-1 block text-xs font-normal text-slate-400">
                  Use letras, números, ponto, hífen ou sublinhado.
                </span>
              </label>

              <label className="text-sm font-semibold text-slate-700">
                E-mail
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(evento) => setEmail(evento.target.value)}
                  placeholder="usuario@empresa.com.br"
                  className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                />
              </label>

              <label className="text-sm font-semibold text-slate-700">
                Senha inicial
                <input
                  type="password"
                  minLength={6}
                  required
                  value={senha}
                  onChange={(evento) => setSenha(evento.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                />
              </label>

              <label className="text-sm font-semibold text-slate-700 md:col-span-2">
                Perfil de acesso
                <select
                  value={perfil}
                  onChange={(evento) => setPerfil(evento.target.value as Perfil)}
                  className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                >
                  {PERFIS.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>

                <p className="mt-2 text-xs font-normal leading-5 text-slate-500">
                  {PERFIS.find((item) => item.value === perfil)?.descricao}
                </p>
              </label>
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
              <button
                type="button"
                onClick={() => {
                  setModalNovo(false);
                  limparFormularioNovo();
                }}
                className="rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-100"
              >
                Cancelar
              </button>

              <button
                type="submit"
                disabled={criando}
                className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {criando ? "Criando usuário..." : "Criar usuário"}
              </button>
            </div>
          </form>
        </div>
      )}

      {usuarioEditando && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <form
            onSubmit={salvarEdicao}
            className="w-full max-w-xl overflow-hidden rounded-3xl bg-white shadow-2xl"
          >
            <div className="flex items-start justify-between border-b border-slate-200 p-6">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-blue-700">
                  Permissões
                </p>
                <h3 className="mt-1 text-xl font-black text-slate-950">
                  Editar usuário
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  {usuarioEditando.email}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setUsuarioEditando(null)}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-lg font-bold text-slate-500 transition hover:bg-slate-200"
              >
                ×
              </button>
            </div>

            <div className="grid gap-4 p-6 md:grid-cols-2">
              <label className="block text-sm font-semibold text-slate-700 md:col-span-2">
                Nome
                <input
                  type="text"
                  required
                  value={nomeEdicao}
                  onChange={(evento) => setNomeEdicao(evento.target.value)}
                  className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                />
              </label>

              <label className="block text-sm font-semibold text-slate-700">
                Usuário de acesso
                <input
                  type="text"
                  required
                  value={usuarioEdicao}
                  onChange={(evento) =>
                    setUsuarioEdicao(
                      evento.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, ""),
                    )
                  }
                  placeholder="Ex.: diego"
                  autoComplete="username"
                  className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                />
              </label>

              <label className="block text-sm font-semibold text-slate-700">
                E-mail
                <input
                  type="email"
                  required
                  value={emailEdicao}
                  onChange={(evento) => setEmailEdicao(evento.target.value)}
                  className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                />
              </label>

              <label className="block text-sm font-semibold text-slate-700">
                Nova senha
                <input
                  type="password"
                  minLength={6}
                  value={senhaEdicao}
                  onChange={(evento) => setSenhaEdicao(evento.target.value)}
                  placeholder="Deixe em branco para manter"
                  className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                />
                <span className="mt-1 block text-xs font-normal text-slate-400">
                  Preencha somente se quiser alterar a senha.
                </span>
              </label>

              <label className="block text-sm font-semibold text-slate-700 md:col-span-2">
                Perfil de acesso
                <select
                  value={perfilEdicao}
                  onChange={(evento) =>
                    setPerfilEdicao(evento.target.value as Perfil)
                  }
                  className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                >
                  {PERFIS.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>

                <p className="mt-2 text-xs font-normal leading-5 text-slate-500">
                  {
                    PERFIS.find((item) => item.value === perfilEdicao)
                      ?.descricao
                  }
                </p>
              </label>
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
              <button
                type="button"
                onClick={() => setUsuarioEditando(null)}
                className="rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-100"
              >
                Cancelar
              </button>

              <button
                type="submit"
                disabled={salvandoEdicao}
                className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {salvandoEdicao ? "Salvando..." : "Salvar alterações"}
              </button>
            </div>
          </form>
        </div>
      )}
    </main>
  );
}