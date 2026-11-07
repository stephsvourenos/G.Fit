// TEST-ONLY billing scenarios for automated checks. Refuses to run unless the
// Stripe key is a TEST key and APP_ENV is not production. Uses Stripe's official
// test cards (pm_card_visa etc.). Callers must already be admin/finance.
import { asServer } from "./http.ts";
import { isProduction, PLAN_LOOKUP_KEYS, stripe, type Plan } from "./stripe.ts";

const CARDS: Record<string, string> = {
  visa: "pm_card_visa",
  decline: "pm_card_chargeDeclined", // declined when attaching
  fail_later: "pm_card_chargeCustomerFail", // attaches fine, charges fail
};

export async function runTestScenario(b: Record<string, any>) {
  const key = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
  if (isProduction || !key.startsWith("sk_test_")) throw new Error("Test scenarios only run with a Stripe TEST key outside production");
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
      try {
        await setCard(b.card ?? "visa");
      } catch (e) {
        return { declined: true, message: (e as Error).message };
      }
      const meta = { household_id: household, ...(b.referral_code ? { referral_code: b.referral_code } : {}) };
      const s = await stripe("/subscriptions", {
        method: "POST",
        params: { customer: cust, items: [{ price: await price(b.plan ?? "monthly") }], metadata: meta, payment_behavior: "allow_incomplete" },
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
