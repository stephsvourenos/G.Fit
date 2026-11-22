import Link from "next/link";
import type { ReactNode } from "react";
import { annualMonthlyEquivalent, annualSavingPercent, aud, plans } from "@app/config";
import { Art } from "./Art";

/* Shared pieces for the public website (layout from the Nov 2026 website design; fonts and colours from the 10 Nov scheme). */

type BtnVariant = "primary" | "ghost" | "outline" | "white" | "dark" | "text";
const BTN: Record<BtnVariant, string> = {
  primary: "bg-coral text-white hover:bg-gum-hover",
  ghost: "bg-ink-3 text-paper ring-1 ring-white/20 hover:bg-line",
  outline: "text-current ring-1 ring-current/40 hover:ring-current",
  white: "bg-white text-ink hover:bg-gum-tint",
  dark: "bg-ink text-paper hover:bg-ink-3",
  text: "px-0 text-coral-2 hover:text-white",
};

export function Btn({ href, children, variant = "primary", size = "md", className = "" }: {
  href: string; children: ReactNode; variant?: BtnVariant; size?: "sm" | "md"; className?: string;
}) {
  const pad = variant === "text" ? "py-2" : size === "sm" ? "px-4 py-2 text-sm" : "px-6 py-3.5";
  return (
    <Link href={href} className={`inline-flex items-center justify-center gap-2 rounded-full text-center font-bold transition hover:-translate-y-px ${pad} ${BTN[variant]} ${className}`}>
      {children}
    </Link>
  );
}

export function Eyebrow({ children, tone = "dark" }: { children: ReactNode; tone?: "dark" | "light" }) {
  return <div className={`text-xs font-bold uppercase tracking-[0.16em] ${tone === "dark" ? "text-coral-2" : "text-coral"}`}>{children}</div>;
}

export function Wrap({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`mx-auto w-full max-w-6xl px-4 sm:px-6 ${className}`}>{children}</div>;
}

/** Section backgrounds: dark (default page), alt (slightly lifted dark), light (cream) and soft (pink-tinted light). */
export function Section({ tone = "dark", children, className = "", id }: { tone?: "dark" | "alt" | "light" | "soft"; children: ReactNode; className?: string; id?: string }) {
  const bg = { dark: "", alt: "bg-ink-2/60", light: "bg-page text-ink", soft: "bg-gum-tint/60 text-ink" }[tone];
  return <section id={id} className={`py-16 sm:py-24 ${bg} ${className}`}>{children}</section>;
}

export function PageHero({ eyebrow, title, lead, crumbs, children }: {
  eyebrow: string; title: ReactNode; lead?: ReactNode; crumbs?: { href?: string; label: string }[]; children?: ReactNode;
}) {
  return (
    <section className="border-b border-line bg-[radial-gradient(ellipse_at_85%_0%,#4a1a38_0%,#211e2b_45%,#15131c_80%)] py-14 sm:py-20">
      <Wrap>
        {crumbs && (
          <nav aria-label="Breadcrumb" className="mb-6 text-sm text-muted">
            <Link href="/" className="underline underline-offset-4 hover:text-paper">Home</Link>
            {crumbs.map((c) => (
              <span key={c.label}>
                <span aria-hidden className="mx-2">/</span>
                {c.href ? <Link href={c.href} className="underline underline-offset-4 hover:text-paper">{c.label}</Link> : <span aria-current="page">{c.label}</span>}
              </span>
            ))}
          </nav>
        )}
        <Eyebrow>{eyebrow}</Eyebrow>
        <h1 className="font-display mt-4 max-w-4xl text-[clamp(2.5rem,5.5vw,4.25rem)] font-bold leading-[1.02] tracking-[-0.035em]">{title}</h1>
        {lead && <p className="mt-5 max-w-2xl text-lg text-paper/75">{lead}</p>}
        {children && <div className="mt-7 flex flex-wrap gap-3">{children}</div>}
      </Wrap>
    </section>
  );
}

export function SectionHeading({ eyebrow, title, desc, href, linkLabel = "Explore all →", tone = "dark" }: {
  eyebrow: string; title: ReactNode; desc?: ReactNode; href?: string; linkLabel?: string; tone?: "dark" | "light";
}) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="max-w-2xl">
        <Eyebrow tone={tone}>{eyebrow}</Eyebrow>
        <h2 className="font-display mt-3 text-[clamp(2rem,3.8vw,3rem)] font-bold leading-[1.05] tracking-[-0.03em]">{title}</h2>
        {desc && <p className={`mt-3 ${tone === "dark" ? "text-muted" : "text-ink/65"}`}>{desc}</p>}
      </div>
      {href && <Link href={href} className={`shrink-0 text-sm font-bold ${tone === "dark" ? "text-coral-2 hover:text-white" : "text-coral hover:text-ink"}`}>{linkLabel}</Link>}
    </div>
  );
}

export function Tag({ children, tone = "included" }: { children: ReactNode; tone?: "included" | "plain" }) {
  const c = tone === "included" ? "bg-ink/85 text-mint ring-1 ring-mint/40" : "bg-white/10 text-paper";
  return <span className={`inline-block rounded-md px-2 py-1 text-[11px] font-bold tracking-wide ${c}`}>{children}</span>;
}

export function CheckList({ items, tone = "dark" }: { items: ReactNode[]; tone?: "dark" | "light" }) {
  return (
    <ul className="mt-6 grid gap-3">
      {items.map((t, i) => (
        <li key={i} className="flex gap-3">
          <svg viewBox="0 0 20 20" width="20" height="20" className={`mt-0.5 shrink-0 ${tone === "dark" ? "text-coral-2" : "text-coral"}`} aria-hidden>
            <path d="M4 10.5l4 4 8-9" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className={tone === "dark" ? "text-paper/85" : "text-ink/80"}>{t}</span>
        </li>
      ))}
    </ul>
  );
}

export function Feature({ art, title, children, tone = "dark" }: { art: string; title: string; children: ReactNode; tone?: "dark" | "light" }) {
  return (
    <div className={`rounded-[20px] p-7 ${tone === "dark" ? "bg-ink-2 ring-1 ring-line" : "bg-white ring-1 ring-ink/10"}`}>
      <Art id={art} size={52} />
      <h3 className="font-display mt-4 text-xl font-bold tracking-[-0.02em]">{title}</h3>
      <p className={`mt-2 text-[15px] ${tone === "dark" ? "text-muted" : "text-ink/65"}`}>{children}</p>
    </div>
  );
}

export function Faq({ items, tone = "light" }: { items: readonly (readonly [string, string])[]; tone?: "dark" | "light" }) {
  return (
    <div className={`divide-y border-y ${tone === "dark" ? "divide-line border-line" : "divide-ink/10 border-ink/10"}`}>
      {items.map(([q, a]) => (
        <details key={q} className="group py-1">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 text-lg font-bold [&::-webkit-details-marker]:hidden">
            {q}
            <span aria-hidden className="font-display shrink-0 text-2xl text-coral transition-transform group-open:rotate-45">+</span>
          </summary>
          <p className={`max-w-3xl pb-5 ${tone === "dark" ? "text-muted" : "text-ink/70"}`}>{a}</p>
        </details>
      ))}
    </div>
  );
}

export function PriceCards() {
  return (
    <div className="grid gap-5 md:grid-cols-2">
      <div className="rounded-[22px] bg-white p-7 text-ink ring-1 ring-ink/10 sm:p-8">
        <Eyebrow tone="light">Monthly</Eyebrow>
        <div className="font-display mt-5 text-5xl font-bold tracking-[-0.04em]">{aud(plans.monthly.amount)}</div>
        <div className="mt-1 text-ink/60">per month</div>
        <p className="mt-4 text-ink/70">Every workout from every instructor on {"G.Fit"}, billed monthly. Cancel any time.</p>
        <Btn href="/join/?plan=monthly" variant="dark" className="mt-6 w-full">Choose monthly</Btn>
      </div>
      <div className="relative rounded-[22px] bg-white p-7 text-ink ring-2 ring-coral sm:p-8">
        <span className="absolute -top-3.5 right-6 rounded-full bg-sun px-3 py-1 text-xs font-bold text-ink">Save {annualSavingPercent}%</span>
        <Eyebrow tone="light">Yearly</Eyebrow>
        <div className="font-display mt-5 text-5xl font-bold tracking-[-0.04em]">{aud(plans.annual.amount)}</div>
        <div className="mt-1 text-ink/60">per year · about {aud(annualMonthlyEquivalent)} a month</div>
        <p className="mt-4 text-ink/70">The same membership for less, billed once a year.</p>
        <Btn href="/join/?plan=annual" className="mt-6 w-full">Choose yearly</Btn>
      </div>
    </div>
  );
}

/** The plain-English trial and renewal terms. Shown next to every price. */
export function TrialTerms({ tone = "light" }: { tone?: "dark" | "light" }) {
  return (
    <p className={`mt-6 max-w-3xl text-sm ${tone === "dark" ? "text-muted" : "text-ink/65"}`}>
      Prices are in Australian dollars and include GST. New members get a {plans.trialDays}-day free trial (one per household). You’ll need
      a card, Apple Pay or Google Pay to start it, but you won’t be charged if you cancel before the trial ends. After the trial your plan
      renews automatically at {aud(plans.monthly.amount)} a month or {aud(plans.annual.amount)} a year until you cancel. You can cancel
      online in your account at any time and keep access until the end of the period you’ve paid for.
    </p>
  );
}

/** "Why limit yourself to one instructor?" Comparison figures are illustrative examples (owner's decision, 22 Nov 2026). */
export function CompareBlock() {
  const card = "flex flex-col rounded-[18px] p-6";
  return (
    <div className="rounded-[24px] bg-[linear-gradient(125deg,#2b1830,#1b1724)] p-6 ring-1 ring-line sm:p-10">
      <Eyebrow>The G.Fit membership advantage</Eyebrow>
      <h2 className="font-display mt-3 text-[clamp(2rem,3.8vw,3rem)] font-bold leading-[1.05] tracking-[-0.03em]">Why limit yourself to just one instructor?</h2>
      <p className="mt-4 max-w-3xl text-lg text-paper/75">
        Love a Pilates teacher, a dance instructor <em>and</em> a strength coach? Instructors often sell their own monthly memberships or
        programmes. G.Fit brings workouts from many instructors together in one membership.
      </p>
      <div className="mt-8 grid gap-4 md:grid-cols-3">
        <div className={`${card} bg-ink-2 ring-1 ring-line`}>
          <Eyebrow>One instructor</Eyebrow>
          <div className="font-display mt-3 text-3xl font-bold">A$19.99<span className="ml-1 font-sans text-sm font-normal text-muted">/mo</span></div>
          <h3 className="mt-3 font-bold">One instructor’s membership</h3>
          <p className="mt-2 flex-1 text-sm text-muted">Monthly access to one instructor’s workouts, on that instructor’s own terms.</p>
          <p className="mt-4 text-xs text-muted">Illustrative example price, not a quote from any instructor.</p>
        </div>
        <div className={`${card} bg-ink-2 ring-1 ring-line`}>
          <Eyebrow>One programme</Eyebrow>
          <div className="font-display mt-3 text-3xl font-bold">A$19<span className="ml-1 font-sans text-sm font-normal text-muted">once</span></div>
          <h3 className="mt-3 font-bold">One programme, bought elsewhere</h3>
          <p className="mt-2 flex-1 text-sm text-muted">Pay upfront for a single programme, with access set by its seller.</p>
          <p className="mt-4 text-xs text-muted">Illustrative example price, not a quote from any instructor.</p>
        </div>
        <div className={`${card} bg-[#3a1730] ring-2 ring-coral`}>
          <Eyebrow>G.Fit membership</Eyebrow>
          <div className="font-display mt-3 text-3xl font-bold">{aud(plans.monthly.amount)}<span className="ml-1 font-sans text-sm font-normal text-paper/70">/mo</span></div>
          <h3 className="mt-3 font-bold">More instructors. More ways to move.</h3>
          <p className="mt-2 flex-1 text-sm text-paper/75">Every workout and programme on G.Fit, from every instructor, in one subscription.</p>
          <Btn href="/pricing/" variant="white" size="sm" className="mt-5 self-start">See membership →</Btn>
        </div>
      </div>
      <p className="mt-5 text-xs text-muted">
        Everything on G.Fit is included in the membership. Products an instructor sells on their own website or app aren’t part of G.Fit.
      </p>
    </div>
  );
}

/** The "Who's moving today?" profile chooser, as a still picture. */
export function ProfileVisual() {
  const people = [
    { art: "@kettl", who: "Me", d: "Strength & Pilates" },
    { art: "@yoga2", who: "Partner", d: "Mobility & stretch" },
    { art: "@net1", who: "Teen", d: "Sport & skills" },
    { art: "@bunny", who: "Little mover", d: "Movement & play" },
  ];
  return (
    <div className="rounded-[22px] bg-ink-2 p-6 ring-1 ring-line">
      <Eyebrow>Who’s moving today?</Eyebrow>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {people.map((p) => (
          <div key={p.who} className="flex items-center gap-3 rounded-2xl bg-ink-3 p-4">
            <Art id={p.art} size={48} />
            <div>
              <div className="font-bold">{p.who}</div>
              <div className="text-sm text-muted">{p.d}</div>
            </div>
          </div>
        ))}
      </div>
      <p className="mt-4 text-xs text-muted">Example profiles. If it’s just you, one profile is all you need.</p>
    </div>
  );
}

export function CtaBanner({ eyebrow, title, children, actions }: { eyebrow?: string; title: string; children?: ReactNode; actions: ReactNode }) {
  return (
    <Wrap className="pb-20 pt-6">
      <div className="rounded-[24px] bg-[radial-gradient(ellipse_at_50%_0%,#8a2a5e_0%,#3a1d3c_48%,#1d1824_95%)] px-6 py-14 text-center ring-1 ring-coral/30">
        {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
        <h2 className="font-display mt-3 text-[clamp(2rem,3.8vw,3rem)] font-bold tracking-[-0.03em]">{title}</h2>
        {children && <p className="mx-auto mt-3 max-w-xl text-paper/80">{children}</p>}
        <div className="mt-7 flex flex-wrap justify-center gap-3">{actions}</div>
      </div>
    </Wrap>
  );
}

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-line px-6 py-12 text-center">
      <h3 className="font-display text-xl font-bold">{title}</h3>
      {children && <p className="mx-auto mt-2 max-w-md text-muted">{children}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Strip({ title, children, action }: { title: string; children: ReactNode; action: ReactNode }) {
  return (
    <div className="mt-8 flex flex-col gap-4 rounded-[20px] bg-ink-2 p-6 ring-1 ring-line sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h3 className="font-display text-xl font-bold">{title}</h3>
        <p className="mt-1 text-sm text-muted">{children}</p>
      </div>
      <div className="shrink-0">{action}</div>
    </div>
  );
}
