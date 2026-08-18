"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import BotaoSair from "./BotaoSair";
import { criarClienteSupabaseBrowser } from "../lib/supabase-browser";

type PerfilUsuario =
  | "administrador"
  | "gestor_operacional"
  | "operacional"
  | "financeiro"
  | "consulta";

type UsuarioLogado = {
  email: string;
  nome: string;
  perfil: PerfilUsuario;
};

function obterNomeUsuario(
  email: string,
  nomeMetadata?: string,
) {
  if (nomeMetadata?.trim()) {
    return nomeMetadata.trim();
  }

  const parteEmail =
    email.split("@")[0] ?? "Usuário";

  return parteEmail
    .replace(/[._-]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map(
      (palavra) =>
        palavra.charAt(0).toUpperCase() +
        palavra.slice(1).toLowerCase(),
    )
    .join(" ");
}

function obterIniciais(nome: string) {
  return nome
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte.charAt(0))
    .join("")
    .toUpperCase();
}

function obterNomePerfil(
  perfil: PerfilUsuario,
) {
  switch (perfil) {
    case "administrador":
      return "Administrador";

    case "gestor_operacional":
      return "Gestor Operacional";

    case "operacional":
      return "Operacional";

    case "financeiro":
      return "Financeiro";

    case "consulta":
      return "Consulta";

    default:
      return "Consulta";
  }
}

export default function Header() {
  const [usuario, setUsuario] =
    useState<UsuarioLogado | null>(null);

  const [carregando, setCarregando] =
    useState(true);

  useEffect(() => {
    const supabase =
      criarClienteSupabaseBrowser();

    async function montarUsuario(
      user: any,
    ) {
      if (!user?.email) {
        setUsuario(null);
        setCarregando(false);
        return;
      }

      const nomeMetadata =
        user.user_metadata?.nome ||
        user.user_metadata?.name ||
        user.user_metadata?.full_name;

      const {
        data: perfilUsuario,
        error: erroPerfil,
      } = await supabase
        .from("usuarios_perfis")
        .select("perfil, ativo")
        .eq("user_id", user.id)
        .maybeSingle();

      if (erroPerfil) {
        console.error(
          "Não foi possível carregar o perfil:",
          erroPerfil,
        );
      }

      let perfil: PerfilUsuario =
        "consulta";

      if (
        perfilUsuario?.perfil &&
        perfilUsuario.ativo !== false
      ) {
        const perfilBanco =
          perfilUsuario.perfil as PerfilUsuario;

        const perfisValidos: PerfilUsuario[] = [
          "administrador",
          "gestor_operacional",
          "operacional",
          "financeiro",
          "consulta",
        ];

        if (
          perfisValidos.includes(perfilBanco)
        ) {
          perfil = perfilBanco;
        }
      }

      setUsuario({
        email: user.email,
        nome: obterNomeUsuario(
          user.email,
          nomeMetadata,
        ),
        perfil,
      });

      setCarregando(false);
    }

    async function carregarUsuario() {
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();

      if (error) {
        if (
          error.name ===
          "AuthSessionMissingError"
        ) {
          setUsuario(null);
          setCarregando(false);
          return;
        }

        console.error(
          "Não foi possível carregar o usuário:",
          error,
        );

        setUsuario(null);
        setCarregando(false);
        return;
      }

      await montarUsuario(user);
    }

    carregarUsuario();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      async (_evento, sessao) => {
        await montarUsuario(
          sessao?.user,
        );
      },
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex h-[82px] max-w-[1600px] items-center justify-between px-6">

        {/* MARCA */}
        <div className="flex min-w-0 items-center gap-5">
          <div className="flex shrink-0 items-center">
            <Image
              src="/logo-ads.png"
              alt="ADS Logística Ambiental"
              width={132}
              height={53}
              priority
              className="h-auto w-[132px] object-contain"
            />
          </div>

          <div className="hidden h-10 w-px bg-slate-200 sm:block" />

          <div className="hidden min-w-0 sm:block">
            <h1 className="truncate text-[19px] font-bold tracking-tight text-slate-900">
              ADS Controle de Coletas
            </h1>

            <p className="mt-0.5 text-xs font-medium text-slate-500">
              Sistema de Gestão Operacional
            </p>
          </div>
        </div>

        {/* USUÁRIO */}
        <div className="flex shrink-0 items-center gap-3">

          {carregando ? (
            <div className="hidden rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-right md:block">
              <p className="text-xs font-semibold text-slate-500">
                Carregando usuário...
              </p>

              <p className="mt-0.5 text-[11px] text-slate-400">
                Aguarde
              </p>
            </div>
          ) : usuario ? (
            <div className="hidden items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 px-3 py-2 md:flex">

              <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-xs font-black text-white">
                {obterIniciais(usuario.nome)}

                <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-500" />
              </div>

              <div className="min-w-0 pr-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-bold text-slate-900">
                    {usuario.nome}
                  </p>
                </div>

                <p className="max-w-56 truncate text-[11px] text-slate-500">
                  {usuario.email}
                </p>

                <p className="mt-0.5 text-[10px] font-semibold text-emerald-700">
                  {obterNomePerfil(
                    usuario.perfil,
                  )}{" "}
                  • Online
                </p>
              </div>
            </div>
          ) : (
            <div className="hidden rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-right md:block">
              <p className="text-sm font-semibold text-slate-900">
                Usuário
              </p>

              <p className="text-xs text-slate-500">
                Sessão não identificada
              </p>
            </div>
          )}

          <BotaoSair />
        </div>
      </div>
    </header>
  );
}