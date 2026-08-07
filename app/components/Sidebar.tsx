"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const itensMenu = [
  {
    nome: "Painel operacional",
    href: "/",
  },
  {
    nome: "Nova coleta",
    href: "/coletas/nova",
  },
  {
    nome: "Todas as coletas",
    href: "/coletas",
  },
  {
    nome: "Central de Alertas",
    href: "/alertas",
  },
  {
    nome: "Agenda Operacional",
    href: "/agenda",
  },
  {
    nome: "Transportadoras",
    href: "/transportadoras",
  },
  {
    nome: "Clientes",
    href: "/clientes",
  },
  {
    nome: "Relatórios",
    href: "/relatorios",
  },
];

function verificarItemAtivo(
  pathname: string,
  href: string,
) {
  const rotasExatas = [
    "/",
    "/coletas",
    "/coletas/nova",
  ];

  if (rotasExatas.includes(href)) {
    return pathname === href;
  }

  return (
    pathname === href ||
    pathname.startsWith(`${href}/`)
  );
}

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="min-h-screen bg-slate-950 px-5 py-7 text-white">
      <p className="mb-8 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
        Menu principal
      </p>

      <nav className="space-y-2">
        {itensMenu.map((item) => {
          const ativo = verificarItemAtivo(
            pathname,
            item.href,
          );

          return (
            <Link
              key={item.nome}
              href={item.href}
              className={[
                "relative block w-full overflow-hidden rounded-xl px-4 py-3 text-left text-sm transition",
                ativo
                  ? "bg-emerald-600 font-semibold text-white shadow-sm"
                  : "text-slate-300 hover:bg-slate-900 hover:text-white",
              ].join(" ")}
            >
              {ativo && (
                <span className="absolute bottom-0 left-0 top-0 w-1 bg-emerald-300" />
              )}

              <span className={ativo ? "pl-1" : ""}>
                {item.nome}
              </span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-10 rounded-2xl border border-slate-800 bg-slate-900 p-4">
        <p className="text-sm font-semibold">
          Sistema online
        </p>

        <div className="mt-3 flex items-center gap-2 text-xs text-emerald-400">
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
          Operação normal
        </div>

        <p className="mt-3 text-xs leading-5 text-slate-500">
          Supabase conectado e sistema operacional.
        </p>
      </div>
    </aside>
  );
}