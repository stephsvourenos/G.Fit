"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { aud, plans } from "@app/config";
import { load, save } from "@/lib/storage";
import { supabaseConfigured } from "@/lib/supabase";

type PlanKey = "monthly" | "annual";
type Who = "solo" | "household";

const PRICE: Record<PlanKey, string> = {
  monthly: `${aud(plans.monthly.amount)} a month`,
  annual: `${aud(plans.annual.amount)} a year`,
};

/**
 * Individual-first joining (Nov 2026 website). Step 1 picks who it's for and the plan; step 2 explains exactly
 * what happens next. Then the real flow: create an account → create your profile → start the trial on Stripe's
 * hosted Checkout from the account page. Nothing here collects payment details.
 */
export function JoinFlow() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [plan, setPlan] = useState<PlanKey>("monthly");
  const [who, setWho] = useState<Who>("solo");
  const [ref, setRef] = useState<{ code: string } | null>(null);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- read the URL and saved referral once, after mount */
    const p = new URLSearchParams(window.location.search).get("plan");
    if (p === "annual" || p === "yearly") setPlan("annual");
    setRef(load<{ code: string } | null>("pf.referral", null));
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  const next = () => {
    save("pf.join.plan", plan);
    save("pf.join.who", who);
    router.push(supabaseConfigured ? "/account/sign-up/" : "/watch/");
  };

  const card = (selected: boolean) =>
    `flex cursor-pointer gap-3 rounded-2xl p-4 ring-2 transition ${selected ? "bg-gum-tint/50 ring-coral" : "ring-ink/10 hover:ring-ink/25"}`;

  return (
    <div className="mx-auto grid w-full max-w-6xl items-start gap-8 px-4 py-12 sm:px-6 sm:py-16 lg:grid-cols-[1.15fr_0.85fr]">
      <div className="rounded-[22px] bg-white p-6 text-ink sm:p-9">
        <div className="text-xs font-bold uppercase tracking-[0.16em] text-coral">Step {step} of 2</div>
        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-paper-2"><div className="h-full bg-coral transition-all" style={{ width: `${step * 50}%` }} /></div>

        {step === 1 ? (
          <>
            <h2 className="font-display mt-7 text-3xl font-bold tracking-[-0.02em]">How will you use G.Fit?</h2>
            <p className="mt-2 text-ink/65">Just you, or you and others at home? You can change this any time.</p>
            <fieldset className="mt-5 grid gap-3">
              <legend className="sr-only">Who it’s for</legend>
              {([["solo", "Just for me", "My own workouts, favourites and progress."], ["household", "Me and my household", `My own profile, plus up to ${plans.maxProfiles - 1} more for people I live with.`]] as const).map(([k, t, d]) => (
                <label key={k} className={card(who === k)}>
                  <input type="radio" name="who" checked={who === k} onChange={() => setWho(k)} className="mt-1 accent-coral" />
                  <span><span className="block font-bold">{t}</span><span className="text-sm text-ink/60">{d}</span></span>
                </label>
              ))}
            </fieldset>
            <h3 className="mt-7 font-bold">Choose a membership</h3>
            <fieldset className="mt-3 grid gap-3">
              <legend className="sr-only">Plan</legend>
              {([["monthly", `Monthly · ${PRICE.monthly}`, "Flexible, billed monthly."], ["annual", `Yearly · ${PRICE.annual}`, "The same membership for less, billed once a year."]] as const).map(([k, t, d]) => (
                <label key={k} className={card(plan === k)}>
                  <input type="radio" name="plan" checked={plan === k} onChange={() => setPlan(k)} className="mt-1 accent-coral" />
                  <span><span className="block font-bold">{t}</span><span className="text-sm text-ink/60">{d}</span></span>
                </label>
              ))}
            </fieldset>
            <button type="button" onClick={() => setStep(2)} className="mt-7 w-full rounded-full bg-coral py-3.5 font-bold text-white hover:bg-gum-hover">Continue →</button>
          </>
        ) : (
          <>
            <h2 className="font-display mt-7 text-3xl font-bold tracking-[-0.02em]">Here’s what happens next</h2>
            <ol className="mt-5 grid gap-4">
              {[
                ["Create your account", "Your email and a password. You must be 18 or over to hold the account."],
                ["Create your profile", who === "solo" ? "Pick a name and a picture. That’s all you need." : "Start with your own profile. Add the people you live with whenever you’re ready."],
                [`Start your ${plans.trialDays}-day free trial`, `On our payment partner Stripe’s secure page, using a card, Apple Pay or Google Pay. You won’t be charged if you cancel before the trial ends. After it, your plan renews at ${PRICE[plan]} until you cancel.`],
              ].map(([t, d], n) => (
                <li key={t} className="flex gap-4">
                  <span className="font-display grid h-9 w-9 shrink-0 place-items-center rounded-full bg-ink text-sm font-bold text-paper">{n + 1}</span>
                  <span><span className="block font-bold">{t}</span><span className="text-sm text-ink/65">{d}</span></span>
                </li>
              ))}
            </ol>
            {!supabaseConfigured && (
              <p className="mt-6 rounded-xl bg-paper-2 p-4 text-sm text-ink/70">This preview has no real accounts, so you’ll go straight to the sample member area.</p>
            )}
            <div className="mt-7 flex gap-3">
              <button type="button" onClick={() => setStep(1)} className="rounded-full bg-ink px-5 py-3.5 font-bold text-paper">← Back</button>
              <button type="button" onClick={next} className="flex-1 rounded-full bg-coral py-3.5 font-bold text-white hover:bg-gum-hover">Create my account →</button>
            </div>
            <p className="mt-4 text-center text-sm text-ink/60">Already a member? <Link href="/account/sign-in/" className="font-bold underline">Sign in</Link></p>
          </>
        )}
      </div>

      <aside className="rounded-[22px] bg-ink-2 p-7 ring-1 ring-line">
        <div className="text-xs font-bold uppercase tracking-[0.16em] text-coral-2">Your membership</div>
        <h2 className="font-display mt-3 text-xl font-bold">One membership. More ways to move.</h2>
        <dl className="mt-5 grid gap-3 text-sm">
          {[
            ["Plan", plan === "monthly" ? "Monthly" : "Yearly"],
            ["Price", `${PRICE[plan]}, GST included`],
            ["Profiles", who === "solo" ? "Start with one" : `Up to ${plans.maxProfiles}`],
            ["Free trial", `${plans.trialDays} days, for new members`],
            ...(ref ? [["Referral code", ref.code]] : []),
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between gap-4 border-b border-line pb-3 last:border-0"><dt className="text-muted">{k}</dt><dd className="text-right font-bold">{v}</dd></div>
          ))}
        </dl>
        <p className="mt-5 text-sm text-muted">Includes every workout and programme on G.Fit. Cancel online at any time.</p>
      </aside>
    </div>
  );
}
