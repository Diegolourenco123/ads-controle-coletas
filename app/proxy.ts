import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  let resposta = NextResponse.next({
    request,
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabasePublishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabasePublishableKey) {
    return resposta;
  }

  const supabase = createServerClient(
    supabaseUrl,
    supabasePublishableKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },

        setAll(cookiesParaDefinir) {
          cookiesParaDefinir.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });

          resposta = NextResponse.next({
            request,
          });

          cookiesParaDefinir.forEach(
            ({ name, value, options }) => {
              resposta.cookies.set(name, value, options);
            },
          );
        },
      },
    },
  );

  /*
   * Não coloque código entre a criação do cliente e getUser().
   * Essa chamada valida e renova a sessão quando necessário.
   */
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const caminho = request.nextUrl.pathname;
  const paginaLogin = caminho === "/login";

  if (!user && !paginaLogin) {
    const urlLogin = request.nextUrl.clone();
    urlLogin.pathname = "/login";
    urlLogin.searchParams.set("retorno", caminho);

    return NextResponse.redirect(urlLogin);
  }

  if (user && paginaLogin) {
    const urlInicio = request.nextUrl.clone();
    urlInicio.pathname = "/";
    urlInicio.search = "";

    return NextResponse.redirect(urlInicio);
  }

  return resposta;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|logo-ads.png|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
