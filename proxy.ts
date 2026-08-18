import { createServerClient } from "@supabase/ssr";
import {
  NextResponse,
  type NextRequest,
} from "next/server";

export async function proxy(request: NextRequest) {
  const caminho = request.nextUrl.pathname;

  /*
   * ==========================================================
   * ROTAS PÚBLICAS
   * ==========================================================
   *
   * Esta API precisa funcionar sem sessão porque é utilizada
   * para localizar o e-mail correspondente ao nome de usuário
   * antes do login no Supabase.
   */
  if (
    caminho === "/api/login/usuario" ||
    caminho.startsWith("/api/login/usuario/")
  ) {
    return NextResponse.next();
  }

  let resposta = NextResponse.next({
    request,
  });

  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const supabasePublishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  /*
   * Se as variáveis não estiverem configuradas,
   * deixa a requisição continuar.
   */
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
          cookiesParaDefinir.forEach(
            ({ name, value }) => {
              request.cookies.set(name, value);
            },
          );

          resposta = NextResponse.next({
            request,
          });

          cookiesParaDefinir.forEach(
            ({ name, value, options }) => {
              resposta.cookies.set(
                name,
                value,
                options,
              );
            },
          );
        },
      },
    },
  );

  /*
   * Valida e renova a sessão do usuário.
   */
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const paginaLogin =
    caminho === "/login" ||
    caminho === "/login/";

  /*
   * ==========================================================
   * USUÁRIO NÃO LOGADO
   * ==========================================================
   */
  if (!user) {
    /*
     * Permite acessar normalmente a página de login.
     */
    if (paginaLogin) {
      return resposta;
    }

    /*
     * Qualquer outra página protegida manda para o login.
     */
    const urlLogin = request.nextUrl.clone();

    urlLogin.pathname = "/login";

    urlLogin.searchParams.set(
      "retorno",
      caminho,
    );

    return NextResponse.redirect(urlLogin);
  }

  /*
   * ==========================================================
   * USUÁRIO LOGADO
   * ==========================================================
   *
   * Se já estiver autenticado e tentar acessar /login,
   * retorna ao painel principal.
   */
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