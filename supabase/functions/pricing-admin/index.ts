// Plans, founder offer and promo codes for Admin → Plans, pricing & promotions.
//   list    — Stripe prices in use, promo codes (with uses), founder offer status and how many founding families
//   create  — a new promo code: "A$X per month for N months" (monthly plan), optional limit and expiry   [admin]
//   set_active — switch a promo code on/off                                                                [admin]
// Prices themselves are never edited here: a price change is a new Stripe price, so existing members keep theirs.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { ANON_KEY, asServer, cors, json, staffRoles, SUPABASE_URL } from "../_shared/http.ts";
import { PLAN_LOOKUP_KEYS, stripe } from "../_shared/stripe.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const auth = req.headers.get("Authorization") ?? "";
    const roles = await staffRoles(auth);
    const isAdmin = roles.includes("admin");
    if (!isAdmin && !roles.includes("finance")) return json({ error: "Admin or finance staff only" }, 403);
    const body = await req.json().catch(() => ({}));
    const action: string = body.action ?? "list";

    if (action === "list") {
      const prices = (await stripe("/prices", { params: { lookup_keys: Object.values(PLAN_LOOKUP_KEYS), active: true, limit: 10 } })).data ?? [];
      const codes = (await stripe("/promotion_codes", { params: { limit: 100 } })).data ?? [];
      const founders = (await asServer(`billing_invoices?price_lookup_key=eq.${PLAN_LOOKUP_KEYS.founder_monthly}&select=household_id`)).data ?? [];
      const foundersPaying = (await asServer(`entitlements?plan_key=eq.${PLAN_LOOKUP_KEYS.founder_monthly}&status=in.(active,trialing,past_due)&select=household_id`)).data ?? [];
      const settings = (await asServer("pricing_settings?id=eq.1&select=*")).data?.[0] ?? null;
      return json({
        ok: true,
        prices: prices.map((p: any) => ({ id: p.id, lookup_key: p.lookup_key, nickname: p.nickname, amount_minor: p.unit_amount, interval: p.recurring?.interval })),
        promo_codes: codes.map((c: any) => ({
          id: c.id, code: c.code, active: c.active, times_redeemed: c.times_redeemed, max_redemptions: c.max_redemptions,
          expires_at: c.expires_at ? new Date(c.expires_at * 1000).toISOString() : null,
          plan: c.metadata?.plan ?? c.coupon?.metadata?.plan ?? null,
          label: c.coupon?.name, amount_off_minor: c.coupon?.amount_off, months: c.coupon?.duration_in_months ?? null, duration: c.coupon?.duration,
        })),
        founder: { settings, families_ever: new Set(founders.map((r: any) => r.household_id)).size, families_now: foundersPaying.length },
      });
    }

    if (!isAdmin) return json({ error: "Only an admin can change promotions" }, 403);
    const me = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: ANON_KEY, Authorization: auth } }).then((r) => r.json());
    const actor = { actor_user_id: me?.id ?? null, actor_label: me?.email ?? null };

    if (action === "create") {
      const code = String(body.code ?? "").trim().toUpperCase();
      const price = Math.round(Number(body.price_minor));
      const months = Math.round(Number(body.months));
      if (!/^[A-Z0-9]{4,20}$/.test(code)) return json({ error: "Code must be 4–20 letters or numbers" }, 400);
      const ps = (await asServer("pricing_settings?id=eq.1&select=founder_code")).data?.[0];
      if (ps && code === ps.founder_code) return json({ error: "That code is used for the founder offer" }, 400);
      const base = (await stripe("/prices", { params: { lookup_keys: [PLAN_LOOKUP_KEYS.monthly], active: true } })).data?.[0];
      if (!base) return json({ error: "Monthly price not set up" }, 503);
      if (!Number.isInteger(price) || price < 0 || price >= base.unit_amount) return json({ error: `Promo price must be below A$${(base.unit_amount / 100).toFixed(2)}` }, 400);
      if (!Number.isInteger(months) || months < 1 || months > 24) return json({ error: "Months must be 1–24" }, 400);
      const exists = (await stripe("/promotion_codes", { params: { code, limit: 1 } })).data?.[0];
      if (exists) return json({ error: "That code already exists" }, 409);
      const money = `A$${(price / 100).toFixed(2)}`;
      const coupon = await stripe("/coupons", {
        method: "POST",
        params: {
          name: `${money}/month for ${months} month${months === 1 ? "" : "s"}`,
          amount_off: base.unit_amount - price, currency: "aud",
          duration: "repeating", duration_in_months: months,
          applies_to: { products: [base.product] },
          metadata: { plan: "monthly", promo_price_minor: String(price), months: String(months) },
        },
      });
      const max = Number(body.max_redemptions);
      const expires = typeof body.expires_at === "string" && body.expires_at ? Math.floor(new Date(body.expires_at).getTime() / 1000) : undefined;
      const pc = await stripe("/promotion_codes", {
        method: "POST",
        params: {
          coupon: coupon.id, code, metadata: { plan: "monthly" },
          restrictions: { first_time_transaction: true },
          ...(Number.isInteger(max) && max > 0 ? { max_redemptions: max } : {}),
          ...(expires && expires > Date.now() / 1000 ? { expires_at: expires } : {}),
        },
      });
      await asServer("audit_log", {
        method: "POST",
        body: JSON.stringify({ ...actor, area: "pricing", action: "Promo code created", detail: { code, price_minor: price, months, max_redemptions: max || null, expires_at: body.expires_at || null } }),
      });
      return json({ ok: true, id: pc.id, code });
    }

    if (action === "set_active") {
      if (typeof body.id !== "string" || !body.id.startsWith("promo_")) return json({ error: "id required" }, 400);
      const pc = await stripe(`/promotion_codes/${body.id}`, { method: "POST", params: { active: body.active === true } });
      await asServer("audit_log", { method: "POST", body: JSON.stringify({ ...actor, area: "pricing", action: `Promo code ${pc.active ? "switched on" : "switched off"}`, detail: { code: pc.code } }) });
      return json({ ok: true, active: pc.active });
    }
    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    return json({ error: String((e as Error).message ?? e) }, 500);
  }
});
