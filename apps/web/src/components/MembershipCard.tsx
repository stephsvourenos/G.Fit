"use client";

import { useEffect, useState } from "react";
import { hasStreamingAccess, type HouseholdEntitlement } from "@app/domain";
import {
  checkOffer,
  money,
  openPortal,
  type AppliedOffer,
  planFromLookupKey,
  PLANS,
  savedReferral,
  startCheckout,
  trialDaysAvailable,
  type Plan,
} from "@/lib/billing";
import { supabase } from "@/lib/supabase";

const fmt = (iso: string) =>
  new Date(iso).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

/**
 * Live membership: join through Stripe Checkout, manage through Stripe's
 * Customer Portal. TEST MODE until launch — use card 4242 4242 4242 4242.
 */
export function MembershipCard({
  entitlement,
}: {
  entitlement?: HouseholdEntitlement;
}) {
  const active = hasStreamingAccess(entitlement, new Date());
  const paid = entitlement?.provider === "stripe";
  const trialing = paid && entitlement?.status === "trialing";
  const [trialDays, setTrialDays] = useState(0);
  const [myPlan, setMyPlan] = useState<Plan>();
  const [plan, setPlan] = useState<Plan>("monthly");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string>();
  const [offerCode, setOfferCode] = useState("");
  const [offer, setOffer] = useState<AppliedOffer>();
  const [offerMsg, setOfferMsg] = useState<string>();
  const [pricing, setPricing] = useState<{ plan_key: string | null; price_minor: number | null; discounted_price_minor: number | null; discount_label: string | null; discount_ends_at: string | null }>();
  const [checkout] = useState(() =>
    typeof window === "undefined"
      ? null
      : new URLSearchParams(window.location.search).get("checkout"),
  );
  const [waiting, setWaiting] = useState(
    checkout === "success" && !(paid && active),
  );

  useEffect(() => {
    const saved = savedReferral();
    if (saved) setCode(saved); // eslint-disable-line react-hooks/set-state-in-effect
  }, []);

  // Can this family still have a free trial? (One per family and per card.)
  useEffect(() => {
    if (paid && active) return;
    trialDaysAvailable().then(setTrialDays);
  }, [paid, active]);

  // During a trial, show which plan starts afterwards (from our own invoice record).
  useEffect(() => {
    if (!trialing) return;
    const db = supabase();
    db.from("households")
      .select("id")
      .maybeSingle()
      .then(({ data: hh }) =>
        db
          .from("billing_invoices")
          .select("price_lookup_key")
          .eq("household_id", hh?.id ?? "")
          .order("updated_at", { ascending: false })
          .limit(1),
      )
      .then(({ data }) =>
        setMyPlan(planFromLookupKey(data?.[0]?.price_lookup_key)),
      );
  }, [trialing]);

  // What this family pays now (incl. founder price or promo), for paying members.
  useEffect(() => {
    if (!paid) return;
    const db = supabase();
    db.from("households").select("id").maybeSingle().then(({ data: hh }) =>
      db.from("entitlements")
        .select("plan_key, price_minor, discounted_price_minor, discount_label, discount_ends_at")
        .eq("household_id", hh?.id ?? "")
        .maybeSingle()
        .then(({ data }) => data && setPricing(data)),
    );
  }, [paid]);

  // Offer codes are checked per plan (e.g. founder and launch promos are monthly only).
  const applyOffer = async (p: Plan = plan) => {
    if (!offerCode.trim()) return;
    setOfferMsg(undefined);
    const r = await checkOffer(p, offerCode.trim());
    setOffer(r.offer);
    if (r.error) setOfferMsg(r.error);
  };
  const choosePlan = (p: Plan) => {
    setPlan(p);
    if (offer || offerMsg) void applyOffer(p);
  };
  const shownPrice = (p: Plan) => (offer && p === plan ? money(offer.price_minor) : PLANS[p].price);
  const priceText = offer ? offer.label : `${PLANS[plan].price} ${PLANS[plan].note.split(" — ")[0]}`;

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
        setMsg(
          "Payment received, but activation is taking longer than usual. Refresh in a minute.",
        );
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
    setMsg(
      r.error === "already-member"
        ? "You already have an active membership."
        : (r.error ?? "Something went wrong."),
    );
  };

  return (
    <section className="mt-6 rounded-2xl bg-ink-2 p-5 ring-1 ring-white/5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-muted">
            Membership
          </div>
          {waiting ? (
            <div className="font-display mt-1 text-2xl">
              Activating your membership…
            </div>
          ) : entitlement && (active || paid) ? (
            <>
              <div className="font-display mt-1 text-2xl">
                {trialing
                  ? "Free trial"
                  : paid
                    ? "Family membership"
                    : "Test membership"}
              </div>
              <div className="text-sm text-muted">
                {trialing
                  ? entitlement.cancelAtPeriodEnd
                    ? `Trial cancelled — videos keep working until ${fmt(entitlement.currentPeriodEnd)} and you won’t be charged.`
                    : `Your free trial ends on ${fmt(entitlement.currentPeriodEnd)}. Then ${myPlan ? `${PLANS[myPlan].price} ${PLANS[myPlan].note.split(" — ")[0]}` : "your chosen plan"} (GST included) unless you cancel before then — cancelling during the trial costs nothing.`
                  : entitlement.status === "past_due"
                    ? "Your last payment didn’t go through — please update your card. Videos keep working for a few days."
                    : active && entitlement.cancelAtPeriodEnd
                      ? `Cancelled — videos keep working until ${fmt(entitlement.currentPeriodEnd)}. Changed your mind? Use “Manage membership”.`
                      : active
                        ? `${paid ? "Renews" : "Active until"} ${fmt(entitlement.currentPeriodEnd)}`
                        : `Ended ${fmt(entitlement.currentPeriodEnd)} — videos paused`}
              </div>
              {paid && pricing?.price_minor != null && (
                <div className="mt-1 text-sm text-paper/80">
                  {pricing.plan_key?.includes("founder") && "Founding-family price: "}
                  {pricing.discounted_price_minor != null
                    ? `${money(pricing.discounted_price_minor)}${pricing.discount_ends_at ? ` until ${fmt(pricing.discount_ends_at)}` : ""}, then ${money(pricing.price_minor)}`
                    : money(pricing.price_minor)}
                  {pricing.plan_key?.includes("annual") ? " per year" : " per month"} (GST included)
                  {pricing.plan_key?.includes("founder") && " — yours for as long as you stay a member"}
                </div>
              )}
            </>
          ) : (
            <div className="font-display mt-1 text-2xl">
              {entitlement ? "Membership ended" : "Join to unlock every video"}
            </div>
          )}
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-bold ${active ? "bg-mint/15 text-mint" : "bg-coral/20 text-coral-2"}`}
        >
          {trialing ? "Free trial" : active ? "Active" : "Inactive"}
        </span>
      </div>

      {checkout === "cancelled" && !active && (
        <p className="mt-3 text-sm text-muted">
          No problem — you weren’t charged.
        </p>
      )}

      {paid ? (
        <div className="mt-4">
          <button
            onClick={() => go(openPortal)}
            disabled={busy}
            className="rounded-full bg-paper px-5 py-2.5 text-sm font-semibold text-ink disabled:opacity-50"
          >
            {busy ? "Opening…" : "Manage membership"}
          </button>
          <p className="mt-2 text-xs text-muted">
            Change plan, update your card, download invoices or cancel — on
            Stripe’s secure page.
          </p>
        </div>
      ) : (
        !waiting && (
          <div className="mt-4">
            <div
              role="radiogroup"
              aria-label="Choose a plan"
              className="grid gap-3 sm:grid-cols-2"
            >
              {(Object.keys(PLANS) as Plan[]).map((p) => (
                <button
                  key={p}
                  role="radio"
                  aria-checked={plan === p}
                  onClick={() => choosePlan(p)}
                  className={`rounded-2xl p-4 text-left ring-2 transition ${plan === p ? "bg-ink-3 ring-sun" : "ring-white/10 hover:ring-white/30"}`}
                >
                  <div className="text-sm font-semibold">{PLANS[p].label}</div>
                  <div className="font-display text-2xl">
                    {shownPrice(p)}
                    {offer && p === plan && <span className="ml-2 text-sm text-muted line-through">{PLANS[p].price}</span>}
                  </div>
                  <div className="text-xs text-muted">
                    {PLANS[p].note} · GST included
                  </div>
                </button>
              ))}
            </div>
            <label className="mt-4 block text-sm">
              Creator referral code{" "}
              <span className="text-muted">(optional)</span>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.trim())}
                maxLength={32}
                className="mt-1 block w-56 rounded-xl bg-ink-3 px-3 py-2"
                aria-label="Creator referral code"
              />
            </label>
            <div className="mt-4 text-sm">
              <label htmlFor="offer-code">
                Offer code <span className="text-muted">(optional)</span>
              </label>
              <div className="mt-1 flex flex-wrap gap-2">
                <input
                  id="offer-code"
                  value={offerCode}
                  onChange={(e) => { setOfferCode(e.target.value.toUpperCase().trim()); setOffer(undefined); setOfferMsg(undefined); }}
                  maxLength={32}
                  className="w-56 rounded-xl bg-ink-3 px-3 py-2 uppercase"
                />
                <button onClick={() => applyOffer()} disabled={!offerCode} className="rounded-full px-4 py-2 font-semibold ring-1 ring-white/20 disabled:opacity-40">
                  Apply
                </button>
              </div>
              {offer && <p className="mt-1 text-mint">✓ {offer.label}</p>}
              {offerMsg && <p className="mt-1 text-coral-2">{offerMsg}</p>}
            </div>
            <button
              onClick={() => go(() => startCheckout(plan, code || undefined, offer ? offerCode : undefined))}
              disabled={busy}
              className="mt-4 rounded-full bg-coral px-6 py-3 font-semibold text-white hover:bg-coral-2 disabled:opacity-50"
            >
              {busy
                ? "Opening secure checkout…"
                : trialDays
                  ? `Start ${trialDays}-day free trial`
                  : `Join — ${shownPrice(plan)}`}
            </button>
            <p className="mt-3 max-w-xl text-sm text-paper/80">
              {trialDays
                ? `Free for ${trialDays} days, then ${priceText} (GST included), renewing until you cancel. A card is needed to start. We’ll remind you before your trial ends, and you can cancel online anytime — cancel during the trial and you pay nothing. One free trial per family.`
                : `${priceText} (GST included), charged today and renewing until you cancel. Cancel online anytime; access continues to the end of the paid period.`}
            </p>
            <p className="mt-2 text-xs text-muted">
              Test mode: no real money moves. Use card 4242 4242 4242 4242, any
              future expiry date and any 3-digit code.
            </p>
          </div>
        )
      )}
      {msg && (
        <p role="alert" className="mt-3 text-sm text-coral-2">
          {msg}
        </p>
      )}
    </section>
  );
}
