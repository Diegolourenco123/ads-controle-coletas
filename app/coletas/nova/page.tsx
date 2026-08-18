"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import FormNovaColeta from "../../components/FormNovaColeta";
import Header from "../../components/Header";
import Sidebar from "../../components/Sidebar";
import { criarClienteSupabaseBrowser } from "../../lib/supabase-browser";

type PerfilUsuario =
  | "administrador"
  | "gestor_operacional"
  | "operacional"
  | "financeiro"
  | "consulta";

const perfisPermitidos: PerfilUsuario[] = [
  "administrador",
  "gestor_operacional",
  "operacional",
];

export default function NovaColetaPage() {
  const router = useRouter();

  const [carregando, setCarregando] = useState(true);
  const [autorizado, setAutorizado] = useState(false);

  useEffect(() => {
    let componenteAtivo = true;

    async function verificarPermissao() {
      try {
        const supabase = criarClienteSupabaseBrowser();

        const {
          data: { user },
          error: erroUsuario,
        } = await supabase.auth.getUser();

        if (erroUsuario || !user) {
          router.replace("/login");
          return;
        }

        const { data: perfilUsuario, error: erroPerfil } = await supabase
          .from("usuarios_perfis")
          .select("perfil, ativo")
          .eq("user_id", user.id)
          .maybeSingle();

        if (erroPerfil) {
          console.error(
            "Erro ao verificar permissão do usuário:",
            erroPerfil,
          );

          router.replace("/coletas");
          return;
        }

        if (!perfilUsuario || perfilUsuario.ativo === false) {
          router.replace("/coletas");
          return;
        }

        const perfil = perfilUsuario.perfil as PerfilUsuario;

        if (!perfisPermitidos.includes(perfil)) {
          router.replace("/coletas");
          return;
        }

        if (componenteAtivo) {
          setAutorizado(true);
          setCarregando(false);
        }
      } catch (erro) {
        console.error(
          "Erro inesperado ao verificar permissão:",
          erro,
        );

        router.replace("/coletas");
      }
    }

    verificarPermissao();

    return () => {
      componenteAtivo = false;
    };
  }, [router]);

  if (carregando || !autorizado) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100">
        <div className="rounded-2xl border border-slate-200 bg-white px-8 py-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-emerald-600" />

            <div>
              <p className="text-sm font-semibold text-slate-800">
                Verificando permissão
              </p>

              <p className="mt-1 text-xs text-slate-500">
                Aguarde um instante...
              </p>
            </div>
          </div>
        </div>
      </main>
    );
  }

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
              Cadastrar nova coleta
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Preencha os dados recebidos do cliente e acompanhe toda a
              movimentação da coleta.
            </p>
          </div>

          <FormNovaColeta />
        </section>
      </div>
    </main>
  );
}