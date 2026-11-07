// Daily safety net (pg_cron, single-use code) — or admin/finance "Check now".
// Re-reads every Stripe membership and recent invoices so our records match Stripe
// even if a webhook was ever missed.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { asServer, cors, json, staffRoles } from "../_shared/http.ts";
import { stripe, syncInvoice, syncSubscription } from "../_shared/stripe.ts";

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
    return json({ error: (e as Error).message }, 500);
  }
});
