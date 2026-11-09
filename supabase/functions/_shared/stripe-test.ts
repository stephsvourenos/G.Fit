// TEST-ONLY billing scenarios for automated checks. Refuses to run unless the
// Stripe key is a TEST key and APP_ENV is not production. Uses Stripe's official
// test cards (pm_card_visa etc.). Callers must already be admin/finance.
import { asServer } from "./http.ts";
import { isProduction, PLAN_LOOKUP_KEYS, stripe, TRIAL_DAYS, type Plan } from "./stripe.ts";

const CARDS: Record<string, string> = {
  visa: "pm_card_visa",
  mastercard: "pm_card_mastercard",
  decline: "pm_card_chargeDeclined", // declined when attaching
  fail_later: "pm_card_chargeCustomerFail", // attaches fine, charges fail
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Stripe "test clock": a throw-away customer whose time we fast-forward month by month, to prove what a
 * subscription is charged over many months (promo ending, founder price staying). Not linked to any family.
 */
async function clockRun(b: Record<string, any>) {
  const start = Math.floor(Date.now() / 1000);
  const clock = await stripe("/test_helpers/test_clocks", { method: "POST", params: { frozen_time: start, name: `gfit ${b.plan} ${b.promo ?? ""}` } });
  try {
    const cust = await stripe("/customers", { method: "POST", params: { test_clock: clock.id, payment_method: "pm_card_visa", invoice_settings: { default_payment_method: "pm_card_visa" }, metadata: { purpose: "test-clock" } } });
    let promo: string | undefined;
    if (b.promo) promo = (await stripe("/promotion_codes", { params: { code: b.promo, active: true, limit: 1 } })).data?.[0]?.id;
    const price = (await stripe("/prices", { params: { lookup_keys: [PLAN_LOOKUP_KEYS[b.plan as Plan]], active: true } })).data[0].id;
    const sub = await stripe("/subscriptions", {
      method: "POST",
      params: { customer: cust.id, items: [{ price }], ...(promo ? { promotion_code: promo } : {}), ...(b.trial ? { trial_period_days: TRIAL_DAYS } : {}) },
    });
    let t = start;
    const months = Math.min(Number(b.months ?? 8), 14);
    for (let i = 0; i < months; i++) {
      const d = new Date(t * 1000);
      d.setUTCMonth(d.getUTCMonth() + 1);
      t = Math.floor(d.getTime() / 1000) + (i === 0 && b.trial ? TRIAL_DAYS * 86400 : 0);
      await stripe(`/test_helpers/test_clocks/${clock.id}/advance`, { method: "POST", params: { frozen_time: t } });
      for (let k = 0; k < 40; k++) {
        await sleep(1500);
        if ((await stripe(`/test_helpers/test_clocks/${clock.id}`)).status === "ready") break;
      }
    }
    const inv = await stripe("/invoices", { params: { subscription: sub.id, limit: 30 } });
    return {
      promo: b.promo ?? null, plan: b.plan, trial: !!b.trial,
      charges: inv.data.slice().reverse().map((i: any) => ({ date: new Date(i.created * 1000).toISOString().slice(0, 10), paid_minor: i.amount_paid, status: i.status })),
    };
  } finally {
    await stripe(`/test_helpers/test_clocks/${clock.id}`, { method: "DELETE" }).catch(() => null);
  }
}

export async function runTestScenario(b: Record<string, any>) {
  const key = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
  if (isProduction || !key.startsWith("sk_test_")) throw new Error("Test scenarios only run with a Stripe TEST key outside production");
  if (b.action === "clock_run") return await clockRun(b);
  const household = String(b.household_id ?? "");
  const cust = (await asServer(`billing_customers?household_id=eq.${household}&select=stripe_customer_id`)).data?.[0]?.stripe_customer_id;
  if (!cust) throw new Error("household has no Stripe customer yet");
  const ent = (await asServer(`entitlements?household_id=eq.${household}&select=provider,provider_subscription_id`)).data?.[0];
  const subId = ent?.provider === "stripe" ? ent.provider_subscription_id : undefined;
  const price = async (plan: Plan) => (await stripe("/prices", { params: { lookup_keys: [PLAN_LOOKUP_KEYS[plan]], active: true } })).data[0].id;
  const setCard = async (card: string) => {
    const pm = await stripe(`/payment_methods/${CARDS[card]}/attach`, { method: "POST", params: { customer: cust } });
    await stripe(`/customers/${cust}`, { method: "POST", params: { invoice_settings: { default_payment_method: pm.id } } });
    return pm.id;
  };

  switch (b.action) {
    case "subscribe": {
      let pmId: string;
      try {
        pmId = await setCard(b.card ?? "visa");
      } catch (e) {
        return { declined: true, message: (e as Error).message };
      }
      const meta = { household_id: household, ...(b.referral_code ? { referral_code: b.referral_code } : {}) };
      const promo = b.promo ? (await stripe("/promotion_codes", { params: { code: b.promo, active: true, limit: 1 } })).data?.[0]?.id : undefined;
      const s = await stripe("/subscriptions", {
        method: "POST",
        params: {
          customer: cust,
          items: [{ price: await price(b.plan ?? "monthly") }],
          metadata: meta,
          payment_behavior: "allow_incomplete",
          ...(promo ? { promotion_code: promo } : {}),
          ...(b.trial ? { trial_period_days: TRIAL_DAYS, default_payment_method: pmId } : {}),
        },
      });
      return { subscription: s.id, status: s.status };
    }
    case "set_card":
      return { pm: await setCard(b.card) };
    case "switch": {
      const s = await stripe(`/subscriptions/${subId}`);
      const u = await stripe(`/subscriptions/${subId}`, {
        method: "POST",
        params: { items: [{ id: s.items.data[0].id, price: await price(b.plan) }], proration_behavior: "always_invoice", payment_behavior: "allow_incomplete" },
      });
      return { status: u.status };
    }
    case "cancel_at_end":
      return { cancel_at_period_end: (await stripe(`/subscriptions/${subId}`, { method: "POST", params: { cancel_at_period_end: true } })).cancel_at_period_end };
    case "resume":
      return { cancel_at_period_end: (await stripe(`/subscriptions/${subId}`, { method: "POST", params: { cancel_at_period_end: false } })).cancel_at_period_end };
    case "end_trial":
      return { status: (await stripe(`/subscriptions/${subId}`, { method: "POST", params: { trial_end: "now" } })).status };
    case "cancel_now":
      return { status: (await stripe(`/subscriptions/${subId}`, { method: "DELETE" })).status };
    case "refund_latest": {
      const ch = await stripe("/charges", { params: { customer: cust, limit: 1 } });
      const r = await stripe("/refunds", { method: "POST", params: { charge: ch.data[0].id, ...(b.amount ? { amount: b.amount } : {}) } });
      return { refund: r.id, amount: r.amount };
    }
    default:
      throw new Error("unknown test action");
  }
}
