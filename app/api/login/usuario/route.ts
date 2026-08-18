import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/*
 * ==========================================================
 * TESTE DA ROTA
 * ==========================================================
 *
 * Ao abrir no navegador:
 * http://localhost:3000/api/login/usuario
 *
 * deve retornar JSON.
 */
export async function GET() {
  return NextResponse.json({
    ok: true,
    rota: "/api/login/usuario",
  });
}

/*
 * ==========================================================
 * LOGIN POR NOME DE USUÁRIO
 * ==========================================================
 *
 * Recebe:
 * {
 *   usuario: "diego"
 * }
 *
 * Retorna o e-mail vinculado ao usuário para o
 * FormLogin concluir a autenticação pelo Supabase Auth.
 */
export async function POST(request: NextRequest) {
  try {
    const supabaseUrl =
      process.env.NEXT_PUBLIC_SUPABASE_URL;

    const supabaseSecret =
      process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseSecret) {
      console.error(
        "Variáveis de autenticação não configuradas.",
      );

      return NextResponse.json(
        {
          erro:
            "Configuração de autenticação indisponível.",
        },
        { status: 500 },
      );
    }

    const body = await request.json();

    const usuario = String(
      body.usuario ?? "",
    )
      .trim()
      .toLowerCase();

    if (!usuario) {
      return NextResponse.json(
        {
          erro:
            "Informe o usuário.",
        },
        { status: 400 },
      );
    }

    const supabaseAdmin = createClient(
      supabaseUrl,
      supabaseSecret,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      },
    );

    const {
      data,
      error,
    } = await supabaseAdmin
      .from("usuarios_perfis")
      .select(
        "user_id, usuario, email, ativo",
      )
      .eq("usuario", usuario)
      .maybeSingle();

    if (error) {
      console.error(
        "Erro ao localizar usuário de acesso:",
        error,
      );

      return NextResponse.json(
        {
          erro:
            "Não foi possível validar o acesso.",
        },
        { status: 500 },
      );
    }

    /*
     * Mantemos a mesma mensagem para:
     * - usuário inexistente
     * - usuário inativo
     * - usuário sem e-mail
     *
     * Assim evitamos revelar informações sobre contas.
     */
    if (
      !data ||
      data.ativo !== true ||
      !data.email
    ) {
      return NextResponse.json(
        {
          erro:
            "Usuário/e-mail ou senha incorretos.",
        },
        { status: 401 },
      );
    }

    return NextResponse.json({
      email: String(data.email)
        .trim()
        .toLowerCase(),
    });
  } catch (error) {
    console.error(
      "Erro inesperado ao resolver usuário:",
      error,
    );

    return NextResponse.json(
      {
        erro:
          "Não foi possível processar o login.",
      },
      { status: 500 },
    );
  }
}