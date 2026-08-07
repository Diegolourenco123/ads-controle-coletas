"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { criarClienteSupabaseBrowser } from "../lib/supabase-browser";

export default function FormLogin() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [entrando, setEntrando] = useState(false);
  const [erro, setErro] = useState("");

  async function entrar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();

    setEntrando(true);
    setErro("");

    const supabase = criarClienteSupabaseBrowser();

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: senha,
    });

    if (error) {
      console.error("Erro no login:", error);

      setErro(
        error.message === "Invalid login credentials"
          ? "E-mail ou senha incorretos."
          : `Não foi possível entrar: ${error.message}`,
      );

      setEntrando(false);
      return;
    }

    router.replace("/");
    router.refresh();
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
        E-mail
        <input
          type="email"
          value={email}
          onChange={(evento) => setEmail(evento.target.value)}
          required
          autoComplete="email"
          placeholder="seuemail@empresa.com.br"
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
        Utilize o e-mail e a senha cadastrados no Supabase
        Authentication.
      </p>
    </form>
  );
}
