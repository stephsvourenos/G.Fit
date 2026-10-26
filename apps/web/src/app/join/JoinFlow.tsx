"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { load } from "@/lib/storage";

type Step = "account" | "checkout" | "done";
const PLANS = {
  monthly: { label: "Monthly", price: "A$14.99", per: "/month", gst: "A$1.36" },
  annual: { label: "Annual", price: "A$149.99", per: "/year", gst: "A$13.64" },
} as const;

export function JoinFlow() {
  const [step, setStep] = useState<Step>("account");
  const [plan, setPlan] = useState<keyof typeof PLANS>("monthly");
  const [email, setEmail] = useState("");
  const [ref, setRef] = useState<{ code: string } | null>(null);
  const [agree, setAgree] = useState(false);

  useEffect(() => {
    // Read the plan from the URL and any saved referral once, after mount (static-export friendly).
    /* eslint-disable react-hooks/set-state-in-effect */
    const p = new URLSearchParams(window.location.search).get("plan");
    if (p === "annual" || p === "monthly") setPlan(p);
    setRef(load<{ code: string } | null>("pf.referral", null));
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  const chosen = PLANS[plan];

  return (
    <div className="mx-auto max-w-lg px-4 pb-20 pt-6 sm:px-6">
      <ol className="mb-6 flex gap-2 text-xs font-semibold text-ink/50">
        {["Create account", "Checkout", "Done"].map((s, i) => (
          <li key={s} className={`flex-1 rounded-full py-1.5 text-center ${["account", "checkout", "done"].indexOf(step) >= i ? "bg-ink text-paper" : "bg-paper-2"}`}>{s}</li>
        ))}
      </ol>

      {step === "account" && (
        <form
          className="rounded-3xl bg-white p-6 ring-1 ring-ink/10"
          onSubmit={(e) => {
            e.preventDefault();
            setStep("checkout");
          }}
        >
          <h1 className="font-display text-3xl text-ink">Create your household account</h1>
          <p className="mt-1 text-sm text-ink/60">The account owner must be 18 or over. You’ll add profiles for everyone else next.</p>
          <label className="mt-6 block text-sm font-semibold text-ink">Email
            <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1.5 w-full rounded-xl border border-ink/15 px-3 py-2.5 font-normal" placeholder="you@example.com" />
          </label>
          <label className="mt-4 block text-sm font-semibold text-ink">Password
            <input required type="password" minLength={10} className="mt-1.5 w-full rounded-xl border border-ink/15 px-3 py-2.5 font-normal" placeholder="At least 10 characters" />
          </label>
          <fieldset className="mt-5">
            <legend className="text-sm font-semibold text-ink">Plan</legend>
            <div className="mt-2 grid grid-cols-2 gap-3">
              {(Object.keys(PLANS) as Array<keyof typeof PLANS>).map((k) => (
                <label key={k} className={`cursor-pointer rounded-2xl p-4 ring-2 ${plan === k ? "ring-coral bg-coral/5" : "ring-ink/10"}`}>
                  <input type="radio" name="plan" className="sr-only" checked={plan === k} onChange={() => setPlan(k)} />
                  <div className="font-semibold">{PLANS[k].label}</div>
                  <div className="text-sm text-ink/60">{PLANS[k].price}{PLANS[k].per}</div>
                </label>
              ))}
            </div>
          </fieldset>
          {ref && <p className="mt-4 rounded-xl bg-mint/10 px-3 py-2 text-sm text-ink">Referred by code <b>{ref.code}</b> — saved for checkout.</p>}
          <label className="mt-5 flex gap-2 text-sm text-ink/70">
            <input type="checkbox" required checked={agree} onChange={(e) => setAgree(e.target.checked)} />
            <span>I agree to the <Link href="/legal/terms/" className="underline">Terms</Link> and <Link href="/legal/privacy/" className="underline">Privacy Policy</Link>, and understand my membership renews automatically until I cancel.</span>
          </label>
          <button className="mt-6 w-full rounded-full bg-coral py-3.5 font-semibold text-white hover:bg-coral-2">Continue to secure checkout</button>
        </form>
      )}

      {step === "checkout" && (
        <div className="rounded-3xl bg-white p-6 ring-1 ring-ink/10">
          <div className="rounded-xl border-2 border-dashed border-sky/40 bg-sky/5 p-3 text-xs text-ink/70">
            <b>Simulated checkout.</b> In Phase 3 this step redirects to Stripe’s own hosted Checkout page in test mode.
            Card details are typed into Stripe’s page — never into this app.
          </div>
          <h2 className="font-display mt-5 text-2xl text-ink">Order summary</h2>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between"><dt>{chosen.label} family membership</dt><dd>{chosen.price}</dd></div>
            <div className="flex justify-between text-ink/60"><dt>Includes GST</dt><dd>{chosen.gst}</dd></div>
            {ref && <div className="flex justify-between text-ink/60"><dt>Referral</dt><dd>{ref.code}</dd></div>}
            <div className="flex justify-between border-t border-ink/10 pt-2 font-semibold"><dt>Due today</dt><dd>{chosen.price}</dd></div>
          </dl>
          <button onClick={() => setStep("done")} className="mt-6 w-full rounded-full bg-ink py-3.5 font-semibold text-paper hover:bg-ink-3">
            Simulate successful test payment
          </button>
          <button onClick={() => setStep("account")} className="mt-2 w-full py-2 text-sm text-ink/60">Back</button>
        </div>
      )}

      {step === "done" && (
        <div className="rounded-3xl bg-white p-8 text-center ring-1 ring-ink/10">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-mint/15 text-3xl">🎉</div>
          <h2 className="font-display mt-4 text-3xl text-ink">You’re in!</h2>
          <p className="mt-2 text-ink/65">
            In the real app, access switches on only when Stripe’s signed webhook confirms the payment — not when this
            page loads.
          </p>
          <Link href="/watch/" className="mt-6 inline-block rounded-full bg-coral px-6 py-3 font-semibold text-white">Set up profiles →</Link>
        </div>
      )}
    </div>
  );
}
