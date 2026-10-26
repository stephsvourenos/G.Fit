import Link from "next/link";
import { CATEGORY_LABEL, CATEGORIES, formatDuration } from "@app/domain";
import { instructors, workouts } from "@app/mock-data";
import { Thumb } from "@/components/Thumb";
import { SiteFooter, SiteNav } from "@/components/SiteChrome";

const featured = workouts.filter((w) => w.state === "published").slice(0, 6);

export default function Landing() {
  return (
    <main className="flex-1 bg-paper">
      <SiteNav />

      {/* Hero */}
      <section className="mx-auto grid max-w-6xl gap-10 px-4 pb-16 pt-10 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:items-center lg:pt-16">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full bg-ink px-3 py-1 text-xs font-semibold text-paper">
            <span className="h-1.5 w-1.5 rounded-full bg-mint" /> New: Wall Pilates & Soccer Footwork
          </p>
          <h1 className="font-display mt-5 text-5xl font-semibold leading-[0.95] text-ink sm:text-7xl">
            Move together.
            <br />
            <span className="text-coral">Every age,</span> every day.
          </h1>
          <p className="mt-6 max-w-xl text-lg text-ink/75">
            Short, joyful workouts for the whole household — from five-minute animal moves for little ones to wall
            Pilates and strength for grown-ups. One membership, a profile for everyone.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/join/" className="rounded-full bg-coral px-6 py-3.5 font-semibold text-white shadow-lg shadow-coral/30 hover:bg-coral-2">
              Start your family membership
            </Link>
            <Link href="/watch/" className="rounded-full bg-white px-6 py-3.5 font-semibold text-ink ring-1 ring-ink/10 hover:ring-ink/30">
              Explore the demo app →
            </Link>
          </div>
          <p className="mt-4 text-sm text-ink/60">Cancel anytime · No ads · No chat or comments · Parent-controlled profiles</p>
        </div>

        <div className="relative grid grid-cols-2 gap-3 sm:gap-4">
          {featured.slice(0, 4).map((w, i) => (
            <div key={w.id} className={`relative aspect-[4/5] overflow-hidden rounded-3xl shadow-xl ${i % 2 ? "translate-y-8" : ""}`}>
              <Thumb w={w} size="lg" className="absolute inset-0" />
              <div className="absolute inset-x-0 bottom-0 p-4 text-white">
                <div className="text-[11px] font-semibold uppercase tracking-wider opacity-80">{CATEGORY_LABEL[w.category]} · {formatDuration(w.durationSec)}</div>
                <div className="font-display text-lg leading-tight">{w.title}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Age strip */}
      <section className="border-y border-ink/10 bg-paper-2">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-6 px-4 py-10 sm:grid-cols-4 sm:px-6">
          {[
            ["Little movers", "Under 6", "Animal moves, balance games, 4–6 minute sessions."],
            ["Big kids", "6–12", "Dance breaks, obstacle courses, footy skills."],
            ["Teens", "13–17", "Sport-specific drills and strength fundamentals."],
            ["Grown-ups", "Adults", "Wall Pilates, mobility and strength that fits a busy day."],
          ].map(([t, age, d]) => (
            <div key={t}>
              <div className="text-xs font-bold uppercase tracking-wider text-coral">{age}</div>
              <div className="font-display mt-1 text-2xl text-ink">{t}</div>
              <p className="mt-1 text-sm text-ink/65">{d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <h2 className="font-display text-4xl text-ink sm:text-5xl">Built for families, not feeds.</h2>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {[
            ["1", "One household, many profiles", "A parent sets up the account and a profile for each person. Children never need an email or a payment card."],
            ["2", "Everyone gets their own home screen", "Profiles only show workouts approved for that age band, with intensity limits parents can set."],
            ["3", "Celebrate showing up", "Gentle streaks and badges for effort and consistency — never weight, appearance or public rankings."],
          ].map(([n, t, d]) => (
            <div key={n} className="rounded-3xl bg-white p-7 ring-1 ring-ink/5">
              <div className="grid h-10 w-10 place-items-center rounded-full bg-ink font-display text-lg text-sun">{n}</div>
              <div className="font-display mt-5 text-2xl text-ink">{t}</div>
              <p className="mt-2 text-ink/70">{d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Categories */}
      <section className="bg-ink py-20 text-paper">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="font-display text-4xl sm:text-5xl">Something for every mood.</h2>
          <div className="mt-8 flex flex-wrap gap-3">
            {CATEGORIES.map((c) => (
              <span key={c} className="rounded-full bg-white/10 px-5 py-2.5 font-semibold ring-1 ring-white/15">{CATEGORY_LABEL[c]}</span>
            ))}
          </div>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {instructors.map((i) => (
              <div key={i.id} className="flex items-start gap-4 rounded-2xl bg-ink-2 p-5 ring-1 ring-white/5">
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl font-display text-xl text-white" style={{ background: i.accent }}>
                  {i.displayName.split(" ").pop()![0]}
                </div>
                <div>
                  <div className="font-display text-lg">{i.displayName}</div>
                  <p className="text-sm text-muted">{i.bio}</p>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-6 text-xs text-muted">Instructor names and artwork are placeholders for the prototype.</p>
        </div>
      </section>

      {/* Safety */}
      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <div className="grid gap-10 lg:grid-cols-2">
          <div>
            <h2 className="font-display text-4xl text-ink sm:text-5xl">Safe by design.</h2>
            <p className="mt-4 text-lg text-ink/70">
              Every workout is chosen and reviewed by our team before it goes live. There are no public profiles, no
              comments, no messaging and no ads — just movement.
            </p>
          </div>
          <ul className="grid gap-3 sm:grid-cols-2">
            {[
              "Parent PIN protects adult profiles and billing",
              "Age-appropriate catalogue per profile",
              "No diet or weight-loss content for children",
              "We never sell or share your family’s data",
              "Children’s activity stays private to your household",
              "Delete a profile and its history any time",
            ].map((t) => (
              <li key={t} className="flex gap-3 rounded-2xl bg-white p-4 ring-1 ring-ink/5">
                <span className="mt-0.5 text-mint">✔</span>
                <span className="text-ink/80">{t}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="bg-paper-2 py-20">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <h2 className="font-display text-center text-4xl text-ink sm:text-5xl">One price for the whole household.</h2>
          <p className="mt-3 text-center text-ink/65">Prices in AUD and include GST. Sample pricing for the prototype.</p>
          <div className="mt-10 grid gap-5 md:grid-cols-2">
            <PlanCard name="Monthly" price="A$14.99" per="per month" note="Billed monthly. Cancel any time." />
            <PlanCard name="Annual" price="A$149.99" per="per year" note="Two months free compared with monthly." highlight />
          </div>
          <p className="mt-6 text-center text-xs text-ink/55">
            Membership renews automatically until cancelled. You can cancel in your account settings before the next
            billing date. Final consumer terms are subject to legal review.
          </p>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}

function PlanCard({ name, price, per, note, highlight }: { name: string; price: string; per: string; note: string; highlight?: boolean }) {
  return (
    <div className={`rounded-3xl p-7 ${highlight ? "bg-ink text-paper ring-2 ring-coral" : "bg-white text-ink ring-1 ring-ink/10"}`}>
      <div className="flex items-center justify-between">
        <div className="font-display text-2xl">{name}</div>
        {highlight && <span className="rounded-full bg-coral px-3 py-1 text-xs font-bold text-white">Best value</span>}
      </div>
      <div className="mt-5 flex items-baseline gap-2">
        <span className="font-display text-5xl">{price}</span>
        <span className={highlight ? "text-muted" : "text-ink/60"}>{per}</span>
      </div>
      <p className={`mt-2 text-sm ${highlight ? "text-muted" : "text-ink/60"}`}>{note}</p>
      <ul className="mt-6 space-y-2 text-sm">
        {["Up to 6 profiles", "Every workout, every age", "Phone, tablet and web", "Programs & challenges"].map((f) => (
          <li key={f} className="flex gap-2"><span className="text-mint">✔</span>{f}</li>
        ))}
      </ul>
      <Link
        href={`/join/?plan=${name.toLowerCase()}`}
        className={`mt-7 block rounded-full py-3 text-center font-semibold ${highlight ? "bg-coral text-white hover:bg-coral-2" : "bg-ink text-paper hover:bg-ink-3"}`}
      >
        Choose {name.toLowerCase()}
      </Link>
    </div>
  );
}

