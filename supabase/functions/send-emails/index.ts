// Sends the emails we owe families (member_notices outbox). Runs every 10 minutes, or on demand by admin/support.
// Words come from packages/domain (renderNotice) — the same tested code as everywhere else.
//
// Delivery:
//   * No email service connected (RESEND_API_KEY not set): the email is rendered and kept as "logged" —
//     readable in Admin → Member emails. Nothing leaves the system.
//   * Email service connected, outside production: only addresses in EMAIL_TEST_ALLOWLIST receive real
//     emails; everyone else is "logged". Test families never get emailed by accident.
//   * Production: sent to the family's sign-in email address.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { asServer, cors, json, staffRoles, SERVICE_KEY, SUPABASE_URL, serverError } from "../_shared/http.ts";
import { renderNotice } from "../_shared/domain.js";

const APP_ENV = Deno.env.get("APP_ENV") ?? "development";
const RESEND_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const FROM = Deno.env.get("EMAIL_FROM") ?? "";
const ALLOW = new Set((Deno.env.get("EMAIL_TEST_ALLOWLIST") ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean));
const ctx = {
  brandName: Deno.env.get("BRAND_NAME") ?? "G.Fit",
  siteUrl: Deno.env.get("SITE_URL") ?? "https://g-fit-liard.vercel.app",
  supportEmail: Deno.env.get("SUPPORT_EMAIL") || undefined,
};
const MAX_ATTEMPTS = 5;
// Where System health problems are emailed (comma-separated). Not set → shown in Admin → System health only.
const ALERT_TO = (Deno.env.get("ALERT_EMAIL") ?? "").split(",").map((s) => s.trim()).filter(Boolean);

/** Email admins about NEW errors from the last day (each problem once; a fixed problem that comes back alerts again). */
async function sendAlerts() {
  if (!RESEND_KEY || !FROM || ALERT_TO.length === 0) return 0;
  const since = new Date(Date.now() - 86400_000).toISOString();
  const rows = (await asServer(`system_events?level=eq.error&resolved_at=is.null&alerted_at=is.null&last_at=gte.${since}&select=id,title,source,count,first_at&order=last_at.desc&limit=20`)).data ?? [];
  if (!rows.length) return 0;
  const site = ctx.siteUrl.replace(/\/$/, "");
  const lines = rows.map((r: any) => `• ${r.title} (${r.source}, ${r.count}×, first ${new Date(r.first_at).toLocaleString("en-AU", { timeZone: "Australia/Sydney" })})`);
  const text = `${rows.length} new problem${rows.length === 1 ? "" : "s"} in ${ctx.brandName}${APP_ENV === "production" ? "" : ` (${APP_ENV})`}:\n\n${lines.join("\n")}\n\nDetails and "mark resolved": ${site}/admin/health/`;
  const esc = (x: string) => x.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  await deliver(ALERT_TO.join(","), { subject: `[${ctx.brandName}] ${rows.length} new problem${rows.length === 1 ? "" : "s"}`, text, html: `<pre style="font-family:inherit;white-space:pre-wrap">${esc(text)}</pre>` }, `alert-${rows.map((r: any) => r.id).join("-")}`);
  await asServer(`system_events?id=in.(${rows.map((r: any) => r.id).join(",")})`, { method: "PATCH", body: JSON.stringify({ alerted_at: new Date().toISOString() }) });
  return rows.length;
}

async function ownerEmail(household: string): Promise<string | null> {
  const owner = (await asServer(`households?id=eq.${household}&select=owner_user_id`)).data?.[0]?.owner_user_id;
  if (!owner) return null;
  const r = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${owner}`, { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } });
  return r.ok ? ((await r.json())?.email ?? null) : null;
}

async function deliver(to: string, mail: { subject: string; text: string; html: string }, idempotency: string) {
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json", "Idempotency-Key": idempotency },
    body: JSON.stringify({ from: FROM, to: to.split(","), subject: mail.subject, text: mail.text, html: mail.html }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`email service ${r.status}: ${data?.message ?? "error"}`);
  return data?.id as string;
}

async function process(limit: number, onlyId?: number) {
  const q = onlyId
    ? `member_notices?id=eq.${onlyId}&select=*`
    : `member_notices?status=eq.queued&due_at=lte.${new Date().toISOString()}&select=*&order=due_at&limit=${limit}`;
  const rows = (await asServer(q)).data ?? [];
  const out: Record<string, number> = { sent: 0, logged: 0, failed: 0, skipped: 0 };
  for (const n of rows) {
    const patch: Record<string, unknown> = { attempts: (n.attempts ?? 0) + 1 };
    try {
      const mail = renderNotice(n.kind, n.detail ?? {}, ctx);
      const to = await ownerEmail(n.household_id);
      Object.assign(patch, { subject: mail.subject, body_text: mail.text, body_html: mail.html, to_email: to });
      if (!to) {
        Object.assign(patch, { status: "skipped", last_error: "Family has no email address" });
      } else if (!RESEND_KEY || !FROM) {
        Object.assign(patch, { status: "logged", sent_at: new Date().toISOString(), last_error: null });
      } else if (APP_ENV !== "production" && !ALLOW.has(to.toLowerCase())) {
        Object.assign(patch, { status: "logged", sent_at: new Date().toISOString(), last_error: "Not on the test allow-list (not sent)" });
      } else {
        const id = await deliver(to, mail, `notice-${n.id}`);
        Object.assign(patch, { status: "sent", sent_at: new Date().toISOString(), provider_message_id: id, last_error: null });
      }
    } catch (e) {
      const msg = String((e as Error).message ?? e).slice(0, 500);
      Object.assign(patch, { last_error: msg, status: (n.attempts ?? 0) + 1 >= MAX_ATTEMPTS ? "failed" : "queued" });
    }
    await asServer(`member_notices?id=eq.${n.id}`, { method: "PATCH", body: JSON.stringify(patch) });
    out[String(patch.status ?? "queued")] = (out[String(patch.status ?? "queued")] ?? 0) + 1;
  }
  return { processed: rows.length, ...out };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const nonce = req.headers.get("x-cron-nonce");
    if (nonce) {
      const ok = await asServer("rpc/consume_cron_nonce", { method: "POST", body: JSON.stringify({ n: nonce }) });
      if (ok.data !== true) return json({ error: "Not allowed" }, 403);
      const result = await process(50);
      const alerts = await sendAlerts().catch(() => 0);
      return json({ ok: true, ...result, alerts });
    }
    const roles = await staffRoles(req.headers.get("Authorization") ?? "");
    if (!roles.includes("admin") && !roles.includes("support")) return json({ error: "Admin or support staff only" }, 403);
    const body = await req.json().catch(() => ({}));
    if (body.action === "retry" && Number.isInteger(body.id)) {
      await asServer(`member_notices?id=eq.${body.id}&status=in.(failed,skipped)`, { method: "PATCH", body: JSON.stringify({ status: "queued", attempts: 0 }) });
      return json({ ok: true, ...(await process(1, body.id)) });
    }
    if (body.action === "status") {
      return json({ ok: true, provider: RESEND_KEY && FROM ? "connected" : "not-connected", production: APP_ENV === "production", allowlist: ALLOW.size, from: FROM || null, alerts_to: ALERT_TO.length });
    }
    return json({ ok: true, ...(await process(50)) });
  } catch (e) {
    return serverError("send-emails", e);
  }
});
