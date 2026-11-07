// Opens Stripe's customer portal: change plan, update card, see invoices, cancel.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { asUser, cors, json } from "../_shared/http.ts";
import { safeOrigin } from "../_shared/origins.ts";
import { stripe } from "../_shared/stripe.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const auth = req.headers.get("Authorization") ?? "";
    const { origin } = await req.json().catch(() => ({}));
    const r = await asUser(auth, "billing_customers?select=stripe_customer_id");
    const customer = r.data?.[0]?.stripe_customer_id;
    if (!customer) return json({ error: "No membership to manage yet" }, 404);
    const s = await stripe("/billing_portal/sessions", {
      method: "POST",
      params: { customer, return_url: `${safeOrigin(origin)}/watch/account/` },
    });
    return json({ url: s.url });
  } catch (e) {
    console.error(e);
    return json({ error: (e as Error).message }, 500);
  }
});
