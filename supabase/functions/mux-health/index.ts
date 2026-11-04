// Staff-only check that the Mux secrets are present and work. Never returns secret values.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { json, staffRoles } from "../_shared/http.ts";

Deno.serve(async (req) => {
  const roles = await staffRoles(req.headers.get("Authorization") ?? "");
  if (roles.length === 0) return json({ error: "staff only" }, 403);
  const id = Deno.env.get("MUX_TOKEN_ID") ?? "";
  const secret = Deno.env.get("MUX_TOKEN_SECRET") ?? "";
  const out: Record<string, unknown> = {
    MUX_TOKEN_ID: !!id,
    MUX_TOKEN_SECRET: !!secret,
    MUX_SIGNING_KEY_ID: !!Deno.env.get("MUX_SIGNING_KEY_ID"),
    MUX_SIGNING_PRIVATE_KEY: !!Deno.env.get("MUX_SIGNING_PRIVATE_KEY"),
    MUX_WEBHOOK_SECRET: !!Deno.env.get("MUX_WEBHOOK_SECRET"),
  };
  if (id && secret) {
    const r = await fetch("https://api.mux.com/video/v1/assets?limit=1", { headers: { Authorization: "Basic " + btoa(`${id}:${secret}`) } });
    out.mux_api_status = r.status;
  }
  return json(out);
});
