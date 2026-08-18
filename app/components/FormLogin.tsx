"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { criarClienteSupabaseBrowser } from "../lib/supabase-browser";

export default function FormLogin() {
  const router = useRouter();

  const [identificador, setIdentificador] = useState("");
  const [senha, setSenha] = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [entrando, setEntrando] = useState(false);
  const [erro, setErro] = useState("");

  async function resolverEmail(valor: string) {
    const identificadorLimpo = valor.trim().toLowerCase();

    // Se já digitou um e-mail, não precisamos consultar a API.
    if (identificadorLimpo.includes("@")) {
      return identificadorLimpo;
    }

    const resposta = await fetch("/api/login/usuario", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        usuario: identificadorLimpo,
      }),
    });

    const dados = await resposta.json();

    if (!resposta.ok) {
      throw new Error(
        dados.erro ?? "Usuário ou senha incorretos.",
      );
    }

    return String(dados.email ?? "")
      .trim()
      .toLowerCase();
  }

  async function entrar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();

    setEntrando(true);
    setErro("");

    try {
      const emailResolvido = await resolverEmail(identificador);

      if (!emailResolvido) {
        throw new Error("Usuário ou senha incorretos.");
      }

      const supabase = criarClienteSupabaseBrowser();

      const { error } = await supabase.auth.signInWithPassword({
        email: emailResolvido,
        password: senha,
      });

      if (error) {
        console.error("Erro no login:", error);

        throw new Error(
          error.message === "Invalid login credentials"
            ? "Usuário/e-mail ou senha incorretos."
            : `Não foi possível entrar: ${error.message}`,
        );
      }

      router.replace("/");
      router.refresh();
    } catch (error) {
      setErro(
        error instanceof Error
          ? error.message
          : "Não foi possível entrar no sistema.",
      );

      setEntrando(false);
    }
  }

  return (
    <form onSubmit={entrar} className="mt-8 space-y-5">
      {erro && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700"
        >
          {erro}
        </div>
      )}

      <label className="block text-sm font-semibold text-slate-700">
        Usuário ou e-mail
        <input
          type="text"
          value={identificador}
          onChange={(evento) => setIdentificador(evento.target.value)}
          required
          autoComplete="username"
          placeholder="diego ou seuemail@empresa.com.br"
          className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100"
        />
      </label>

      <label className="block text-sm font-semibold text-slate-700">
        Senha
        <div className="relative mt-2">
          <input
            type={mostrarSenha ? "text" : "password"}
            value={senha}
            onChange={(evento) => setSenha(evento.target.value)}
            required
            autoComplete="current-password"
            placeholder="Digite sua senha"
            className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3.5 pr-24 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100"
          />

          <button
            type="button"
            onClick={() => setMostrarSenha((valor) => !valor)}
            className="absolute inset-y-0 right-3 my-auto h-fit rounded-lg px-3 py-1.5 text-xs font-bold text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
          >
            {mostrarSenha ? "Ocultar" : "Mostrar"}
          </button>
        </div>
      </label>

      <button
        type="submit"
        disabled={entrando}
        className="w-full rounded-xl bg-emerald-600 px-5 py-3.5 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {entrando ? "Entrando..." : "Entrar no sistema"}
      </button>

      <p className="text-center text-xs leading-5 text-slate-500">
        Utilize seu usuário ou e-mail e a senha cadastrada no sistema.
      </p>
    </form>
  );
}