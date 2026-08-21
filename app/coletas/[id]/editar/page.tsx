"use client";

import { useEffect, useState } from "react";
import {
  useParams,
  useRouter,
  useSearchParams,
} from "next/navigation";
import Link from "next/link";

import FormEditarColeta from "../../../components/FormEditarColeta";
import Header from "../../../components/Header";
import Sidebar from "../../../components/Sidebar";
import { criarClienteSupabaseBrowser } from "../../../lib/supabase-browser";

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

export default function EditarColetaPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();

  const coletaId = Number(params.id);

  const [carregando, setCarregando] = useState(true);
  const [autorizado, setAutorizado] = useState(false);

  /*
   * ==========================================================
   * ROTA DE RETORNO
   * ==========================================================
   *
   * A tela "Todas as coletas" envia no parâmetro "voltar"
   * a URL completa com os filtros utilizados anteriormente.
   *
   * Exemplo:
   *
   * /coletas?status=Aguardando%20NF
   *
   * ou:
   *
   * /coletas?status=Aguardando%20coleta&transportadora=Todo%20Brasil
   *
   * Caso a coleta seja aberta por outro lugar do sistema,
   * o retorno padrão será /coletas.
   */
  const parametroVoltar = searchParams.get("voltar");

  const voltarPara =
    parametroVoltar?.startsWith("/coletas")
      ? parametroVoltar
      : "/coletas";

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

        const { data: perfilUsuario, error: erroPerfil } =
          await supabase
            .from("usuarios_perfis")
            .select("perfil, ativo")
            .eq("user_id", user.id)
            .maybeSingle();

        if (erroPerfil) {
          console.error(
            "Erro ao verificar permissão:",
            erroPerfil,
          );

          router.replace("/coletas");
          return;
        }

        if (
          !perfilUsuario ||
          perfilUsuario.ativo === false
        ) {
          router.replace("/coletas");
          return;
        }

        const perfil =
          perfilUsuario.perfil as PerfilUsuario;

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

  if (
    carregando ||
    !autorizado ||
    Number.isNaN(coletaId)
  ) {
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
            {/* BOTÃO VOLTAR */}
            <Link
              href={voltarPara}
              className="mb-4 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-4 w-4"
                aria-hidden="true"
              >
                <path d="M19 12H5" />
                <path d="m12 19-7-7 7-7" />
              </svg>

              Voltar para coletas
            </Link>

            <p className="text-sm font-medium text-emerald-700">
              Controle operacional
            </p>

            <h2 className="mt-1 text-3xl font-bold">
              Editar coleta #{coletaId}
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Atualize o andamento, os documentos e as
              informações da coleta.
            </p>
          </div>

          <FormEditarColeta id={coletaId} />
        </section>
      </div>
    </main>
  );
}