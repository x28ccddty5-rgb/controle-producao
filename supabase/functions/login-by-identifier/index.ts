import { createClient } from "npm:@supabase/supabase-js@2";

type LoginBody = {
  identifier?: string;
  password?: string;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const anonKey = Deno.env.get("SUPABASE_ANON_KEY");

const adminClient =
  supabaseUrl && serviceRoleKey
    ? createClient(supabaseUrl, serviceRoleKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      })
    : null;

const authClient =
  supabaseUrl && anonKey
    ? createClient(supabaseUrl, anonKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      })
    : null;

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Método não permitido." }, 405);
  }

  if (!adminClient || !authClient) {
    console.error("Supabase Auth não está configurado no runtime.");
    return json({ error: "Configuração de autenticação indisponível." }, 500);
  }

  let body: LoginBody;

  try {
    body = await req.json();
  } catch {
    return json({ error: "Requisição inválida." }, 400);
  }

  const identifier = body.identifier?.trim();
  const password = body.password;

  if (!identifier || !password) {
    return json(
      { error: "Informe o usuário/e-mail e a senha." },
      400,
    );
  }

  let authEmail: string | null = null;
  let authUserId: string | null = null;

  if (identifier.includes("@")) {
    authEmail = identifier.toLowerCase();
  } else {
    const normalizedIdentifier = identifier.toLowerCase();

    const { data: usernameProfiles, error: usernameError } =
      await adminClient
        .from("profiles")
        .select("id,username,name,role")
        .ilike("username", normalizedIdentifier)
        .is("deleted_at", null)
        .limit(2);

    if (usernameError) {
      console.error("Erro ao localizar username:", usernameError);
      return json(
        { error: "Não foi possível localizar o usuário." },
        500,
      );
    }

    let profiles = usernameProfiles ?? [];

    if (profiles.length === 0) {
      const { data: nameProfiles, error: nameError } = await adminClient
        .from("profiles")
        .select("id,username,name,role")
        .ilike("name", normalizedIdentifier)
        .is("deleted_at", null)
        .limit(2);

      if (nameError) {
        console.error("Erro ao localizar nome:", nameError);
        return json(
          { error: "Não foi possível localizar o usuário." },
          500,
        );
      }

      profiles = nameProfiles ?? [];
    }

    if (profiles.length === 0) {
      return json({ error: "Usuário ou senha incorretos." }, 401);
    }

    if (profiles.length > 1) {
      return json(
        {
          error:
            "O identificador informado corresponde a mais de um usuário.",
        },
        409,
      );
    }

    authUserId = profiles[0].id;

    const { data: authUserData, error: authUserError } =
      await adminClient.auth.admin.getUserById(authUserId);

    if (authUserError || !authUserData.user?.email) {
      console.error(
        "Erro ao localizar conta Auth:",
        authUserError,
      );
      return json(
        { error: "Não foi possível localizar a conta de autenticação." },
        500,
      );
    }

    authEmail = authUserData.user.email;
  }

  const { data: authData, error: authError } =
    await authClient.auth.signInWithPassword({
      email: authEmail,
      password,
    });

  if (authError || !authData.user || !authData.session) {
    return json({ error: "Usuário ou senha incorretos." }, 401);
  }

  return json({
    user: {
      id: authData.user.id,
    },
    session: {
      access_token: authData.session.access_token,
      refresh_token: authData.session.refresh_token,
    },
  });
});
