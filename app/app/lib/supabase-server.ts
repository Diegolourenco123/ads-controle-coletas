import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function criarClienteSupabaseServer() {
  const armazenamentoCookies = await cookies();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabasePublishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl) {
    throw new Error(
      "A variável NEXT_PUBLIC_SUPABASE_URL não foi configurada.",
    );
  }

  if (!supabasePublishableKey) {
    throw new Error(
      "A variável NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY não foi configurada.",
    );
  }

  return createServerClient(
    supabaseUrl,
    supabasePublishableKey,
    {
      cookies: {
        getAll() {
          return armazenamentoCookies.getAll();
        },

        setAll(cookiesParaDefinir) {
          try {
            cookiesParaDefinir.forEach(
              ({ name, value, options }) => {
                armazenamentoCookies.set(
                  name,
                  value,
                  options,
                );
              },
            );
          } catch {
            /*
             * Em alguns Server Components os cookies não podem ser
             * escritos diretamente. O proxy.ts será responsável por
             * renovar e persistir a sessão.
             */
          }
        },
      },
    },
  );
}
