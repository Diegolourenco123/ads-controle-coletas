"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import BotaoSair from "./BotaoSair";
import { criarClienteSupabaseBrowser } from "../lib/supabase-browser";

type UsuarioLogado = {
  email: string;
  nome: string;
};

function obterNomeUsuario(
  email: string,
  nomeMetadata?: string,
) {
  if (nomeMetadata?.trim()) {
    return nomeMetadata.trim();
  }

  const parteEmail = email.split("@")[0] ?? "Usuário";

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

export default function Header() {
  const [usuario, setUsuario] =
    useState<UsuarioLogado | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    const supabase = criarClienteSupabaseBrowser();

    async function carregarUsuario() {
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();

      if (error) {
        console.error(
          "Não foi possível carregar o usuário:",
          error,
        );

        setCarregando(false);
        return;
      }

      if (!user?.email) {
        setUsuario(null);
        setCarregando(false);
        return;
      }

      const nomeMetadata =
        user.user_metadata?.nome ||
        user.user_metadata?.name ||
        user.user_metadata?.full_name;

      setUsuario({
        email: user.email,
        nome: obterNomeUsuario(
          user.email,
          nomeMetadata,
        ),
      });

      setCarregando(false);
    }

    carregarUsuario();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (_evento, sessao) => {
        const user = sessao?.user;

        if (!user?.email) {
          setUsuario(null);
          setCarregando(false);
          return;
        }

        const nomeMetadata =
          user.user_metadata?.nome ||
          user.user_metadata?.name ||
          user.user_metadata?.full_name;

        setUsuario({
          email: user.email,
          nome: obterNomeUsuario(
            user.email,
            nomeMetadata,
          ),
        });

        setCarregando(false);
      },
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-5 px-6 py-4">
        <div className="flex min-w-0 items-center gap-4">
          <div className="relative h-14 w-36 shrink-0">
            <Image
              src="/logo-ads.png"
              alt="ADS Logística Ambiental"
              fill
              priority
              sizes="144px"
              className="object-contain object-left"
            />
          </div>

          <div className="hidden min-w-0 sm:block">
            <h1 className="truncate text-xl font-bold text-slate-900">
              ADS Controle de Coletas
            </h1>

            <p className="text-sm text-slate-500">
              Sistema de Gestão Operacional
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-4">
          <div className="hidden text-right md:block">
            {carregando ? (
              <>
                <p className="text-sm font-semibold text-slate-500">
                  Carregando usuário...
                </p>

                <p className="text-xs text-slate-400">
                  Aguarde
                </p>
              </>
            ) : usuario ? (
              <>
                <div className="flex items-center justify-end gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />

                  <p className="text-sm font-semibold text-slate-900">
                    {usuario.nome}
                  </p>
                </div>

                <p className="mt-1 max-w-64 truncate text-xs text-slate-500">
                  {usuario.email}
                </p>

                <p className="mt-1 text-xs font-medium text-emerald-700">
                  Gestor Operacional • Online
                </p>
              </>
            ) : (
              <>
                <p className="text-sm font-semibold text-slate-900">
                  Usuário
                </p>

                <p className="text-xs text-slate-500">
                  Sessão não identificada
                </p>
              </>
            )}
          </div>

          <BotaoSair />
        </div>
      </div>
    </header>
  );
}