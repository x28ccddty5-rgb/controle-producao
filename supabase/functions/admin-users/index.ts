import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const supabaseAnonKey =
  Deno.env.get("SUPABASE_ANON_KEY") ??
  Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ??
  "";
const supabaseServiceRoleKey =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
  Deno.env.get("SUPABASE_SECRET_KEY") ??
  "";

if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
  console.error("Variáveis Supabase necessárias não configuradas.");
}

const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

type AppRole =
  | "administrador"
  | "lideranca"
  | "apoio"
  | "producao"
  | "visualizador";

const validRoles = new Set<AppRole>([
  "administrador",
  "lideranca",
  "apoio",
  "producao",
  "visualizador",
]);

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function getBearerToken(request: Request): string | null {
  const authorization = request.headers.get("Authorization") ?? "";
  if (!authorization.toLowerCase().startsWith("bearer ")) return null;
  return authorization.slice(7).trim() || null;
}

async function getAdministrator(request: Request) {
  const token = getBearerToken(request);

  if (!token) {
    return { error: json({ error: "Sessão autenticada obrigatória." }, 401) };
  }

  const {
    data: { user },
    error: authError,
  } = await supabaseAuth.auth.getUser(token);

  if (authError || !user) {
    return { error: json({ error: "Sessão inválida ou expirada." }, 401) };
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("id,username,name,role,deleted_at")
    .eq("id", user.id)
    .is("deleted_at", null)
    .single();

  if (profileError || !profile) {
    console.error("Erro ao carregar perfil do administrador:", profileError);
    return { error: json({ error: "Perfil de acesso não encontrado." }, 403) };
  }

  if (profile.role !== "administrador") {
    return { error: json({ error: "Apenas o Administrador pode gerenciar usuários." }, 403) };
  }

  return { user, profile };
}

async function listUsers() {
  const { data: authData, error: authError } =
    await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });

  if (authError) {
    console.error("Erro ao listar usuários Auth:", authError);
    return json({ error: "Não foi possível listar os usuários Auth." }, 500);
  }

  const authUsers = (authData.users ?? []).filter((user) => !user.deleted_at);

  if (authUsers.length === 0) {
    return json({ users: [] });
  }

  const ids = authUsers.map((user) => user.id);

  const { data: profiles, error: profilesError } = await supabaseAdmin
    .from("profiles")
    .select("id,username,name,role")
    .in("id", ids)
    .is("deleted_at", null);

  if (profilesError) {
    console.error("Erro ao listar profiles:", profilesError);
    return json({ error: "Não foi possível carregar os perfis." }, 500);
  }

  const profileById = new Map(
    (profiles ?? []).map((profile) => [profile.id, profile])
  );

  const users = authUsers
    .map((authUser) => {
      const profile = profileById.get(authUser.id);
      if (!profile) return null;

      return {
        id: authUser.id,
        email: authUser.email ?? "",
        username: profile.username,
        name: profile.name,
        role: profile.role as AppRole,
      };
    })
    .filter(Boolean);

  return json({ users });
}

function makeRetiredEmail(userId: string, currentEmail: string): string {
  const [, domain] = currentEmail.split("@");
  const safeDomain = domain?.trim().toLowerCase() || "invalid.local";
  return `deleted+${userId}@${safeDomain}`;
}

async function permanentlyDeleteAuthAccount(userId: string) {
  const { error: bindingError } = await supabaseAdmin
    .from("mobile_operator_bindings")
    .delete()
    .eq("profile_id", userId);

  if (bindingError) {
    throw new Error(
      `Não foi possível remover o vínculo Mobile da conta: ${bindingError.message}`
    );
  }

  const { error: deleteError } =
    await supabaseAdmin.auth.admin.deleteUser(userId);

  if (deleteError) {
    throw new Error(
      deleteError.message || "Não foi possível excluir a conta Auth."
    );
  }
}

async function releaseSoftDeletedEmail(
  authUser: { id: string; email?: string | null; deleted_at?: string | null },
) {
  if (!authUser.deleted_at) return;

  await permanentlyDeleteAuthAccount(authUser.id);
}


function normalizeCollaboratorName(value: string): string {
  return value
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

async function bindMatchingCollaborator(profileId: string, username: string) {
  const normalizedUsername = normalizeCollaboratorName(username);

  const { data: collaborators, error: collaboratorError } =
    await supabaseAdmin
      .from("collaborators")
      .select("id,name")
      .eq("active", true);

  if (collaboratorError) {
    throw new Error(
      `Não foi possível verificar o colaborador do usuário: ${collaboratorError.message}`,
    );
  }

  const matches = (collaborators ?? []).filter(
    (collaborator) =>
      normalizeCollaboratorName(String(collaborator.name ?? "")) ===
      normalizedUsername,
  );

  if (matches.length === 0) return;

  if (matches.length > 1) {
    throw new Error(
      `Existe mais de um colaborador ativo compatível com o login "${username}".`,
    );
  }

  const collaboratorId = matches[0].id;

  const { data: existingBinding, error: existingBindingError } =
    await supabaseAdmin
      .from("mobile_operator_bindings")
      .select("id,profile_id")
      .eq("collaborator_id", collaboratorId)
      .limit(1)
      .maybeSingle();

  if (existingBindingError) {
    throw new Error(
      `Não foi possível verificar o vínculo Mobile do colaborador: ${existingBindingError.message}`,
    );
  }

  if (existingBinding && existingBinding.profile_id !== profileId) {
    throw new Error(
      `O colaborador "${matches[0].name}" já está vinculado a outro usuário.`,
    );
  }

  if (existingBinding) return;

  const { error: bindingError } = await supabaseAdmin
    .from("mobile_operator_bindings")
    .insert({
      profile_id: profileId,
      collaborator_id: collaboratorId,
    });

  if (bindingError) {
    throw new Error(
      `Não foi possível criar o vínculo Mobile do usuário: ${bindingError.message}`,
    );
  }
}

async function createUser(body: Record<string, unknown>) {
  const email =
    typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const username =
    typeof body.username === "string"
      ? body.username.trim().toLowerCase()
      : "";
  const name =
    typeof body.name === "string" ? body.name.trim() : "";
  const password =
    typeof body.password === "string" ? body.password : "";
  const role = typeof body.role === "string"
    ? body.role.trim().toLowerCase()
    : "";

  if (!email || !username || !name || !password || !validRoles.has(role as AppRole)) {
    return json(
      { error: "E-mail, login, nome, senha e perfil são obrigatórios." },
      400,
    );
  }

  if (!email.includes("@")) {
    return json({ error: "E-mail inválido." }, 400);
  }

  if (password.length < 6) {
    return json({ error: "A senha deve possuir pelo menos 6 caracteres." }, 400);
  }

  if (username === "adm") {
    return json({ error: 'O login "adm" é reservado.' }, 400);
  }

  const { data: existingUsername, error: usernameError } =
    await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("username", username)
      .is("deleted_at", null)
      .maybeSingle();

  if (usernameError) {
    console.error("Erro ao verificar login:", usernameError);
    return json({ error: "Não foi possível validar o login." }, 500);
  }

  if (existingUsername) {
    return json({ error: "Este login de usuário já está cadastrado." }, 409);
  }

  const { data: existingAuthUsers, error: authListError } =
    await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });

  if (authListError) {
    console.error("Erro ao verificar e-mail Auth:", authListError);
    return json({ error: "Não foi possível validar o e-mail." }, 500);
  }

  const existingAuthUser = (existingAuthUsers.users ?? []).find(
    (user) => (user.email ?? "").trim().toLowerCase() === email,
  );

  if (existingAuthUser) {
    if (existingAuthUser.deleted_at) {
      try {
        await releaseSoftDeletedEmail(existingAuthUser);
      } catch (error) {
        console.error("Erro ao liberar e-mail de conta já excluída:", error);
        return json(
          { error: "O e-mail pertence a uma conta já excluída, mas não pôde ser liberado com segurança." },
          409,
        );
      }
    } else {
      return json({ error: "Este e-mail já está cadastrado." }, 409);
    }
  }

  const { data: authResult, error: authError } =
    await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

  if (authError || !authResult.user) {
    console.error("Erro ao criar usuário Auth:", authError);
    return json(
      { error: authError?.message ?? "Não foi possível criar o usuário Auth." },
      400,
    );
  }

  const userId = authResult.user.id;

  const { error: profileError } = await supabaseAdmin
    .from("profiles")
    .insert({
      id: userId,
      username,
      name,
      role,
    });

  if (profileError) {
    console.error("Erro ao criar profile:", profileError);

    const { error: rollbackError } =
      await supabaseAdmin.auth.admin.deleteUser(userId);

    if (rollbackError) {
      console.error("Erro ao desfazer usuário Auth:", rollbackError);
    }

    return json(
      { error: "Usuário Auth criado, mas o perfil não pôde ser criado." },
      500,
    );
  }

  try {
    await bindMatchingCollaborator(userId, username);
  } catch (error) {
    console.error("Erro ao vincular colaborador Mobile:", error);

    await supabaseAdmin.from("profiles").delete().eq("id", userId);

    const { error: rollbackError } =
      await supabaseAdmin.auth.admin.deleteUser(userId);

    if (rollbackError) {
      console.error("Erro ao desfazer usuário Auth após falha no vínculo:", rollbackError);
    }

    return json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Não foi possível configurar o vínculo Mobile do usuário.",
      },
      409,
    );
  }

  return json(
    {
      user: {
        id: userId,
        email,
        username,
        name,
        role,
      },
    },
    201,
  );
}

async function updatePassword(
  body: Record<string, unknown>,
  currentUserId: string,
) {
  const id = typeof body.id === "string" ? body.id.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!id || !password) {
    return json({ error: "ID do usuário e nova senha são obrigatórios." }, 400);
  }

  if (password.length < 6) {
    return json({ error: "A senha deve possuir pelo menos 6 caracteres." }, 400);
  }

  const { data: targetProfile, error: profileError } =
    await supabaseAdmin
      .from("profiles")
      .select("id,username")
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle();

  if (profileError) {
    console.error("Erro ao localizar profile para alteração de senha:", profileError);
    return json({ error: "Não foi possível localizar o usuário." }, 500);
  }

  if (!targetProfile) {
    return json({ error: "Usuário não encontrado ou já excluído." }, 404);
  }

  const { error: passwordError } =
    await supabaseAdmin.auth.admin.updateUserById(id, {
      password,
    });

  if (passwordError) {
    console.error("Erro ao alterar senha:", passwordError);
    return json(
      { error: passwordError.message || "Não foi possível alterar a senha." },
      400,
    );
  }

  return json({ success: true });
}

async function updateRole(
  body: Record<string, unknown>,
  currentUserId: string,
) {
  const id = typeof body.id === "string" ? body.id.trim() : "";
  const role = typeof body.role === "string"
    ? body.role.trim().toLowerCase()
    : "";

  if (!id || !validRoles.has(role as AppRole)) {
    return json({ error: "ID do usuário e perfil válido são obrigatórios." }, 400);
  }

  if (id === currentUserId) {
    return json(
      { error: "O Administrador atual não pode alterar o próprio perfil." },
      400,
    );
  }

  const { data: targetProfile, error: profileError } =
    await supabaseAdmin
      .from("profiles")
      .select("id,username,role")
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle();

  if (profileError) {
    console.error("Erro ao localizar profile para alteração de perfil:", profileError);
    return json({ error: "Não foi possível localizar o usuário." }, 500);
  }

  if (!targetProfile) {
    return json({ error: "Usuário não encontrado ou já excluído." }, 404);
  }

  if (targetProfile.username === "adm" && role !== "administrador") {
    return json(
      { error: "A conta administrativa principal deve permanecer como Administrador." },
      400,
    );
  }

  const { error: updateError } = await supabaseAdmin
    .from("profiles")
    .update({ role })
    .eq("id", id)
    .is("deleted_at", null);

  if (updateError) {
    console.error("Erro ao alterar perfil:", updateError);
    return json({ error: "Não foi possível alterar o perfil do usuário." }, 500);
  }

  if (role === "producao" || role === "apoio") {
    try {
      await bindMatchingCollaborator(targetProfile.id, targetProfile.username);
    } catch (error) {
      console.error("Erro ao garantir vínculo Mobile após alteração de perfil:", error);

      const { error: rollbackRoleError } = await supabaseAdmin
        .from("profiles")
        .update({ role: targetProfile.role })
        .eq("id", id)
        .is("deleted_at", null);

      if (rollbackRoleError) {
        console.error("Erro ao desfazer alteração de perfil:", rollbackRoleError);
      }

      return json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Não foi possível configurar o vínculo Mobile do usuário.",
        },
        409,
      );
    }
  }

  const { error: logError } = await supabaseAdmin
    .from("production_logs")
    .insert({
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      type: "PERFIL_ATUALIZACAO",
      description: `Perfil de acesso de ${targetProfile.username} alterado de ${targetProfile.role} para ${role} pelo administrador.`,
      operator: targetProfile.username,
      reference_id: targetProfile.id,
    });

  if (logError) {
    console.error("Erro ao registrar auditoria de alteração de perfil:", logError);
  }

  return json({ success: true, role });
}

async function deleteUser(
  body: Record<string, unknown>,
  currentUserId: string,
) {
  const id = typeof body.id === "string" ? body.id.trim() : "";

  if (!id) {
    return json({ error: "ID do usuário é obrigatório." }, 400);
  }

  if (id === currentUserId) {
    return json(
      { error: "O usuário administrador atual não pode excluir a própria conta." },
      400,
    );
  }

  const { data: targetProfile, error: profileError } =
    await supabaseAdmin
      .from("profiles")
      .select("id,username,deleted_at")
      .eq("id", id)
      .maybeSingle();

  if (profileError) {
    console.error("Erro ao localizar profile:", profileError);
    return json({ error: "Não foi possível localizar o usuário." }, 500);
  }

  if (!targetProfile || targetProfile.deleted_at) {
    return json({ error: "Usuário não encontrado ou já excluído." }, 404);
  }

  if (targetProfile.username === "adm") {
    return json({ error: "A conta administrativa principal é protegida." }, 400);
  }

  const { error: markDeletedError } = await supabaseAdmin
    .from("profiles")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .is("deleted_at", null);

  if (markDeletedError) {
    console.error("Erro ao marcar profile como excluído:", markDeletedError);
    return json({ error: "Não foi possível iniciar a exclusão do usuário." }, 500);
  }

  try {
    await permanentlyDeleteAuthAccount(id);
  } catch (error) {
    console.error("Erro ao excluir conta Auth:", error);

    const { error: rollbackError } = await supabaseAdmin
      .from("profiles")
      .update({ deleted_at: null })
      .eq("id", id);

    if (rollbackError) {
      console.error("Erro ao desfazer marcação de exclusão:", rollbackError);
    }

    return json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Não foi possível excluir a conta Auth.",
      },
      409,
    );
  }

  return json({ success: true });
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return json({ error: "Método não permitido." }, 405);
  }

  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
    return json({ error: "Configuração segura da função não encontrada." }, 500);
  }

  try {
    const administrator = await getAdministrator(request);

    if ("error" in administrator) {
      return administrator.error;
    }

    let body: Record<string, unknown>;

    try {
      body = await request.json();
    } catch {
      return json({ error: "Corpo da requisição inválido." }, 400);
    }

    const operation =
      typeof body.operation === "string" ? body.operation : "";

    switch (operation) {
      case "list":
        return await listUsers();
      case "create":
        return await createUser(body);
      case "delete":
        return await deleteUser(body, administrator.user.id);
      case "update-password":
        return await updatePassword(body, administrator.user.id);
      case "update-role":
        return await updateRole(body, administrator.user.id);
      default:
        return json({ error: "Operação inválida." }, 400);
    }
  } catch (error) {
    console.error("Erro inesperado em admin-users:", error);
    return json(
      { error: error instanceof Error ? error.message : "Erro interno." },
      500,
    );
  }
});
