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
    .select("id,username,name,role")
    .eq("id", user.id)
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

  const authUsers = authData.users ?? [];

  if (authUsers.length === 0) {
    return json({ users: [] });
  }

  const ids = authUsers.map((user) => user.id);

  const { data: profiles, error: profilesError } = await supabaseAdmin
    .from("profiles")
    .select("id,username,name,role")
    .in("id", ids);

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

  const emailExists = (existingAuthUsers.users ?? []).some(
    (user) => (user.email ?? "").trim().toLowerCase() === email,
  );

  if (emailExists) {
    return json({ error: "Este e-mail já está cadastrado." }, 409);
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
      .select("id,username")
      .eq("id", id)
      .maybeSingle();

  if (profileError) {
    console.error("Erro ao localizar profile:", profileError);
    return json({ error: "Não foi possível localizar o usuário." }, 500);
  }

  if (!targetProfile) {
    return json({ error: "Usuário não encontrado." }, 404);
  }

  if (targetProfile.username === "adm") {
    return json({ error: "A conta administrativa principal é protegida." }, 400);
  }

  const { error: deleteError } =
    await supabaseAdmin.auth.admin.deleteUser(targetProfile.id);

  if (deleteError) {
    console.error("Erro ao excluir usuário Auth:", deleteError);
    return json(
      { error: deleteError.message || "Não foi possível excluir o usuário." },
      400,
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
