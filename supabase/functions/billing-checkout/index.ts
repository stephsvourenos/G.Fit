// Starts Stripe Checkout (Stripe's own secure payment page) for the signed-in
// family. TEST MODE until launch. The card never touches our servers.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { asServer, asUser, cors, json } from "../_shared/http.ts";
import { safeOrigin } from "../_shared/origins.ts";
import { PLAN_LOOKUP_KEYS, stripe, type Plan } from "../_shared/stripe.ts";

const GRANTS = new Set(["active", "trialing", "past_due"]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const auth = req.headers.get("Authorization") ?? "";
    const { plan, origin, referral_code } = await req.json();
    if (!(plan in PLAN_LOOKUP_KEYS)) return json({ error: "Unknown plan" }, 400);
    const site = safeOrigin(origin);

    const me = await asUser(auth, "households?select=id");
    const household = me.data?.[0]?.id;
    if (!household) return json({ error: "Please sign in first" }, 401);
    const user = await fetch(`${Deno.env.get("SUPABASE_URL")}/auth/v1/user`, {
      headers: { apikey: Deno.env.get("SUPABASE_ANON_KEY")!, Authorization: auth },
    }).then((r) => r.json());

    const ent = (await asServer(`entitlements?household_id=eq.${household}&select=provider,status,current_period_end`)).data?.[0];
    if (ent?.provider === "stripe" && GRANTS.has(ent.status) && new Date(ent.current_period_end).getTime() > Date.now()) {
      return json({ error: "already-member" }, 409);
    }

    const prices = await stripe("/prices", { params: { lookup_keys: [PLAN_LOOKUP_KEYS[plan as Plan]], active: true } });
    const price = prices.data?.[0];
    if (!price) return json({ error: "This plan isn't set up yet" }, 503);

    // One Stripe customer per household.
    let customer = (await asServer(`billing_customers?household_id=eq.${household}&select=stripe_customer_id`)).data?.[0]?.stripe_customer_id;
    if (!customer) {
      const c = await stripe("/customers", {
        method: "POST",
        params: { email: user?.email, metadata: { household_id: household } },
        idempotencyKey: `customer-${household}`,
      });
      customer = c.id;
      await asServer("billing_customers", {
        method: "POST",
        headers: { Prefer: "return=minimal,resolution=ignore-duplicates" },
        body: JSON.stringify({ household_id: household, stripe_customer_id: customer, livemode: c.livemode === true }),
      });
    }

    // Referral code (from the creator's link) travels with the subscription; credited on the first paid invoice.
    let code: string | undefined;
    if (typeof referral_code === "string" && /^[A-Za-z0-9_-]{3,32}$/.test(referral_code)) {
      const c = await asServer(`creators?referral_code=eq.${encodeURIComponent(referral_code)}&status=eq.active&select=id`);
      if (c.data?.length) code = referral_code;
    }

    const meta = { household_id: household, ...(code ? { referral_code: code } : {}) };
    const session = await stripe("/checkout/sessions", {
      method: "POST",
      params: {
        mode: "subscription",
        customer,
        client_reference_id: household,
        line_items: [{ price: price.id, quantity: 1 }],
        allow_promotion_codes: true,
        billing_address_collection: "auto",
        metadata: meta,
        subscription_data: { metadata: meta },
        success_url: `${site}/watch/account/?checkout=success`,
        cancel_url: `${site}/watch/account/?checkout=cancelled`,
      },
    });
    return json({ url: session.url });
  } catch (e) {
    console.error(e);
    return json({ error: (e as Error).message }, 500);
  }
});
