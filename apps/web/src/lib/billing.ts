import { supabase, supabaseConfigured } from "./supabase";
import { deviceId } from "./video";

export type Plan = "monthly" | "annual";

/** Display prices (GST included). Stripe holds the real Prices; these must match them. */
export const PLANS: Record<Plan, { label: string; price: string; note: string }> = {
  monthly: { label: "Monthly", price: "A$14.99", note: "per month" },
  annual: { label: "Annual", price: "A$149.99", note: "per year — about 2 months free" },
};

const REF_KEY = "gfit.ref";
const REF_DAYS = 30;

/** Remember a creator's referral code from ?ref=CODE for 30 days (this browser only). */
export function captureReferralFromUrl() {
  try {
    const code = new URLSearchParams(window.location.search).get("ref");
    if (code && /^[A-Za-z0-9_-]{3,32}$/.test(code)) {
      localStorage.setItem(REF_KEY, JSON.stringify({ code, at: Date.now() }));
      // Count the visit for the creator's referral funnel (anonymous browser id; once per day).
      if (supabaseConfigured) {
        void supabase()
          .rpc("record_referral_click", { code, visitor: deviceId() })
          .then(({ error }) => error && console.error("[referral] click", error.message));
      }
    }
  } catch {
    /* storage blocked: referral simply isn't remembered */
  }
}

export function savedReferral(): string | undefined {
  try {
    const raw = localStorage.getItem(REF_KEY);
    if (!raw) return undefined;
    const { code, at } = JSON.parse(raw) as { code: string; at: number };
    return Date.now() - at < REF_DAYS * 86_400_000 ? code : undefined;
  } catch {
    return undefined;
  }
}

async function call(fn: string, body: Record<string, unknown>): Promise<{ url?: string; error?: string }> {
  const { data, error } = await supabase().functions.invoke(fn, { body: { ...body, origin: window.location.origin } });
  if (data) return data;
  const ctx = (error as { context?: Response } | null)?.context;
  try {
    if (ctx) return await ctx.json();
  } catch {
    /* fall through */
  }
  return { error: "Couldn’t reach the payment service. Please try again." };
}

export const startCheckout = (plan: Plan, referralCode?: string) => call("billing-checkout", { plan, referral_code: referralCode });
export const openPortal = () => call("billing-portal", {});

/** How many free-trial days this family can still have (0 = already had one). */
export async function trialDaysAvailable(): Promise<number> {
  const r = (await call("billing-checkout", { check: true })) as { trialDays?: number };
  return typeof r.trialDays === "number" ? r.trialDays : 0;
}

/** Map a Stripe price lookup key back to our plan. */
export const planFromLookupKey = (k?: string | null): Plan | undefined =>
  k?.includes("annual") ? "annual" : k?.includes("monthly") ? "monthly" : undefined;
