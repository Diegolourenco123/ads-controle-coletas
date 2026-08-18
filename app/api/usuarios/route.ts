import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const PERFIS_PERMITIDOS = [
  "administrador",
  "gestor_operacional",
  "operacional",
  "financeiro",
  "consulta",
] as const;

type PerfilPermitido =
  (typeof PERFIS_PERMITIDOS)[number];

function criarSupabaseAdmin() {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const supabaseSecret =
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL não configurada.",
    );
  }

  if (!supabaseSecret) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY não configurada.",
    );
  }

  return createClient(
    supabaseUrl,
    supabaseSecret,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}

async function verificarAdministrador(
  request: NextRequest,
) {
  try {
    const supabaseAdmin =
      criarSupabaseAdmin();

    const authorization =
      request.headers.get("authorization");

    if (
      !authorization?.startsWith("Bearer ")
    ) {
      return {
        autorizado: false as const,
        resposta: NextResponse.json(
          {
            erro:
              "Sessão não informada.",
          },
          { status: 401 },
        ),
      };
    }

    const token = authorization
      .replace("Bearer ", "")
      .trim();

    const {
      data: { user },
      error: erroUsuario,
    } =
      await supabaseAdmin.auth.getUser(
        token,
      );

    if (erroUsuario || !user) {
      return {
        autorizado: false as const,
        resposta: NextResponse.json(
          {
            erro:
              "Sessão inválida ou expirada.",
          },
          { status: 401 },
        ),
      };
    }

    const {
      data: perfil,
      error: erroPerfil,
    } = await supabaseAdmin
      .from("usuarios_perfis")
      .select(
        "user_id, perfil, ativo",
      )
      .eq("user_id", user.id)
      .maybeSingle();

    if (erroPerfil) {
      console.error(
        "Erro ao verificar perfil:",
        erroPerfil,
      );

      return {
        autorizado: false as const,
        resposta: NextResponse.json(
          {
            erro:
              "Não foi possível validar as permissões.",
          },
          { status: 500 },
        ),
      };
    }

    if (
      !perfil ||
      perfil.ativo !== true ||
      perfil.perfil !==
        "administrador"
    ) {
      return {
        autorizado: false as const,
        resposta: NextResponse.json(
          {
            erro:
              "Acesso restrito a administradores.",
          },
          { status: 403 },
        ),
      };
    }

    return {
      autorizado: true as const,
      user,
      supabaseAdmin,
    };
  } catch (error) {
    console.error(
      "Erro ao validar administrador:",
      error,
    );

    return {
      autorizado: false as const,
      resposta: NextResponse.json(
        {
          erro:
            error instanceof Error
              ? error.message
              : "Não foi possível validar o acesso.",
        },
        { status: 500 },
      ),
    };
  }
}

async function buscarUsuarioAuthPorEmail(
  email: string,
) {
  const supabaseAdmin =
    criarSupabaseAdmin();

  let pagina = 1;
  const porPagina = 1000;

  while (true) {
    const {
      data,
      error,
    } =
      await supabaseAdmin.auth.admin.listUsers(
        {
          page: pagina,
          perPage: porPagina,
        },
      );

    if (error) {
      console.error(
        "Erro ao consultar usuários do Auth:",
        error,
      );

      throw new Error(
        "Não foi possível consultar os usuários cadastrados.",
      );
    }

    const usuarioEncontrado =
      data.users.find(
        (usuario) =>
          usuario.email
            ?.trim()
            .toLowerCase() ===
          email.trim().toLowerCase(),
      );

    if (usuarioEncontrado) {
      return usuarioEncontrado;
    }

    if (
      data.users.length <
      porPagina
    ) {
      return null;
    }

    pagina += 1;
  }
}

/* ============================================================
   GET - LISTAR USUÁRIOS
============================================================ */

export async function GET(
  request: NextRequest,
) {
  const acesso =
    await verificarAdministrador(
      request,
    );

  if (!acesso.autorizado) {
    return acesso.resposta;
  }

  const { supabaseAdmin } = acesso;

  const {
    data,
    error,
  } = await supabaseAdmin
    .from("usuarios_perfis")
    .select(
      "user_id, nome, usuario, email, perfil, ativo, created_at, updated_at",
    )
    .order("nome", {
      ascending: true,
    });

  if (error) {
    console.error(
      "Erro ao listar usuários:",
      error,
    );

    return NextResponse.json(
      {
        erro:
          "Não foi possível carregar os usuários.",
      },
      { status: 500 },
    );
  }

  return NextResponse.json({
    usuarios: data ?? [],
  });
}

/* ============================================================
   POST - CRIAR USUÁRIO
============================================================ */

export async function POST(
  request: NextRequest,
) {
  const acesso =
    await verificarAdministrador(
      request,
    );

  if (!acesso.autorizado) {
    return acesso.resposta;
  }

  const { supabaseAdmin } = acesso;

  try {
    const body =
      await request.json();

    const nome = String(
      body.nome ?? "",
    ).trim();

    const usuario = String(
      body.usuario ?? "",
    )
      .trim()
      .toLowerCase();

    const email = String(
      body.email ?? "",
    )
      .trim()
      .toLowerCase();

    const senha = String(
      body.senha ?? "",
    );

    const perfil = String(
      body.perfil ?? "",
    )
      .trim()
      .toLowerCase() as PerfilPermitido;

    if (!nome) {
      return NextResponse.json(
        {
          erro:
            "Informe o nome do usuário.",
        },
        { status: 400 },
      );
    }

    if (!usuario) {
      return NextResponse.json(
        {
          erro:
            "Informe o usuário de acesso.",
        },
        { status: 400 },
      );
    }

    if (!/^[a-z0-9._-]+$/.test(usuario)) {
      return NextResponse.json(
        {
          erro:
            "O usuário pode conter apenas letras minúsculas, números, ponto, hífen e sublinhado.",
        },
        { status: 400 },
      );
    }

    if (
      !email ||
      !email.includes("@")
    ) {
      return NextResponse.json(
        {
          erro:
            "Informe um e-mail válido.",
        },
        { status: 400 },
      );
    }

    if (senha.length < 6) {
      return NextResponse.json(
        {
          erro:
            "A senha inicial deve ter pelo menos 6 caracteres.",
        },
        { status: 400 },
      );
    }

    if (
      !PERFIS_PERMITIDOS.includes(
        perfil,
      )
    ) {
      return NextResponse.json(
        {
          erro:
            "Perfil de acesso inválido.",
        },
        { status: 400 },
      );
    }

    /* ========================================================
       VERIFICA SE JÁ EXISTE EM usuarios_perfis
    ======================================================== */

    const {
      data: usuarioExistente,
      error: erroUsuarioExistente,
    } = await supabaseAdmin
      .from("usuarios_perfis")
      .select("user_id")
      .eq("usuario", usuario)
      .maybeSingle();

    if (erroUsuarioExistente) {
      console.error(
        "Erro ao verificar usuário de acesso existente:",
        erroUsuarioExistente,
      );

      return NextResponse.json(
        {
          erro:
            "Não foi possível verificar se o usuário de acesso já está cadastrado.",
        },
        { status: 500 },
      );
    }

    if (usuarioExistente) {
      return NextResponse.json(
        {
          erro:
            "Este nome de usuário já está sendo utilizado.",
        },
        { status: 409 },
      );
    }

    const {
      data: perfilExistente,
      error: erroPerfilExistente,
    } = await supabaseAdmin
      .from("usuarios_perfis")
      .select(
        "user_id, nome, usuario, email, perfil, ativo",
      )
      .eq("email", email)
      .maybeSingle();

    if (erroPerfilExistente) {
      console.error(
        "Erro ao verificar perfil existente:",
        erroPerfilExistente,
      );

      return NextResponse.json(
        {
          erro:
            "Não foi possível verificar se o usuário já está cadastrado.",
        },
        { status: 500 },
      );
    }

    if (perfilExistente) {
      return NextResponse.json(
        {
          erro:
            "Este e-mail já possui um usuário cadastrado no sistema. Utilize a opção Editar para alterar o cadastro.",
        },
        { status: 409 },
      );
    }

    /* ========================================================
       VERIFICA SE JÁ EXISTE NO AUTH
    ======================================================== */

    const usuarioAuthExistente =
      await buscarUsuarioAuthPorEmail(
        email,
      );

    /* ========================================================
       SE EXISTE NO AUTH, VINCULA AO SISTEMA
    ======================================================== */

    if (usuarioAuthExistente) {
      const userId =
        usuarioAuthExistente.id;

      const {
        error:
          erroAtualizacaoAuth,
      } =
        await supabaseAdmin.auth.admin.updateUserById(
          userId,
          {
            user_metadata: {
              ...usuarioAuthExistente.user_metadata,
              nome,
              usuario,
            },
          },
        );

      if (
        erroAtualizacaoAuth
      ) {
        console.error(
          "Erro ao atualizar metadata do usuário:",
          erroAtualizacaoAuth,
        );
      }

      const {
        data: perfilVinculado,
        error: erroVinculo,
      } = await supabaseAdmin
        .from("usuarios_perfis")
        .insert({
          user_id: userId,
          nome,
          usuario,
          email,
          perfil,
          ativo: true,
        })
        .select(
          "user_id, nome, usuario, email, perfil, ativo, created_at, updated_at",
        )
        .single();

      if (erroVinculo) {
        console.error(
          "Erro ao vincular usuário existente:",
          erroVinculo,
        );

        return NextResponse.json(
          {
            erro:
              "O usuário já existe no Supabase Authentication, mas não foi possível vinculá-lo ao sistema.",
          },
          { status: 500 },
        );
      }

      return NextResponse.json(
        {
          mensagem:
            "Usuário existente vinculado ao sistema com sucesso.",
          usuario:
            perfilVinculado,
        },
        { status: 201 },
      );
    }

    /* ========================================================
       CRIA USUÁRIO NO AUTH
    ======================================================== */

    const {
      data: usuarioCriado,
      error: erroCriacao,
    } =
      await supabaseAdmin.auth.admin.createUser(
        {
          email,
          password: senha,
          email_confirm: true,
          user_metadata: {
            nome,
            usuario,
          },
        },
      );

    if (
      erroCriacao ||
      !usuarioCriado.user
    ) {
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

    const novoUserId =
      usuarioCriado.user.id;

    /* ========================================================
       CRIA PERFIL
    ======================================================== */

    const {
      data: perfilCriado,
      error: erroPerfil,
    } = await supabaseAdmin
      .from("usuarios_perfis")
      .insert({
        user_id: novoUserId,
        nome,
        usuario,
        email,
        perfil,
        ativo: true,
      })
      .select(
        "user_id, nome, usuario, email, perfil, ativo, created_at, updated_at",
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
        mensagem:
          "Usuário criado com sucesso.",
        usuario:
          perfilCriado,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error(
      "Erro inesperado ao criar usuário:",
      error,
    );

    return NextResponse.json(
      {
        erro:
          error instanceof Error
            ? error.message
            : "Não foi possível processar o cadastro.",
      },
      { status: 500 },
    );
  }
}

/* ============================================================
   PATCH - EDITAR USUÁRIO
============================================================ */

export async function PATCH(
  request: NextRequest,
) {
  const acesso =
    await verificarAdministrador(
      request,
    );

  if (!acesso.autorizado) {
    return acesso.resposta;
  }

  const {
    user: administradorLogado,
    supabaseAdmin,
  } = acesso;

  try {
    const body =
      await request.json();

    const userId = String(
      body.user_id ?? "",
    ).trim();

    const nome =
      body.nome !== undefined
        ? String(
            body.nome,
          ).trim()
        : undefined;

    const usuario =
      body.usuario !== undefined
        ? String(
            body.usuario,
          )
            .trim()
            .toLowerCase()
        : undefined;

    const email =
      body.email !== undefined
        ? String(
            body.email,
          )
            .trim()
            .toLowerCase()
        : undefined;

    const perfil =
      body.perfil !== undefined
        ? String(
            body.perfil,
          )
            .trim()
            .toLowerCase()
        : undefined;

    const senha =
      body.senha !== undefined
        ? String(
            body.senha,
          )
        : undefined;

    const ativo =
      typeof body.ativo ===
      "boolean"
        ? body.ativo
        : undefined;

    if (!userId) {
      return NextResponse.json(
        {
          erro:
            "Usuário não informado.",
        },
        { status: 400 },
      );
    }

    if (
      nome !== undefined &&
      !nome
    ) {
      return NextResponse.json(
        {
          erro:
            "O nome não pode ficar vazio.",
        },
        { status: 400 },
      );
    }

    if (
      usuario !== undefined &&
      !usuario
    ) {
      return NextResponse.json(
        {
          erro:
            "O usuário de acesso não pode ficar vazio.",
        },
        { status: 400 },
      );
    }

    if (
      usuario !== undefined &&
      !/^[a-z0-9._-]+$/.test(usuario)
    ) {
      return NextResponse.json(
        {
          erro:
            "O usuário pode conter apenas letras minúsculas, números, ponto, hífen e sublinhado.",
        },
        { status: 400 },
      );
    }

    if (
      email !== undefined &&
      (!email ||
        !email.includes("@"))
    ) {
      return NextResponse.json(
        {
          erro:
            "Informe um e-mail válido.",
        },
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
        {
          erro:
            "Perfil de acesso inválido.",
        },
        { status: 400 },
      );
    }

    if (
      senha !== undefined &&
      senha.length > 0 &&
      senha.length < 6
    ) {
      return NextResponse.json(
        {
          erro:
            "A nova senha deve ter pelo menos 6 caracteres.",
        },
        { status: 400 },
      );
    }

    /* ========================================================
       PROTEÇÕES DO ADMINISTRADOR LOGADO
    ======================================================== */

    if (
      userId ===
        administradorLogado.id &&
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
      userId ===
        administradorLogado.id &&
      perfil !== undefined &&
      perfil !==
        "administrador"
    ) {
      return NextResponse.json(
        {
          erro:
            "Você não pode remover o próprio perfil de administrador.",
        },
        { status: 400 },
      );
    }

    /* ========================================================
       BUSCA DADOS ATUAIS
    ======================================================== */

    const {
      data: perfilAtual,
      error:
        erroPerfilAtual,
    } = await supabaseAdmin
      .from("usuarios_perfis")
      .select(
        "user_id, nome, usuario, email, perfil, ativo",
      )
      .eq(
        "user_id",
        userId,
      )
      .maybeSingle();

    if (
      erroPerfilAtual
    ) {
      console.error(
        "Erro ao buscar perfil atual:",
        erroPerfilAtual,
      );

      return NextResponse.json(
        {
          erro:
            "Não foi possível localizar o usuário.",
        },
        { status: 500 },
      );
    }

    if (!perfilAtual) {
      return NextResponse.json(
        {
          erro:
            "Usuário não encontrado.",
        },
        { status: 404 },
      );
    }

    const {
      data:
        usuarioAuthAtual,
      error:
        erroUsuarioAuth,
    } =
      await supabaseAdmin.auth.admin.getUserById(
        userId,
      );

    if (
      erroUsuarioAuth ||
      !usuarioAuthAtual.user
    ) {
      console.error(
        "Erro ao localizar usuário no Auth:",
        erroUsuarioAuth,
      );

      return NextResponse.json(
        {
          erro:
            "O usuário não foi localizado no Supabase Authentication.",
        },
        { status: 404 },
      );
    }

    /* ========================================================
       VALIDA USUÁRIO DUPLICADO
    ======================================================== */

    if (
      usuario !== undefined &&
      usuario !==
        String(perfilAtual.usuario ?? "")
          .trim()
          .toLowerCase()
    ) {
      const {
        data: perfilMesmoUsuario,
        error: erroMesmoUsuario,
      } = await supabaseAdmin
        .from("usuarios_perfis")
        .select("user_id")
        .eq("usuario", usuario)
        .neq("user_id", userId)
        .maybeSingle();

      if (erroMesmoUsuario) {
        console.error(
          "Erro ao validar usuário de acesso:",
          erroMesmoUsuario,
        );

        return NextResponse.json(
          {
            erro:
              "Não foi possível validar o novo usuário de acesso.",
          },
          { status: 500 },
        );
      }

      if (perfilMesmoUsuario) {
        return NextResponse.json(
          {
            erro:
              "Este nome de usuário já está sendo utilizado por outro usuário.",
          },
          { status: 409 },
        );
      }
    }

    /* ========================================================
       VALIDA E-MAIL DUPLICADO
    ======================================================== */

    if (
      email !== undefined &&
      email !==
        perfilAtual.email
          .trim()
          .toLowerCase()
    ) {
      const {
        data:
          perfilMesmoEmail,
        error:
          erroMesmoEmail,
      } = await supabaseAdmin
        .from(
          "usuarios_perfis",
        )
        .select("user_id")
        .eq("email", email)
        .neq(
          "user_id",
          userId,
        )
        .maybeSingle();

      if (
        erroMesmoEmail
      ) {
        console.error(
          "Erro ao validar e-mail:",
          erroMesmoEmail,
        );

        return NextResponse.json(
          {
            erro:
              "Não foi possível validar o novo e-mail.",
          },
          { status: 500 },
        );
      }

      if (
        perfilMesmoEmail
      ) {
        return NextResponse.json(
          {
            erro:
              "Este e-mail já está sendo utilizado por outro usuário.",
          },
          { status: 409 },
        );
      }

      const usuarioAuthMesmoEmail =
        await buscarUsuarioAuthPorEmail(
          email,
        );

      if (
        usuarioAuthMesmoEmail &&
        usuarioAuthMesmoEmail.id !==
          userId
      ) {
        return NextResponse.json(
          {
            erro:
              "Este e-mail já está cadastrado no Supabase Authentication.",
          },
          { status: 409 },
        );
      }
    }

    /* ========================================================
       MONTA ATUALIZAÇÃO DO BANCO
    ======================================================== */

    const atualizacaoBanco: {
      nome?: string;
      usuario?: string;
      email?: string;
      perfil?: string;
      ativo?: boolean;
    } = {};

    if (
      nome !== undefined
    ) {
      atualizacaoBanco.nome =
        nome;
    }

    if (
      usuario !== undefined
    ) {
      atualizacaoBanco.usuario =
        usuario;
    }

    if (
      email !== undefined
    ) {
      atualizacaoBanco.email =
        email;
    }

    if (
      perfil !== undefined
    ) {
      atualizacaoBanco.perfil =
        perfil;
    }

    if (
      ativo !== undefined
    ) {
      atualizacaoBanco.ativo =
        ativo;
    }

    const temAtualizacaoBanco =
      Object.keys(
        atualizacaoBanco,
      ).length > 0;

    const temNovaSenha =
      senha !== undefined &&
      senha.length > 0;

    if (
      !temAtualizacaoBanco &&
      !temNovaSenha
    ) {
      return NextResponse.json(
        {
          erro:
            "Nenhuma alteração informada.",
        },
        { status: 400 },
      );
    }

    /* ========================================================
       ATUALIZA TABELA usuarios_perfis
    ======================================================== */

    let perfilAtualizado =
      perfilAtual;

    if (
      temAtualizacaoBanco
    ) {
      const {
        data,
        error,
      } = await supabaseAdmin
        .from(
          "usuarios_perfis",
        )
        .update(
          atualizacaoBanco,
        )
        .eq(
          "user_id",
          userId,
        )
        .select(
          "user_id, nome, usuario, email, perfil, ativo, created_at, updated_at",
        )
        .single();

      if (error) {
        console.error(
          "Erro ao atualizar usuário:",
          error,
        );

        return NextResponse.json(
          {
            erro:
              "Não foi possível atualizar os dados do usuário.",
          },
          { status: 500 },
        );
      }

      perfilAtualizado =
        data;
    }

    /* ========================================================
       MONTA ATUALIZAÇÃO DO SUPABASE AUTH
    ======================================================== */

    const atualizacaoAuth: {
      email?: string;
      password?: string;
      user_metadata?: Record<
        string,
        unknown
      >;
    } = {};

    if (
      email !== undefined
    ) {
      atualizacaoAuth.email =
        email;
    }

    if (
      temNovaSenha
    ) {
      atualizacaoAuth.password =
        senha;
    }

    if (
      nome !== undefined ||
      usuario !== undefined
    ) {
      atualizacaoAuth.user_metadata =
        {
          ...usuarioAuthAtual
            .user
            .user_metadata,
          ...(nome !== undefined ? { nome } : {}),
          ...(usuario !== undefined ? { usuario } : {}),
        };
    }

    const temAtualizacaoAuth =
      Object.keys(
        atualizacaoAuth,
      ).length > 0;

    /* ========================================================
       ATUALIZA SUPABASE AUTH
    ======================================================== */

    if (
      temAtualizacaoAuth
    ) {
      const {
        error:
          erroAtualizacaoAuth,
      } =
        await supabaseAdmin.auth.admin.updateUserById(
          userId,
          atualizacaoAuth,
        );

      if (
        erroAtualizacaoAuth
      ) {
        console.error(
          "Erro ao atualizar usuário no Auth:",
          erroAtualizacaoAuth,
        );

        /* ====================================================
           TENTA REVERTER ALTERAÇÕES DO BANCO
        ==================================================== */

        if (
          temAtualizacaoBanco
        ) {
          const {
            error:
              erroRollback,
          } =
            await supabaseAdmin
              .from(
                "usuarios_perfis",
              )
              .update({
                nome:
                  perfilAtual.nome,
                usuario:
                  perfilAtual.usuario,
                email:
                  perfilAtual.email,
                perfil:
                  perfilAtual.perfil,
                ativo:
                  perfilAtual.ativo,
              })
              .eq(
                "user_id",
                userId,
              );

          if (
            erroRollback
          ) {
            console.error(
              "Erro ao reverter dados após falha no Auth:",
              erroRollback,
            );
          }
        }

        return NextResponse.json(
          {
            erro:
              erroAtualizacaoAuth.message ||
              "Não foi possível atualizar o usuário no Supabase Authentication.",
          },
          { status: 400 },
        );
      }
    }

    return NextResponse.json({
      mensagem:
        temNovaSenha
          ? "Usuário e senha atualizados com sucesso."
          : "Usuário atualizado com sucesso.",
      usuario:
        perfilAtualizado,
    });
  } catch (error) {
    console.error(
      "Erro inesperado ao atualizar usuário:",
      error,
    );

    return NextResponse.json(
      {
        erro:
          error instanceof Error
            ? error.message
            : "Não foi possível processar a atualização.",
      },
      { status: 500 },
    );
  }
}

/* ============================================================
   DELETE - EXCLUSÃO DEFINITIVA DO USUÁRIO
============================================================ */

export async function DELETE(
  request: NextRequest,
) {
  const acesso =
    await verificarAdministrador(
      request,
    );

  if (!acesso.autorizado) {
    return acesso.resposta;
  }

  const {
    user: administradorLogado,
    supabaseAdmin,
  } = acesso;

  try {
    const body =
      await request.json();

    const userId = String(
      body.user_id ?? "",
    ).trim();

    if (!userId) {
      return NextResponse.json(
        {
          erro:
            "Usuário não informado.",
        },
        { status: 400 },
      );
    }

    /* ========================================================
       NÃO PERMITE EXCLUIR A PRÓPRIA CONTA
    ======================================================== */

    if (
      userId ===
      administradorLogado.id
    ) {
      return NextResponse.json(
        {
          erro:
            "Você não pode excluir o próprio usuário administrador.",
        },
        { status: 400 },
      );
    }

    /* ========================================================
       LOCALIZA PERFIL
    ======================================================== */

    const {
      data: perfilUsuario,
      error:
        erroBuscaPerfil,
    } = await supabaseAdmin
      .from("usuarios_perfis")
      .select(
        "user_id, nome, usuario, email, perfil, ativo",
      )
      .eq(
        "user_id",
        userId,
      )
      .maybeSingle();

    if (
      erroBuscaPerfil
    ) {
      console.error(
        "Erro ao localizar perfil para exclusão:",
        erroBuscaPerfil,
      );

      return NextResponse.json(
        {
          erro:
            "Não foi possível localizar o usuário.",
        },
        { status: 500 },
      );
    }

    if (!perfilUsuario) {
      return NextResponse.json(
        {
          erro:
            "Usuário não encontrado.",
        },
        { status: 404 },
      );
    }

    /* ========================================================
       REMOVE PERFIL DO SISTEMA
    ======================================================== */

    const {
      error:
        erroExcluirPerfil,
    } = await supabaseAdmin
      .from("usuarios_perfis")
      .delete()
      .eq(
        "user_id",
        userId,
      );

    if (
      erroExcluirPerfil
    ) {
      console.error(
        "Erro ao excluir perfil:",
        erroExcluirPerfil,
      );

      return NextResponse.json(
        {
          erro:
            "Não foi possível excluir o perfil do usuário.",
        },
        { status: 500 },
      );
    }

    /* ========================================================
       REMOVE USUÁRIO DO SUPABASE AUTH
    ======================================================== */

    const {
      error:
        erroExcluirAuth,
    } =
      await supabaseAdmin.auth.admin.deleteUser(
        userId,
      );

    if (
      erroExcluirAuth
    ) {
      console.error(
        "Erro ao excluir usuário do Auth:",
        erroExcluirAuth,
      );

      /* ======================================================
         TENTA RESTAURAR O PERFIL CASO O AUTH NÃO SEJA EXCLUÍDO
      ====================================================== */

      const {
        error:
          erroRestauracao,
      } = await supabaseAdmin
        .from(
          "usuarios_perfis",
        )
        .insert({
          user_id:
            perfilUsuario.user_id,
          nome:
            perfilUsuario.nome,
          usuario:
            perfilUsuario.usuario,
          email:
            perfilUsuario.email,
          perfil:
            perfilUsuario.perfil,
          ativo:
            perfilUsuario.ativo,
        });

      if (
        erroRestauracao
      ) {
        console.error(
          "Erro ao restaurar perfil após falha na exclusão:",
          erroRestauracao,
        );
      }

      return NextResponse.json(
        {
          erro:
            "Não foi possível excluir o usuário do Supabase Authentication.",
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      mensagem:
        "Usuário excluído definitivamente com sucesso.",
      user_id:
        userId,
    });
  } catch (error) {
    console.error(
      "Erro inesperado ao excluir usuário:",
      error,
    );

    return NextResponse.json(
      {
        erro:
          error instanceof Error
            ? error.message
            : "Não foi possível processar a exclusão.",
      },
      { status: 500 },
    );
  }
}