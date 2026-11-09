// Starts Stripe Checkout (Stripe's own secure payment page) for the signed-in
// family. TEST MODE until launch. The card never touches our servers.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { asServer, asUser, cors, json } from "../_shared/http.ts";
import { safeOrigin } from "../_shared/origins.ts";
import { PLAN_LOOKUP_KEYS, stripe, TRIAL_DAYS, trialEligible } from "../_shared/stripe.ts";

const PUBLIC_PLANS = new Set(["monthly", "annual"]);
const money = (m: number) => `A$${(m / 100).toFixed(2)}`;

type Offer =
  | { kind: "founder"; label: string; lookupKey: string; priceMinor: number }
  | { kind: "promo"; label: string; promotionCode: string; priceMinor: number; months: number | null; thenMinor: number };

/**
 * Resolve an offer code for a plan. FOUNDER (or whatever the admin set) switches to the founder price while the
 * founder offer is open; anything else must be an active Stripe promotion code for that plan.
 * Codes are applied by our server only, so a monthly promo can never be used on the annual plan.
 */
async function resolveOffer(rawCode: string, plan: string, basePrice: any): Promise<Offer | { error: string }> {
  const code = rawCode.trim().toUpperCase();
  if (!/^[A-Z0-9_-]{3,32}$/.test(code)) return { error: "That code doesn’t look right." };
  const ps = (await asServer("pricing_settings?id=eq.1&select=*")).data?.[0];
  if (ps && code === ps.founder_code) {
    if (plan !== "monthly") return { error: "The founding-family price is for the monthly plan." };
    if (!ps.founder_open || (ps.founder_closes_at && new Date(ps.founder_closes_at).getTime() < Date.now())) {
      return { error: "The founding-family offer has closed." };
    }
    if (ps.founder_limit) {
      const used = (await asServer(`billing_invoices?price_lookup_key=eq.${PLAN_LOOKUP_KEYS.founder_monthly}&select=household_id`)).data ?? [];
      if (new Set(used.map((r: any) => r.household_id)).size >= ps.founder_limit) return { error: "All founding-family places have been taken." };
    }
    const fp = (await stripe("/prices", { params: { lookup_keys: [PLAN_LOOKUP_KEYS.founder_monthly], active: true } })).data?.[0];
    if (!fp) return { error: "The founding-family price isn’t set up yet." };
    return { kind: "founder", label: `${money(fp.unit_amount)}/month — founding-family price, yours while you stay a member`, lookupKey: PLAN_LOOKUP_KEYS.founder_monthly, priceMinor: fp.unit_amount };
  }
  const pc = (await stripe("/promotion_codes", { params: { code, active: true, limit: 1 } })).data?.[0];
  const coupon = pc?.coupon;
  if (!pc || !coupon?.valid) return { error: "That code isn’t valid or has expired." };
  const forPlan = pc.metadata?.plan ?? coupon.metadata?.plan;
  if (forPlan && forPlan !== plan) return { error: `That code is for the ${forPlan} plan.` };
  const unit = basePrice.unit_amount as number;
  const priceMinor = coupon.amount_off ? Math.max(0, unit - coupon.amount_off) : Math.round(unit * (1 - (coupon.percent_off ?? 0) / 100));
  const months = coupon.duration === "repeating" ? coupon.duration_in_months : coupon.duration === "once" ? 1 : null;
  const per = plan === "annual" ? "year" : "month";
  const label = months
    ? `${money(priceMinor)}/${per} for ${months} ${months === 1 ? per : per + "s"}, then ${money(unit)}/${per}`
    : `${money(priceMinor)}/${per} while you stay a member`;
  return { kind: "promo", label, promotionCode: pc.id, priceMinor, months, thenMinor: unit };
}

const GRANTS = new Set(["active", "trialing", "past_due"]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const auth = req.headers.get("Authorization") ?? "";
    const { plan, origin, referral_code, check, offer_code, check_offer } = await req.json();
    if ((!check || check_offer) && !PUBLIC_PLANS.has(plan)) return json({ error: "Unknown plan" }, 400);
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

    const base = (await stripe("/prices", { params: { lookup_keys: [PLAN_LOOKUP_KEYS[plan as "monthly" | "annual"]], active: true } })).data?.[0];
    if (!base) return json({ error: "This plan isn't set up yet" }, 503);
    let offer: Offer | null = null;
    if (typeof offer_code === "string" && offer_code.trim()) {
      const o = await resolveOffer(offer_code, plan, base);
      if ("error" in o) return json({ error: o.error, offer_invalid: true }, 400);
      offer = o;
    }
    // "check_offer" only validates the code for the Join page (no checkout yet).
    if (check_offer) return json({ ok: true, offer: offer && { kind: offer.kind, label: offer.label, price_minor: offer.priceMinor }, trialDays: eligible ? TRIAL_DAYS : 0 });
    const price = offer?.kind === "founder"
      ? (await stripe("/prices", { params: { lookup_keys: [offer.lookupKey], active: true } })).data?.[0]
      : base;
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

    const meta = {
      household_id: household,
      ...(code ? { referral_code: code } : {}),
      ...(offer ? { offer: offer.kind, offer_code: String(offer_code).trim().toUpperCase() } : {}),
    };
    // Plain-English terms shown next to the button on Stripe's page (subscription disclosure).
    const amount = `A$${(price.unit_amount / 100).toFixed(2)}`;
    const per = price.recurring?.interval === "year" ? "year" : "month";
    const firstCharge = new Date(Date.now() + TRIAL_DAYS * 86_400_000).toLocaleDateString("en-AU", {
      timeZone: "Australia/Sydney", day: "numeric", month: "long", year: "numeric",
    });
    const pricePhrase = offer?.kind === "promo"
      ? (offer.months
        ? `${money(offer.priceMinor)} per ${per} for ${offer.months} ${per}s, then ${amount} per ${per}`
        : `${money(offer.priceMinor)} per ${per}`)
      : offer?.kind === "founder"
        ? `${amount} per ${per} as a founding family, kept for as long as your membership continues`
        : `${amount} per ${per}`;
    const terms = eligible
      ? `Free for ${TRIAL_DAYS} days. Then ${pricePhrase} (GST included), first charged on ${firstCharge} and renewing every ${per} until you cancel. Cancel online anytime in your family account — cancel before ${firstCharge} and you won't be charged. One free trial per family.`
      : `${pricePhrase} (GST included), charged today and renewing every ${per} until you cancel. Cancel online anytime in your family account; access continues to the end of the paid period.`;
    const session = await stripe("/checkout/sessions", {
      method: "POST",
      params: {
        mode: "subscription",
        customer,
        client_reference_id: household,
        line_items: [{ price: price.id, quantity: 1 }],
        // Codes are checked and applied by us (so a code only works on the plan it was made for).
        ...(offer?.kind === "promo" ? { discounts: [{ promotion_code: offer.promotionCode }] } : {}),
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
