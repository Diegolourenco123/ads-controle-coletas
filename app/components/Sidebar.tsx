"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { criarClienteSupabaseBrowser } from "../lib/supabase-browser";

type IconeProps = {
  className?: string;
};

type PerfilUsuario =
  | "administrador"
  | "gestor_operacional"
  | "operacional"
  | "financeiro"
  | "consulta";

type ItemMenu = {
  nome: string;
  href: string;
  icone: React.ComponentType<IconeProps>;
  perfis: PerfilUsuario[];
};

function IconePainel({ className }: IconeProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className={className}
      aria-hidden="true"
    >
      <rect x="3" y="3" width="7" height="7" rx="2" />
      <rect x="14" y="3" width="7" height="7" rx="2" />
      <rect x="3" y="14" width="7" height="7" rx="2" />
      <rect x="14" y="14" width="7" height="7" rx="2" />
    </svg>
  );
}

function IconeAdicionar({ className }: IconeProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  );
}

function IconeLista({ className }: IconeProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M9 6h11" />
      <path d="M9 12h11" />
      <path d="M9 18h11" />
      <path d="M4 6h.01" />
      <path d="M4 12h.01" />
      <path d="M4 18h.01" />
    </svg>
  );
}

function IconeAlerta({ className }: IconeProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M10.3 4.3 2.7 17.5A2 2 0 0 0 4.4 20h15.2a2 2 0 0 0 1.7-2.5L13.7 4.3a2 2 0 0 0-3.4 0Z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </svg>
  );
}

function IconeAgenda({ className }: IconeProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M16 3v4" />
      <path d="M8 3v4" />
      <path d="M3 10h18" />
    </svg>
  );
}

function IconeDocumentos({ className }: IconeProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
      <path d="M14 2v6h6" />
      <path d="M8 13h8" />
      <path d="M8 17h8" />
    </svg>
  );
}

function IconeCaminhao({ className }: IconeProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M3 6h11v10H3z" />
      <path d="M14 9h4l3 3v4h-7z" />
      <circle cx="7" cy="18" r="2" />
      <circle cx="18" cy="18" r="2" />
    </svg>
  );
}

function IconeClientes({ className }: IconeProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function IconeUsuarios({ className }: IconeProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="8.5" cy="7" r="4" />
      <path d="M20 8v6" />
      <path d="M23 11h-6" />
    </svg>
  );
}

function IconeRelatorios({ className }: IconeProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M4 19V9" />
      <path d="M10 19V5" />
      <path d="M16 19v-7" />
      <path d="M22 19H2" />
    </svg>
  );
}

function IconeAnalisePagamentos({ className }: IconeProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M3 3v18h18" />
      <path d="m7 16 4-5 4 3 5-7" />
      <path d="M18 7h2v2" />
    </svg>
  );
}

const todosPerfis: PerfilUsuario[] = [
  "administrador",
  "gestor_operacional",
  "operacional",
  "financeiro",
  "consulta",
];

const perfisOperacionais: PerfilUsuario[] = [
  "administrador",
  "gestor_operacional",
  "operacional",
];

const perfisAnaliseFinanceira: PerfilUsuario[] = [
  "administrador",
  "gestor_operacional",
  "financeiro",
];

const itensMenu: ItemMenu[] = [
  {
    nome: "Painel operacional",
    href: "/",
    icone: IconePainel,
    perfis: todosPerfis,
  },
  {
    nome: "Nova coleta",
    href: "/coletas/nova",
    icone: IconeAdicionar,
    perfis: perfisOperacionais,
  },
  {
    nome: "Todas as coletas",
    href: "/coletas",
    icone: IconeLista,
    perfis: todosPerfis,
  },
  {
    nome: "Central de Alertas",
    href: "/alertas",
    icone: IconeAlerta,
    perfis: todosPerfis,
  },
  {
    nome: "Agenda Operacional",
    href: "/agenda",
    icone: IconeAgenda,
    perfis: todosPerfis,
  },
  {
    nome: "Central de Documentos",
    href: "/documentos",
    icone: IconeDocumentos,
    perfis: todosPerfis,
  },
  {
    nome: "Transportadoras",
    href: "/transportadoras",
    icone: IconeCaminhao,
    perfis: todosPerfis,
  },
  {
    nome: "Clientes",
    href: "/clientes",
    icone: IconeClientes,
    perfis: todosPerfis,
  },
  {
    nome: "Usuários e Permissões",
    href: "/usuarios",
    icone: IconeUsuarios,
    perfis: ["administrador"],
  },
  {
    nome: "Relatórios",
    href: "/relatorios",
    icone: IconeRelatorios,
    perfis: todosPerfis,
  },
  {
    nome: "Análise de Pagamentos",
    href: "/analise-pagamentos",
    icone: IconeAnalisePagamentos,
    perfis: perfisAnaliseFinanceira,
  },
];

function verificarItemAtivo(pathname: string, href: string) {
  const rotasExatas = ["/", "/coletas", "/coletas/nova"];

  if (rotasExatas.includes(href)) {
    return pathname === href;
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function Sidebar() {
  const pathname = usePathname();

  const [perfil, setPerfil] = useState<PerfilUsuario | null>(null);
  const [carregandoPerfil, setCarregandoPerfil] = useState(true);

  useEffect(() => {
    let ativo = true;

    async function carregarPerfil() {
      try {
        const supabase = criarClienteSupabaseBrowser();

        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          if (ativo) {
            setPerfil(null);
            setCarregandoPerfil(false);
          }
          return;
        }

        const { data, error } = await supabase
          .from("usuarios_perfis")
          .select("perfil, ativo")
          .eq("user_id", user.id)
          .maybeSingle();

        if (error) {
          console.error("Erro ao carregar perfil do usuário:", error);

          if (ativo) {
            setPerfil("consulta");
            setCarregandoPerfil(false);
          }

          return;
        }

        if (!data || data.ativo === false) {
          if (ativo) {
            setPerfil("consulta");
            setCarregandoPerfil(false);
          }

          return;
        }

        const perfilRecebido = data.perfil as PerfilUsuario;

        const perfisValidos: PerfilUsuario[] = [
          "administrador",
          "gestor_operacional",
          "operacional",
          "financeiro",
          "consulta",
        ];

        if (ativo) {
          setPerfil(
            perfisValidos.includes(perfilRecebido)
              ? perfilRecebido
              : "consulta",
          );

          setCarregandoPerfil(false);
        }
      } catch (erro) {
        console.error("Erro inesperado ao carregar perfil:", erro);

        if (ativo) {
          setPerfil("consulta");
          setCarregandoPerfil(false);
        }
      }
    }

    carregarPerfil();

    return () => {
      ativo = false;
    };
  }, []);

  const itensPermitidos = useMemo(() => {
    if (!perfil) {
      return [];
    }

    return itensMenu.filter((item) => item.perfis.includes(perfil));
  }, [perfil]);

  return (
    <aside className="min-h-screen border-r border-slate-900 bg-slate-950 px-4 py-6 text-white">
      <div className="mb-6 px-3">
        <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-slate-500">
          Navegação
        </p>

        <p className="mt-1 text-xs text-slate-600">
          Centro operacional
        </p>
      </div>

      <nav className="space-y-1.5">
        {!carregandoPerfil &&
          itensPermitidos.map((item) => {
            const itemAtivo = verificarItemAtivo(pathname, item.href);
            const Icone = item.icone;

            return (
              <Link
                key={item.nome}
                href={item.href}
                className={[
                  "group relative flex w-full items-center gap-3 overflow-hidden rounded-xl px-3 py-3 text-left text-sm transition-all duration-200",
                  itemAtivo
                    ? "bg-emerald-600 text-white shadow-lg shadow-emerald-950/20"
                    : "text-slate-400 hover:bg-slate-900 hover:text-white",
                ].join(" ")}
              >
                {itemAtivo && (
                  <span className="absolute bottom-2 left-0 top-2 w-1 rounded-r-full bg-emerald-300" />
                )}

                <div
                  className={[
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition",
                    itemAtivo
                      ? "bg-white/10 text-white"
                      : "bg-slate-900 text-slate-500 group-hover:bg-slate-800 group-hover:text-slate-200",
                  ].join(" ")}
                >
                  <Icone className="h-[17px] w-[17px]" />
                </div>

                <span
                  className={
                    itemAtivo
                      ? "truncate font-semibold"
                      : "truncate font-medium"
                  }
                >
                  {item.nome}
                </span>
              </Link>
            );
          })}
      </nav>

      <div className="mt-10 border-t border-slate-900 pt-5">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold text-slate-200">
                Sistema operacional
              </p>

              <div className="mt-2 flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-40" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
                </span>

                <p className="text-[11px] font-semibold text-emerald-400">
                  Online
                </p>
              </div>
            </div>

            <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-emerald-500/20 bg-emerald-500/10">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
            </div>
          </div>

          <div className="my-4 h-px bg-slate-800" />

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3 text-[10px]">
              <span className="text-slate-500">
                Banco de dados
              </span>

              <span className="font-semibold text-slate-300">
                Conectado
              </span>
            </div>

            <div className="flex items-center justify-between gap-3 text-[10px]">
              <span className="text-slate-500">
                Supabase
              </span>

              <span className="font-semibold text-emerald-400">
                Operacional
              </span>
            </div>
          </div>
        </div>

        <div className="mt-4 border-t border-slate-900 px-3 pt-4">
          <p className="text-[10px] font-semibold text-slate-500">
            ADS Controle de Coletas
          </p>

          <p className="mt-1 text-[10px] text-slate-600">
            Desenvolvido por{" "}
            <span className="font-semibold text-emerald-500">
              Diego Farias
            </span>
          </p>

          <p className="mt-1 text-[9px] leading-4 text-slate-700">
            © 2026 ADS Logística Ambiental • v1.0
          </p>
        </div>
      </div>
    </aside>
  );
}