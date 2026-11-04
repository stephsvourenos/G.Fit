// Small helpers shared by the Edge Functions.
export const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

export const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
export const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
export const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

/** PostgREST call as the signed-in user (Row-Level Security applies). */
export async function asUser(auth: string, path: string, init: RequestInit = {}) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: ANON_KEY, Authorization: auth, "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
  const text = await r.text();
  return { ok: r.ok, status: r.status, data: text ? JSON.parse(text) : null };
}

/** PostgREST call as the server (bypasses RLS) — only for writes the user is not allowed to make directly. */
export async function asServer(path: string, init: RequestInit = {}) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json",
      Prefer: "return=representation", ...(init.headers ?? {}),
    },
  });
  const text = await r.text();
  return { ok: r.ok, status: r.status, data: text ? JSON.parse(text) : null };
}

export async function staffRoles(auth: string): Promise<string[]> {
  const r = await asUser(auth, "staff_members?select=role");
  return r.ok && Array.isArray(r.data) ? r.data.map((x: { role: string }) => x.role) : [];
}
