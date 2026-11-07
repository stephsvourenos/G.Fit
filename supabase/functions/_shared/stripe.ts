// Stripe helpers shared by the billing Edge Functions. The secret key lives only
// in Supabase Edge Function secrets. Refuses a LIVE key unless APP_ENV=production.
import { asServer } from "./http.ts";

const KEY = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
const APP_ENV = Deno.env.get("APP_ENV") ?? "development";
/** Pinned so field names never shift under us when Stripe releases a new API version. */
const API_VERSION = "2024-06-20";

export const isProduction = APP_ENV === "production";

/** Our Stripe Prices are found by lookup key. A price change = new Price + new key; existing members keep theirs. */
export const PLAN_LOOKUP_KEYS = {
  monthly: "gfit_family_monthly_aud_v1",
  annual: "gfit_family_annual_aud_v1",
} as const;
export type Plan = keyof typeof PLAN_LOOKUP_KEYS;

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
  return `entitlement:${sub.status}`;
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
  await upsert("billing_invoices", "id", {
    id: inv.id,
    household_id: household,
    subscription_id: subObj?.id ?? inv.subscription ?? null,
    status: inv.status,
    currency: inv.currency,
    amount_due_minor: inv.amount_due ?? 0,
    amount_paid_minor: paid,
    gst_minor: Math.round(paid / 11), // prices are GST-inclusive
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
  // Keep the membership in step with this invoice (newer Stripe event payloads no longer carry the subscription id).
  const subId = subObj?.id ?? (typeof inv.subscription === "string" ? inv.subscription : undefined);
  return `invoice:${inv.status}` + (subId ? ` ${await syncSubscription(subId)}` : "");
}

/** First paid invoice decides the referring creator (once; later codes never change it). */
async function attributeReferral(household: string, code: string | undefined, invoiceId: string) {
  if (!code) return;
  const existing = await asServer(`referral_attributions?household_id=eq.${household}&select=household_id`);
  if (existing.data?.length) return;
  const c = await asServer(`creators?referral_code=eq.${encodeURIComponent(code)}&status=eq.active&select=id`);
  const creator = c.data?.[0]?.id;
  if (!creator) return;
  await asServer("referral_attributions", {
    method: "POST",
    headers: { Prefer: "return=minimal,resolution=ignore-duplicates" },
    body: JSON.stringify({ household_id: household, creator_id: creator, referral_code: code, first_invoice_id: invoiceId }),
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
