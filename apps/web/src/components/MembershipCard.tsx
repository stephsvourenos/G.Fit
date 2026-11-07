"use client";

import { useEffect, useState } from "react";
import { hasStreamingAccess, type HouseholdEntitlement } from "@app/domain";
import { openPortal, PLANS, savedReferral, startCheckout, type Plan } from "@/lib/billing";
import { supabase } from "@/lib/supabase";

const fmt = (iso: string) => new Date(iso).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });

/**
 * Live membership: join through Stripe Checkout, manage through Stripe's
 * Customer Portal. TEST MODE until launch — use card 4242 4242 4242 4242.
 */
export function MembershipCard({ entitlement }: { entitlement?: HouseholdEntitlement }) {
  const active = hasStreamingAccess(entitlement, new Date());
  const paid = entitlement?.provider === "stripe";
  const [plan, setPlan] = useState<Plan>("monthly");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string>();
  const [checkout] = useState(() =>
    typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("checkout"),
  );
  const [waiting, setWaiting] = useState(checkout === "success" && !(paid && active));

  useEffect(() => {
    const saved = savedReferral();
    if (saved) setCode(saved); // eslint-disable-line react-hooks/set-state-in-effect
  }, []);

  // After paying, Stripe tells our server within a few seconds; wait for it, then refresh.
  useEffect(() => {
    if (!waiting) return;
    let tries = 0;
    const t = setInterval(async () => {
      tries++;
      // Our own household only (staff accounts can read every family's membership).
      const db = supabase();
      const hh = await db.from("households").select("id").maybeSingle();
      const { data } = await db
        .from("entitlements")
        .select("provider,status")
        .eq("household_id", hh.data?.id ?? "")
        .eq("provider", "stripe")
        .in("status", ["active", "trialing"]);
      if (data?.length) {
        clearInterval(t);
        window.location.replace("/watch/account/");
      } else if (tries > 20) {
        clearInterval(t);
        setWaiting(false);
        setMsg("Payment received, but activation is taking longer than usual. Refresh in a minute.");
      }
    }, 2000);
    return () => clearInterval(t);
  }, [waiting]);

  const go = async (fn: () => Promise<{ url?: string; error?: string }>) => {
    setBusy(true);
    setMsg(undefined);
    const r = await fn();
    if (r.url) {
      window.location.assign(r.url);
      return;
    }
    setBusy(false);
    setMsg(r.error === "already-member" ? "You already have an active membership." : r.error ?? "Something went wrong.");
  };

  return (
    <section className="mt-6 rounded-2xl bg-ink-2 p-5 ring-1 ring-white/5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-muted">Membership</div>
          {waiting ? (
            <div className="font-display mt-1 text-2xl">Activating your membership…</div>
          ) : entitlement && (active || paid) ? (
            <>
              <div className="font-display mt-1 text-2xl">{paid ? "Family membership" : "Test membership"}</div>
              <div className="text-sm text-muted">
                {entitlement.status === "past_due"
                  ? "Your last payment didn’t go through — please update your card. Videos keep working for a few days."
                  : active
                    ? `${paid ? "Current period ends" : "Active until"} ${fmt(entitlement.currentPeriodEnd)}`
                    : `Ended ${fmt(entitlement.currentPeriodEnd)} — videos paused`}
              </div>
            </>
          ) : (
            <div className="font-display mt-1 text-2xl">{entitlement ? "Membership ended" : "Join to unlock every video"}</div>
          )}
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-bold ${active ? "bg-mint/15 text-mint" : "bg-coral/20 text-coral-2"}`}>
          {active ? "Active" : "Inactive"}
        </span>
      </div>

      {checkout === "cancelled" && !active && <p className="mt-3 text-sm text-muted">No problem — you weren’t charged.</p>}

      {paid ? (
        <div className="mt-4">
          <button onClick={() => go(openPortal)} disabled={busy} className="rounded-full bg-paper px-5 py-2.5 text-sm font-semibold text-ink disabled:opacity-50">
            {busy ? "Opening…" : "Manage membership"}
          </button>
          <p className="mt-2 text-xs text-muted">Change plan, update your card, download invoices or cancel — on Stripe’s secure page.</p>
        </div>
      ) : (
        !waiting && (
          <div className="mt-4">
            <div role="radiogroup" aria-label="Choose a plan" className="grid gap-3 sm:grid-cols-2">
              {(Object.keys(PLANS) as Plan[]).map((p) => (
                <button
                  key={p}
                  role="radio"
                  aria-checked={plan === p}
                  onClick={() => setPlan(p)}
                  className={`rounded-2xl p-4 text-left ring-2 transition ${plan === p ? "bg-ink-3 ring-sun" : "ring-white/10 hover:ring-white/30"}`}
                >
                  <div className="text-sm font-semibold">{PLANS[p].label}</div>
                  <div className="font-display text-2xl">{PLANS[p].price}</div>
                  <div className="text-xs text-muted">{PLANS[p].note} · GST included</div>
                </button>
              ))}
            </div>
            <label className="mt-4 block text-sm">
              Creator referral code <span className="text-muted">(optional)</span>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.trim())}
                maxLength={32}
                className="mt-1 block w-56 rounded-xl bg-ink-3 px-3 py-2"
                aria-label="Creator referral code"
              />
            </label>
            <button
              onClick={() => go(() => startCheckout(plan, code || undefined))}
              disabled={busy}
              className="mt-4 rounded-full bg-coral px-6 py-3 font-semibold text-white hover:bg-coral-2 disabled:opacity-50"
            >
              {busy ? "Opening secure checkout…" : `Join — ${PLANS[plan].price}`}
            </button>
            <p className="mt-2 text-xs text-muted">
              Test mode: no real money moves. Use card 4242 4242 4242 4242, any future expiry date and any 3-digit code.
              Cancel anytime; access continues to the end of the paid period.
            </p>
          </div>
        )
      )}
      {msg && <p role="alert" className="mt-3 text-sm text-coral-2">{msg}</p>}
    </section>
  );
}
