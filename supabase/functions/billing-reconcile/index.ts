// Daily safety net (pg_cron, single-use code) — or admin/finance "Check now".
// Re-reads every Stripe membership and recent invoices so our records match Stripe
// even if a webhook was ever missed.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { asServer, cors, json, staffRoles, serverError } from "../_shared/http.ts";
import { stripe, syncInvoice, syncSubscription } from "../_shared/stripe.ts";
import { runTestScenario } from "../_shared/stripe-test.ts";

async function authorised(req: Request) {
  const nonce = req.headers.get("x-cron-nonce");
  if (nonce) return (await asServer("rpc/consume_cron_nonce", { method: "POST", body: JSON.stringify({ n: nonce }) })).data === true;
  const roles = await staffRoles(req.headers.get("Authorization") ?? "");
  return roles.includes("admin") || roles.includes("finance");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    if (!(await authorised(req))) return json({ error: "not allowed" }, 403);
    const body = await req.json().catch(() => ({}));
    if (body.health) {
      // Which Stripe account the stored key belongs to, and whether it's test mode. No secrets returned.
      const acct = await stripe("/account");
      const bal = await stripe("/balance");
      return json({ ok: true, account: acct.id, name: acct.settings?.dashboard?.display_name ?? null, livemode: bal.livemode === true, webhookSecretSet: Boolean(Deno.env.get("STRIPE_WEBHOOK_SECRET")) });
    }
    // Test-only scenarios (refuse to run with a live key or in production) — admin/finance only, never via cron.
    if (body.test && !req.headers.get("x-cron-nonce")) return json({ ok: true, result: await runTestScenario(body.test) });
    const customers = (await asServer("billing_customers?select=stripe_customer_id")).data ?? [];
    let subs = 0, invoices = 0;
    const changes: string[] = [];
    for (const c of customers) {
      const list = await stripe("/subscriptions", { params: { customer: c.stripe_customer_id, status: "all", limit: 10 } });
      // Newest last so the current subscription is the one that sticks.
      for (const s of [...(list.data ?? [])].reverse()) {
        changes.push(await syncSubscription(s.id));
        subs++;
      }
      const inv = await stripe("/invoices", { params: { customer: c.stripe_customer_id, limit: 12 } });
      for (const i of inv.data ?? []) {
        await syncInvoice(i.id);
        invoices++;
      }
    }
    return json({ ok: true, customers: customers.length, subscriptions: subs, invoices, changes });
  } catch (e) {
    console.error(e);
    return serverError("billing-reconcile", e);
  }
});
