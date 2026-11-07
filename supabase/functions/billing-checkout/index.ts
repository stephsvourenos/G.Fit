// Starts Stripe Checkout (Stripe's own secure payment page) for the signed-in
// family. TEST MODE until launch. The card never touches our servers.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { asServer, asUser, cors, json } from "../_shared/http.ts";
import { safeOrigin } from "../_shared/origins.ts";
import { PLAN_LOOKUP_KEYS, stripe, TRIAL_DAYS, trialEligible, type Plan } from "../_shared/stripe.ts";

const GRANTS = new Set(["active", "trialing", "past_due"]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const auth = req.headers.get("Authorization") ?? "";
    const { plan, origin, referral_code, check } = await req.json();
    if (!check && !(plan in PLAN_LOOKUP_KEYS)) return json({ error: "Unknown plan" }, 400);
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

    const known = (await asServer(`billing_customers?household_id=eq.${household}&select=stripe_customer_id`)).data?.[0]?.stripe_customer_id;
    const eligible = await trialEligible(household, known);
    // "check" only asks whether this family can still have a free trial (for the Join wording).
    if (check) return json({ trialDays: eligible ? TRIAL_DAYS : 0 });

    const prices = await stripe("/prices", { params: { lookup_keys: [PLAN_LOOKUP_KEYS[plan as Plan]], active: true } });
    const price = prices.data?.[0];
    if (!price) return json({ error: "This plan isn't set up yet" }, 503);

    // One Stripe customer per household.
    let customer = known;
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
    // Plain-English terms shown next to the button on Stripe's page (subscription disclosure).
    const amount = `A$${(price.unit_amount / 100).toFixed(2)}`;
    const per = price.recurring?.interval === "year" ? "year" : "month";
    const firstCharge = new Date(Date.now() + TRIAL_DAYS * 86_400_000).toLocaleDateString("en-AU", {
      timeZone: "Australia/Sydney", day: "numeric", month: "long", year: "numeric",
    });
    const terms = eligible
      ? `Free for ${TRIAL_DAYS} days. Then ${amount} per ${per} (GST included), first charged on ${firstCharge} and renewing every ${per} until you cancel. Cancel online anytime in your family account — cancel before ${firstCharge} and you won't be charged. One free trial per family.`
      : `${amount} per ${per} (GST included), charged today and renewing every ${per} until you cancel. Cancel online anytime in your family account; access continues to the end of the paid period.`;
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
        subscription_data: {
          metadata: meta,
          ...(eligible
            ? { trial_period_days: TRIAL_DAYS, trial_settings: { end_behavior: { missing_payment_method: "cancel" } } }
            : {}),
        },
        payment_method_collection: "always", // card required, even for the free trial
        // Cards only (incl. Apple Pay / Google Pay): needed for "one free trial per card"; no buy-now-pay-later.
        payment_method_types: ["card"],
        custom_text: { submit: { message: terms } },
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
