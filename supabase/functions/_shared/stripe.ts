// Stripe helpers shared by the billing Edge Functions. The secret key lives only
// in Supabase Edge Function secrets. Refuses a LIVE key unless APP_ENV=production.
import { asServer } from "./http.ts";
import { acceptsNewReferrals } from "./domain.js";

const KEY = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
const APP_ENV = Deno.env.get("APP_ENV") ?? "development";
/** Pinned so field names never shift under us when Stripe releases a new API version. */
const API_VERSION = "2024-06-20";

export const isProduction = APP_ENV === "production";

/** Our Stripe Prices are found by lookup key. A price change = new Price + new key; existing members keep theirs. */
export const PLAN_LOOKUP_KEYS = {
  monthly: "gfit_family_monthly_aud_v1",
  annual: "gfit_family_annual_aud_v1",
  /** Founding families: A$9.99/month, kept for as long as the membership continues (grandfathered). */
  founder_monthly: "gfit_family_monthly_founder_aud_v1",
} as const;
export type Plan = keyof typeof PLAN_LOOKUP_KEYS;

/** Free trial length (days). One trial per household and per card. 0 switches trials off. */
export const TRIAL_DAYS = 7;

export function assertSafeKey() {
  if (!KEY) throw new Error("Stripe is not configured (STRIPE_SECRET_KEY missing)");
  if (KEY.startsWith("sk_live_") || KEY.startsWith("rk_live_")) {
    if (!isProduction) throw new Error("Refusing to use a LIVE Stripe key outside production");
  }
}

function encode(obj: Record<string, unknown>, prefix = "", out: string[] = []): string[] {
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (Array.isArray(v)) {
      v.forEach((item, i) => {
        if (item !== null && typeof item === "object") encode(item as Record<string, unknown>, `${key}[${i}]`, out);
        else out.push(`${encodeURIComponent(`${key}[${i}]`)}=${encodeURIComponent(String(item))}`);
      });
    } else if (typeof v === "object") encode(v as Record<string, unknown>, key, out);
    else out.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(v))}`);
  }
  return out;
}

export async function stripe<T = any>(
  path: string,
  opts: { method?: "GET" | "POST" | "DELETE"; params?: Record<string, unknown>; idempotencyKey?: string } = {},
): Promise<T> {
  assertSafeKey();
  const method = opts.method ?? "GET";
  const body = opts.params ? encode(opts.params).join("&") : "";
  const url = `https://api.stripe.com/v1${path}${method === "GET" && body ? `?${body}` : ""}`;
  const r = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${KEY}`,
      "Stripe-Version": API_VERSION,
      "Content-Type": "application/x-www-form-urlencoded",
      ...(opts.idempotencyKey ? { "Idempotency-Key": opts.idempotencyKey } : {}),
    },
    body: method === "GET" ? undefined : body,
  });
  const data = await r.json();
  if (!r.ok) throw new Error(`Stripe ${method} ${path} (${r.status}): ${data?.error?.message ?? "error"}`);
  return data as T;
}

/* ---------------- webhook signature ---------------- */

const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let x = 0;
  for (let i = 0; i < a.length; i++) x |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return x === 0;
}

/** Stripe-Signature: t=…,v1=…  — HMAC-SHA256 of "t.payload", within 5 minutes. */
export async function verifyStripeSignature(payload: string, header: string | null, secret: string, toleranceSec = 300) {
  if (!header || !secret) return false;
  const parts = header.split(",").map((p) => p.split("="));
  const t = parts.find(([k]) => k === "t")?.[1];
  const sigs = parts.filter(([k]) => k === "v1").map(([, v]) => v);
  if (!t || !sigs.length) return false;
  if (Math.abs(Date.now() / 1000 - Number(t)) > toleranceSec) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = hex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${t}.${payload}`)));
  return sigs.some((s) => safeEqual(s, mac));
}

/* ---------------- syncing Stripe → our database ---------------- */
// We never trust the copy inside a webhook (events can arrive late or out of
// order): every sync re-reads Stripe's CURRENT object and stores that.

const GRANTS = new Set(["active", "trialing", "past_due"]);

async function householdForCustomer(customerId: string, metadataHousehold?: string): Promise<string | undefined> {
  const r = await asServer(`billing_customers?stripe_customer_id=eq.${encodeURIComponent(customerId)}&select=household_id`);
  return r.data?.[0]?.household_id ?? metadataHousehold;
}

async function upsert(table: string, conflict: string, row: Record<string, unknown>) {
  const r = await asServer(`${table}?on_conflict=${conflict}`, {
    method: "POST",
    headers: { Prefer: "return=minimal,resolution=merge-duplicates" },
    body: JSON.stringify(row),
  });
  if (!r.ok) throw new Error(`save ${table}: ${JSON.stringify(r.data)}`);
}

export async function syncSubscription(subscriptionId: string): Promise<string> {
  const sub = await stripe(`/subscriptions/${subscriptionId}`);
  const household = await householdForCustomer(sub.customer, sub.metadata?.household_id);
  if (!household) return "unknown-household";
  let periodEnd = sub.current_period_end ?? sub.items?.data?.[0]?.current_period_end;
  // Cancelled immediately (e.g. refunded): access ends when Stripe ended it, not at the old period end.
  if (sub.status === "canceled" && sub.ended_at) periodEnd = Math.min(periodEnd, sub.ended_at);
  // Payment failed: Stripe has already moved to the new (unpaid) period. The grace days must count
  // from when that unpaid period began — not from its end, which could be a year away.
  if (sub.status === "past_due" || sub.status === "unpaid") {
    periodEnd = sub.current_period_start ?? sub.items?.data?.[0]?.current_period_start ?? periodEnd;
  }
  const next = {
    household_id: household,
    provider: "stripe",
    provider_customer_id: sub.customer,
    provider_subscription_id: sub.id,
    status: sub.status,
    current_period_end: new Date(periodEnd * 1000).toISOString(),
    cancel_at_period_end: sub.cancel_at_period_end === true,
    grace_days: 3,
    ...pricingOf(sub),
    updated_at: new Date().toISOString(),
  };
  // Don't let an unfinished/old Stripe subscription overwrite a membership that still gives access.
  const cur = (await asServer(`entitlements?household_id=eq.${household}&select=provider,provider_subscription_id,status,current_period_end`)).data?.[0];
  const curGrants = cur && GRANTS.has(cur.status) && new Date(cur.current_period_end).getTime() > Date.now();
  const sameSub = cur?.provider === "stripe" && cur.provider_subscription_id === sub.id;
  if (cur && curGrants && !sameSub && !GRANTS.has(sub.status)) return "kept-existing";
  // An older Stripe subscription never replaces a newer one (e.g. when re-reading old invoices).
  if (cur?.provider === "stripe" && cur.provider_subscription_id && !sameSub) {
    const curSub = await stripe(`/subscriptions/${cur.provider_subscription_id}`).catch(() => null);
    if (curSub && curSub.created > sub.created) return "kept-newer";
  }
  await upsert("entitlements", "household_id", next);
  // Emails we owe the family (sent by the send-emails function; each only once).
  if (sub.cancel_at_period_end === true && GRANTS.has(sub.status)) {
    await queueNotice(household, "cancellation_confirmed", `cancel:${sub.id}:${sub.cancel_at ?? periodEnd}`, {
      access_until: new Date(periodEnd * 1000).toISOString(), trialing: sub.status === "trialing",
    });
  }
  if (sub.status === "canceled" && !sub.cancel_at_period_end) {
    await queueNotice(household, "membership_ended", `ended:${sub.id}`, { ended_at: new Date(periodEnd * 1000).toISOString() });
  }
  let trial = "";
  if (sub.status === "trialing") {
    trial = " " + (await enforceOneTrial(sub, household));
    // Reminder owed once the trial is within 3 days of ending (doesn't rely on Stripe's own timing).
    if (sub.trial_end && sub.trial_end * 1000 - Date.now() <= 3 * 86_400_000) trial += " " + (await queueTrialEndingNotice(sub.id));
  }
  return `entitlement:${sub.status}${trial}`;
}

/* ---------------- free trial: one per household and per card ---------------- */

/** Has this household (or its Stripe customer) ever had a trial or a subscription? Then no new trial. */
export async function trialEligible(household: string, customer?: string): Promise<boolean> {
  if (!TRIAL_DAYS) return false;
  const claims = await asServer(`trial_claims?household_id=eq.${household}&select=id&limit=1`);
  if (claims.data?.length) return false;
  if (customer) {
    const subs = await stripe("/subscriptions", { params: { customer, status: "all", limit: 1 } });
    if (subs.data?.length) return false;
  }
  return true;
}

/**
 * Backstop run whenever a trialing subscription is seen. If the same card (Stripe's card
 * fingerprint — never the number) or the same household already had a trial, the trial is
 * ended now so normal billing starts. This is disclosed at sign-up ("one free trial per family").
 */
async function enforceOneTrial(sub: any, household: string): Promise<string> {
  const seen = await asServer(`trial_claims?subscription_id=eq.${sub.id}&select=outcome`);
  if (seen.data?.length) return `trial:${seen.data[0].outcome}`;
  let fingerprint: string | null = null;
  const pmId = typeof sub.default_payment_method === "string" ? sub.default_payment_method : sub.default_payment_method?.id;
  if (pmId) fingerprint = (await stripe(`/payment_methods/${pmId}`)).card?.fingerprint ?? null;
  const priorHousehold = await asServer(`trial_claims?household_id=eq.${household}&subscription_id=neq.${sub.id}&select=id&limit=1`);
  const priorCard = fingerprint
    ? await asServer(`trial_claims?card_fingerprint=eq.${encodeURIComponent(fingerprint)}&household_id=neq.${household}&select=id&limit=1`)
    : { data: [] };
  let outcome = "granted";
  if (priorHousehold.data?.length) outcome = "refused-household-reused";
  else if (priorCard.data?.length) outcome = "refused-card-reused";
  await asServer("trial_claims", {
    method: "POST",
    headers: { Prefer: "return=minimal,resolution=ignore-duplicates" },
    body: JSON.stringify({
      household_id: household, card_fingerprint: fingerprint, subscription_id: sub.id,
      trial_end: sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null, outcome,
      referral_code: sub.metadata?.referral_code ?? null,
    }),
  });
  if (outcome !== "granted") {
    await stripe(`/subscriptions/${sub.id}`, { method: "POST", params: { trial_end: "now", proration_behavior: "none" } });
  } else {
    const p = pricingOf(sub);
    await queueNotice(household, "trial_started", `trial_started:${sub.id}`, {
      trial_end: sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null,
      amount_minor: p.discounted_price_minor ?? p.price_minor, then_minor: p.price_minor, discount_label: p.discount_label,
      discount_ends_at: p.discount_ends_at, interval: sub.items?.data?.[0]?.price?.recurring?.interval ?? "month",
    });
  }
  return `trial:${outcome}`;
}

/** Stripe's "trial ends in 3 days" event → queue the reminder we owe the family (sent by the email service). */
export async function queueTrialEndingNotice(subscriptionId: string): Promise<string> {
  const sub = await stripe(`/subscriptions/${subscriptionId}`, { params: { expand: ["items.data.price"] } });
  const household = await householdForCustomer(sub.customer, sub.metadata?.household_id);
  if (!household || sub.status !== "trialing" || !sub.trial_end) return "no-notice";
  const price = sub.items?.data?.[0]?.price;
  const p = pricingOf(sub);
  const discounted = p.discounted_price_minor != null && (!p.discount_ends_at || new Date(p.discount_ends_at).getTime() > sub.trial_end * 1000);
  await asServer("member_notices?on_conflict=dedupe_key", {
    method: "POST",
    headers: { Prefer: "return=minimal,resolution=ignore-duplicates" },
    body: JSON.stringify({
      household_id: household,
      kind: "trial_ending",
      dedupe_key: `trial_ending:${sub.id}`,
      due_at: new Date().toISOString(),
      detail: {
        trial_end: new Date(sub.trial_end * 1000).toISOString(),
        amount_minor: discounted ? p.discounted_price_minor : (price?.unit_amount ?? null),
        then_minor: price?.unit_amount ?? null,
        discount_label: discounted ? p.discount_label : null,
        discount_ends_at: discounted ? p.discount_ends_at : null,
        currency: price?.currency ?? "aud",
        interval: price?.recurring?.interval ?? null,
        cancel_at_period_end: sub.cancel_at_period_end === true,
      },
    }),
  });
  return "notice:trial_ending";
}

export async function syncInvoice(invoiceId: string): Promise<string> {
  const inv = await stripe(`/invoices/${invoiceId}`, { params: { expand: ["subscription"] } });
  const subObj = typeof inv.subscription === "object" ? inv.subscription : null;
  const household = await householdForCustomer(inv.customer, subObj?.metadata?.household_id ?? inv.metadata?.household_id);
  if (!household) return "unknown-household";
  // The plan line (not a proration credit for the old plan).
  const lines = inv.lines?.data ?? [];
  const line = lines.find((l: any) => l.price && !l.proration && l.amount >= 0) ?? lines.find((l: any) => l.amount > 0) ?? lines[0];
  const paid = inv.amount_paid ?? 0;
  // Stripe's processing fee for this payment (creators are paid on net receipts: excl. GST and fees).
  let fee: number | null = null;
  if (inv.charge && paid > 0) {
    const ch = await stripe(`/charges/${typeof inv.charge === "string" ? inv.charge : inv.charge.id}`, { params: { expand: ["balance_transaction"] } });
    fee = typeof ch.balance_transaction === "object" ? (ch.balance_transaction?.fee ?? null) : null;
  }
  await upsert("billing_invoices", "id", {
    id: inv.id,
    household_id: household,
    subscription_id: subObj?.id ?? inv.subscription ?? null,
    status: inv.status,
    currency: inv.currency,
    amount_due_minor: inv.amount_due ?? 0,
    amount_paid_minor: paid,
    gst_minor: Math.round(paid / 11), // prices are GST-inclusive
    processor_fee_minor: fee,
    price_id: line?.price?.id ?? null,
    price_lookup_key: line?.price?.lookup_key ?? null,
    billing_interval: line?.price?.recurring?.interval ?? null,
    period_start: line?.period?.start ? new Date(line.period.start * 1000).toISOString() : null,
    period_end: line?.period?.end ? new Date(line.period.end * 1000).toISOString() : null,
    paid_at: inv.status_transitions?.paid_at ? new Date(inv.status_transitions.paid_at * 1000).toISOString() : null,
    billing_reason: inv.billing_reason ?? null,
    livemode: inv.livemode === true,
    hosted_invoice_url: inv.hosted_invoice_url ?? null,
    updated_at: new Date().toISOString(),
  });
  if (inv.status === "paid" && paid > 0) await attributeReferral(household, subObj?.metadata?.referral_code, inv.id);
  const subIdForNotice = subObj?.id ?? (typeof inv.subscription === "string" ? inv.subscription : undefined);
  if (inv.status === "paid" && paid > 0 && subIdForNotice) {
    await queueNotice(household, "membership_started", `membership_started:${subIdForNotice}`, {
      amount_minor: paid, interval: line?.price?.recurring?.interval ?? "month",
      period_end: line?.period?.end ? new Date(line.period.end * 1000).toISOString() : null,
    });
  }
  if (inv.status === "open" && (inv.attempt_count ?? 0) > 0 && paid === 0) {
    await queueNotice(household, "payment_failed", `payment_failed:${inv.id}`, {
      amount_minor: inv.amount_due ?? 0,
      next_attempt: inv.next_payment_attempt ? new Date(inv.next_payment_attempt * 1000).toISOString() : null,
    });
  }
  // Keep the membership in step with this invoice (newer Stripe event payloads no longer carry the subscription id).
  const subId = subObj?.id ?? (typeof inv.subscription === "string" ? inv.subscription : undefined);
  return `invoice:${inv.status}` + (subId ? ` ${await syncSubscription(subId)}` : "");
}

/**
 * First paid invoice decides the referring creator (once; later codes never change it).
 * The creator's referral terms at that moment are FROZEN on the attribution, so later
 * contract changes only affect future referrals. Refused when: unknown/inactive code,
 * the creator isn't accepting new referrals, or it's the creator's own household.
 */
async function attributeReferral(household: string, code: string | undefined, invoiceId: string) {
  if (!code) return;
  const existing = await asServer(`referral_attributions?household_id=eq.${household}&select=household_id`);
  if (existing.data?.length) return;
  const c = await asServer(`creators?referral_code=eq.${encodeURIComponent(code)}&status=eq.active&select=id`);
  const creator = c.data?.[0]?.id;
  if (!creator) return;
  const k = await asServer(`creator_contracts?creator_id=eq.${creator}&select=*&order=version.desc&limit=1`);
  const contract = k.data?.[0];
  if (!contract) return;
  const month = new Intl.DateTimeFormat("en-CA", { timeZone: "Australia/Sydney", year: "numeric", month: "2-digit" })
    .format(new Date()).slice(0, 7);
  if (!acceptsNewReferrals({ ...contract.terms, contractId: contract.contract_id, version: contract.version, creatorId: creator }, month)) return;
  // Self-referral: the household owner is one of the creator's own logins.
  const owner = (await asServer(`households?id=eq.${household}&select=owner_user_id`)).data?.[0]?.owner_user_id;
  const self = owner ? await asServer(`creator_users?creator_id=eq.${creator}&user_id=eq.${owner}&select=user_id`) : { data: [] };
  if (self.data?.length) return;
  await asServer("referral_attributions", {
    method: "POST",
    headers: { Prefer: "return=minimal,resolution=ignore-duplicates" },
    body: JSON.stringify({
      household_id: household, creator_id: creator, referral_code: code, first_invoice_id: invoiceId,
      contract_id: contract.contract_id, contract_version: contract.version, terms: contract.terms.referral, source: "link",
    }),
  });
}

export async function syncCharge(chargeId: string): Promise<string> {
  const ch = await stripe(`/charges/${chargeId}`, { params: { expand: ["refunds"] } });
  const household = await householdForCustomer(ch.customer);
  if (!household) return "unknown-household";
  if (ch.invoice) await syncInvoice(ch.invoice);
  for (const rf of ch.refunds?.data ?? []) {
    await upsert("billing_refunds", "id", {
      id: rf.id,
      household_id: household,
      invoice_id: ch.invoice ?? null,
      charge_id: ch.id,
      amount_minor: rf.amount,
      status: rf.status,
      created_at: new Date(rf.created * 1000).toISOString(),
      livemode: ch.livemode === true,
    });
  }
  return `refunds:${ch.refunds?.data?.length ?? 0}`;
}

/* ---------------- what the family pays (price + any promo) ---------------- */

/** Current price and discount of a subscription, for the account page and emails. */
export function pricingOf(sub: any) {
  const price = sub.items?.data?.[0]?.price;
  const unit: number | null = price?.unit_amount ?? null;
  const d = sub.discount ?? (Array.isArray(sub.discounts) && typeof sub.discounts[0] === "object" ? sub.discounts[0] : null);
  const coupon = d?.coupon;
  let discounted: number | null = null;
  if (coupon && unit != null) {
    discounted = coupon.amount_off ? Math.max(0, unit - coupon.amount_off) : coupon.percent_off ? Math.round(unit * (1 - coupon.percent_off / 100)) : null;
  }
  return {
    plan_key: price?.lookup_key ?? null,
    price_minor: unit,
    discounted_price_minor: discounted,
    discount_label: coupon ? (coupon.name ?? null) : null,
    discount_ends_at: d?.end ? new Date(d.end * 1000).toISOString() : null,
  };
}

/** Queue an email for the family. The dedupe key makes every notice happen at most once. */
export async function queueNotice(household: string, kind: string, dedupeKey: string, detail: Record<string, unknown>) {
  await asServer("member_notices?on_conflict=dedupe_key", {
    method: "POST",
    headers: { Prefer: "return=minimal,resolution=ignore-duplicates" },
    body: JSON.stringify({ household_id: household, kind, dedupe_key: dedupeKey, due_at: new Date().toISOString(), detail }),
  });
}
