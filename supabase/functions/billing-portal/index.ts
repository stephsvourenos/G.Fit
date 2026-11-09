// Opens Stripe's customer portal: change plan, update card, see invoices, cancel.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { asUser, cors, json, serverError } from "../_shared/http.ts";
import { safeOrigin } from "../_shared/origins.ts";
import { stripe } from "../_shared/stripe.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const auth = req.headers.get("Authorization") ?? "";
    const { origin } = await req.json().catch(() => ({}));
    // Our own household only — staff accounts can read every family's billing rows.
    const hh = (await asUser(auth, "households?select=id")).data?.[0]?.id;
    if (!hh) return json({ error: "Please sign in first" }, 401);
    const r = await asUser(auth, `billing_customers?household_id=eq.${hh}&select=stripe_customer_id`);
    const customer = r.data?.[0]?.stripe_customer_id;
    if (!customer) return json({ error: "No membership to manage yet" }, 404);
    const s = await stripe("/billing_portal/sessions", {
      method: "POST",
      params: { customer, return_url: `${safeOrigin(origin)}/watch/account/` },
    });
    return json({ url: s.url });
  } catch (e) {
    console.error(e);
    return serverError("billing-portal", e);
  }
});
