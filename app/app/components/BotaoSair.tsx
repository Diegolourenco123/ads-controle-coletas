"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { criarClienteSupabaseBrowser } from "../lib/supabase-browser";

export default function BotaoSair() {
  const router = useRouter();
  const [saindo, setSaindo] = useState(false);

  async function sair() {
    setSaindo(true);

    const supabase = criarClienteSupabaseBrowser();
    await supabase.auth.signOut();

    router.replace("/login");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={sair}
      disabled={saindo}
      className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-red-200 hover:bg-red-50 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {saindo ? "Saindo..." : "Sair"}
    </button>
  );
}
