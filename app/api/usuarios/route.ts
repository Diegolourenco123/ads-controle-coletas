import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseSecret = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL não configurada.");
}

if (!supabaseSecret) {
  throw new Error("SUPABASE_SERVICE_ROLE_KEY não configurada.");
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

const PERFIS_PERMITIDOS = [
  "administrador",
  "gestor_operacional",
  "operacional",
  "financeiro",
  "consulta",
] as const;

type PerfilPermitido = (typeof PERFIS_PERMITIDOS)[number];

async function verificarAdministrador(request: NextRequest) {
  const authorization = request.headers.get("authorization");

  if (!authorization?.startsWith("Bearer ")) {
    return {
      autorizado: false as const,
      resposta: NextResponse.json(
        { erro: "Sessão não informada." },
        { status: 401 },
      ),
    };
  }

  const token = authorization.replace("Bearer ", "").trim();

  const {
    data: { user },
    error: erroUsuario,
  } = await supabaseAdmin.auth.getUser(token);

  if (erroUsuario || !user) {
    return {
      autorizado: false as const,
      resposta: NextResponse.json(
        { erro: "Sessão inválida ou expirada." },
        { status: 401 },
      ),
    };
  }

  const { data: perfil, error: erroPerfil } =
    await supabaseAdmin
      .from("usuarios_perfis")
      .select("user_id, perfil, ativo")
      .eq("user_id", user.id)
      .maybeSingle();

  if (erroPerfil) {
    console.error("Erro ao verificar perfil:", erroPerfil);

    return {
      autorizado: false as const,
      resposta: NextResponse.json(
        { erro: "Não foi possível validar as permissões." },
        { status: 500 },
      ),
    };
  }

  if (
    !perfil ||
    perfil.ativo !== true ||
    perfil.perfil !== "administrador"
  ) {
    return {
      autorizado: false as const,
      resposta: NextResponse.json(
        { erro: "Acesso restrito a administradores." },
        { status: 403 },
      ),
    };
  }

  return {
    autorizado: true as const,
    user,
  };
}

export async function GET(request: NextRequest) {
  const acesso = await verificarAdministrador(request);

  if (!acesso.autorizado) {
    return acesso.resposta;
  }

  const { data, error } = await supabaseAdmin
    .from("usuarios_perfis")
    .select(
      "user_id, nome, email, perfil, ativo, created_at, updated_at",
    )
    .order("nome", { ascending: true });

  if (error) {
    console.error("Erro ao listar usuários:", error);

    return NextResponse.json(
      { erro: "Não foi possível carregar os usuários." },
      { status: 500 },
    );
  }

  return NextResponse.json({
    usuarios: data ?? [],
  });
}

export async function POST(request: NextRequest) {
  const acesso = await verificarAdministrador(request);

  if (!acesso.autorizado) {
    return acesso.resposta;
  }

  try {
    const body = await request.json();

    const nome = String(body.nome ?? "").trim();
    const email = String(body.email ?? "")
      .trim()
      .toLowerCase();
    const senha = String(body.senha ?? "");
    const perfil = String(body.perfil ?? "")
      .trim()
      .toLowerCase() as PerfilPermitido;

    if (!nome) {
      return NextResponse.json(
        { erro: "Informe o nome do usuário." },
        { status: 400 },
      );
    }

    if (!email || !email.includes("@")) {
      return NextResponse.json(
        { erro: "Informe um e-mail válido." },
        { status: 400 },
      );
    }

    if (senha.length < 6) {
      return NextResponse.json(
        { erro: "A senha inicial deve ter pelo menos 6 caracteres." },
        { status: 400 },
      );
    }

    if (
      !PERFIS_PERMITIDOS.includes(
        perfil as PerfilPermitido,
      )
    ) {
      return NextResponse.json(
        { erro: "Perfil de acesso inválido." },
        { status: 400 },
      );
    }

    const { data: perfilExistente } = await supabaseAdmin
      .from("usuarios_perfis")
      .select("user_id")
      .eq("email", email)
      .maybeSingle();

    if (perfilExistente) {
      return NextResponse.json(
        { erro: "Já existe um usuário cadastrado com este e-mail." },
        { status: 409 },
      );
    }

    const {
      data: usuarioCriado,
      error: erroCriacao,
    } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: senha,
      email_confirm: true,
      user_metadata: {
        nome,
      },
    });

    if (erroCriacao || !usuarioCriado.user) {
      console.error(
        "Erro ao criar usuário no Auth:",
        erroCriacao,
      );

      return NextResponse.json(
        {
          erro:
            erroCriacao?.message ??
            "Não foi possível criar o usuário no Supabase Auth.",
        },
        { status: 400 },
      );
    }

    const novoUserId = usuarioCriado.user.id;

    const { data: perfilCriado, error: erroPerfil } =
      await supabaseAdmin
        .from("usuarios_perfis")
        .insert({
          user_id: novoUserId,
          nome,
          email,
          perfil,
          ativo: true,
        })
        .select(
          "user_id, nome, email, perfil, ativo, created_at, updated_at",
        )
        .single();

    if (erroPerfil) {
      console.error(
        "Erro ao salvar perfil do usuário:",
        erroPerfil,
      );

      await supabaseAdmin.auth.admin.deleteUser(
        novoUserId,
      );

      return NextResponse.json(
        {
          erro:
            "O acesso não foi concluído e foi revertido. " +
            erroPerfil.message,
        },
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        mensagem: "Usuário criado com sucesso.",
        usuario: perfilCriado,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Erro inesperado ao criar usuário:", error);

    return NextResponse.json(
      { erro: "Não foi possível processar o cadastro." },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  const acesso = await verificarAdministrador(request);

  if (!acesso.autorizado) {
    return acesso.resposta;
  }

  try {
    const body = await request.json();

    const userId = String(body.user_id ?? "").trim();
    const nome =
      body.nome !== undefined
        ? String(body.nome).trim()
        : undefined;
    const perfil =
      body.perfil !== undefined
        ? String(body.perfil)
            .trim()
            .toLowerCase()
        : undefined;
    const ativo =
      typeof body.ativo === "boolean"
        ? body.ativo
        : undefined;

    if (!userId) {
      return NextResponse.json(
        { erro: "Usuário não informado." },
        { status: 400 },
      );
    }

    if (
      perfil !== undefined &&
      !PERFIS_PERMITIDOS.includes(
        perfil as PerfilPermitido,
      )
    ) {
      return NextResponse.json(
        { erro: "Perfil de acesso inválido." },
        { status: 400 },
      );
    }

    if (
      userId === acesso.user.id &&
      ativo === false
    ) {
      return NextResponse.json(
        {
          erro:
            "Você não pode desativar o próprio usuário administrador.",
        },
        { status: 400 },
      );
    }

    if (
      userId === acesso.user.id &&
      perfil !== undefined &&
      perfil !== "administrador"
    ) {
      return NextResponse.json(
        {
          erro:
            "Você não pode remover o próprio perfil de administrador.",
        },
        { status: 400 },
      );
    }

    const atualizacao: {
      nome?: string;
      perfil?: string;
      ativo?: boolean;
    } = {};

    if (nome !== undefined) {
      if (!nome) {
        return NextResponse.json(
          { erro: "O nome não pode ficar vazio." },
          { status: 400 },
        );
      }

      atualizacao.nome = nome;
    }

    if (perfil !== undefined) {
      atualizacao.perfil = perfil;
    }

    if (ativo !== undefined) {
      atualizacao.ativo = ativo;
    }

    if (Object.keys(atualizacao).length === 0) {
      return NextResponse.json(
        { erro: "Nenhuma alteração informada." },
        { status: 400 },
      );
    }

    const { data, error } = await supabaseAdmin
      .from("usuarios_perfis")
      .update(atualizacao)
      .eq("user_id", userId)
      .select(
        "user_id, nome, email, perfil, ativo, created_at, updated_at",
      )
      .single();

    if (error) {
      console.error("Erro ao atualizar usuário:", error);

      return NextResponse.json(
        { erro: "Não foi possível atualizar o usuário." },
        { status: 500 },
      );
    }

    return NextResponse.json({
      mensagem: "Usuário atualizado com sucesso.",
      usuario: data,
    });
  } catch (error) {
    console.error(
      "Erro inesperado ao atualizar usuário:",
      error,
    );

    return NextResponse.json(
      { erro: "Não foi possível processar a atualização." },
      { status: 500 },
    );
  }
}