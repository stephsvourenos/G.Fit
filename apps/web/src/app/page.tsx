import Link from "next/link";
import { brand } from "@app/config";
import { Art } from "@/components/site/Art";
import { WhoIsMoving } from "@/components/site/WhoIsMoving";
import { SiteFooter, SiteNav } from "@/components/SiteChrome";

const AGES = [
  { pic: "@bunny", who: "Little movers", ages: "Under 6", d: "Animal moves, balance games and weather dances, four to six minutes long." },
  { pic: "@danc2", who: "Big kids", ages: "6 to 12", d: "Dance breaks, obstacle courses you build at home, and footy skills." },
  { pic: "@net1", who: "Teens", ages: "13 to 17", d: "Sport drills and strength fundamentals, taught with good technique first." },
  { pic: "@yoga2", who: "Grown-ups", ages: "Adults", d: "Wall Pilates, mobility for desk days and strength that fits around everything else." },
];

const STEPS = [
  ["Start your free trial", `Seven days with every workout unlocked. Cancel before it ends and you pay nothing.`],
  ["Add your family", "Up to six profiles. Children need only a nickname and an age group: no email, photo or birthday."],
  ["Press play together", "Each profile opens to workouts made for that age. Watch on a phone, tablet or the TV-sized browser."],
];

const SAFETY = [
  "Every workout is chosen and checked by our team before it goes live",
  "No ads, comments, chat or public profiles",
  "A parent PIN guards adult workouts, profiles and billing",
  "No diet or weight-loss content for children",
  "Badges reward showing up, never weight or looks",
  "Your family’s data is never sold or shared",
];

const FAQ = [
  ["How much does it cost?", "A$14.99 a month or A$149.99 a year for the whole household, GST included. Every new family starts with a 7-day free trial."],
  ["Can my kids use it on their own?", "Yes. Children open their own profile and only see workouts approved for their age. They can’t reach adult workouts, settings or billing without your PIN."],
  ["What ages is it for?", "Under 6 through to adults. Many workouts are made for everyone to do together, and each one says who it suits."],
  ["Do we need equipment?", "Most workouts need nothing but some floor space. A few use a wall, a mat, a ball or a chair, and each workout lists what you’ll need."],
  ["How do I cancel?", "In your family account, any time, in about a minute. You keep access until the end of the period you’ve paid for."],
  ["Who are the coaches?", "Qualified fitness coaches, plus junior coaches who show kids how it’s done. Junior coaches only appear with a parent or guardian’s written consent."],
];

export default function Landing() {
  return (
    <main className="flex-1 bg-paper">
      {/* Hero: the app's own first question, with a live demo of profiles */}
      <section className="bg-ink text-paper">
        <SiteNav dark />
        <div className="mx-auto max-w-6xl px-4 pb-16 pt-8 sm:px-6 sm:pb-24 sm:pt-14">
          <h1 className="font-display max-w-4xl text-[clamp(3rem,9vw,7.25rem)] font-bold leading-[0.88] tracking-[-0.045em]">
            Who’s moving today?
          </h1>
          <div className="mt-6 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <p className="max-w-xl text-lg text-paper/80 sm:text-xl">
              Short, joyful workouts for the whole household. One family membership, and everyone gets their own
              profile with workouts made for their age.
            </p>
            <div className="flex shrink-0 flex-wrap gap-3">
              <Link href="/join/" className="rounded-full bg-coral px-6 py-3.5 font-bold text-white hover:bg-gum-hover">
                Start your free trial
              </Link>
              <Link href="#pricing" className="rounded-full px-6 py-3.5 font-bold text-paper ring-1 ring-white/25 hover:ring-white/60">
                See prices
              </Link>
            </div>
          </div>
          <div className="mt-14 border-t border-white/10 pt-10">
            <p className="mb-5 text-sm text-muted">Tap someone in this family to see what their profile shows.</p>
            <WhoIsMoving />
          </div>
        </div>
      </section>

      {/* Ages */}
      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-24">
        <h2 className="font-display max-w-2xl text-4xl font-semibold leading-[0.95] tracking-[-0.03em] text-ink sm:text-6xl">
          Made for every age in the house.
        </h2>
        <div className="mt-12 grid grid-cols-2 gap-x-5 gap-y-10 sm:gap-x-8 lg:grid-cols-4">
          {AGES.map((a) => (
            <div key={a.who}>
              <Art id={a.pic} size={84} />
              <div className="font-display mt-5 text-2xl font-semibold text-ink">{a.who}</div>
              <div className="font-bold text-coral">{a.ages}</div>
              <p className="mt-2 text-ink/70">{a.d}</p>
            </div>
          ))}
        </div>
        <p className="mt-12 max-w-2xl text-lg text-ink/80">
          And plenty you can all do at once: a family wake-up shake, partner Pilates, a bedtime stretch.
        </p>
      </section>

      {/* How it works (a real sequence, so numbered) */}
      <section className="bg-paper-2">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-24">
          <h2 className="font-display text-4xl font-semibold tracking-[-0.03em] text-ink sm:text-5xl">Moving in three steps</h2>
          <ol className="relative mt-12 grid gap-10 md:grid-cols-3 md:gap-8">
            <span aria-hidden className="absolute left-6 right-6 top-6 hidden h-0.5 bg-ink/15 md:block" />
            {STEPS.map(([t, d], i) => (
              <li key={t} className="relative">
                <span className="font-display relative grid h-12 w-12 place-items-center rounded-full bg-ink text-xl font-bold text-sun">{i + 1}</span>
                <div className="font-display mt-5 text-2xl font-semibold text-ink">{t}</div>
                <p className="mt-2 max-w-xs text-ink/75">{d}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Safety for parents */}
      <section className="mx-auto grid max-w-6xl gap-12 px-4 py-20 sm:px-6 sm:py-24 lg:grid-cols-[1fr_1.15fr]">
        <div>
          <h2 className="font-display text-4xl font-semibold leading-[0.95] tracking-[-0.03em] text-ink sm:text-6xl">Parents stay in charge.</h2>
          <p className="mt-5 max-w-md text-lg text-ink/75">
            {brand.name} is a closed, curated library. There’s nothing to scroll, nobody to message and nothing your
            kids can stumble into.
          </p>
        </div>
        <ul className="grid gap-x-8 sm:grid-cols-2">
          {SAFETY.map((t) => (
            <li key={t} className="flex gap-3 border-t border-ink/10 py-4 text-ink/85">
              <svg viewBox="0 0 20 20" width="20" height="20" className="mt-0.5 shrink-0 text-sky" aria-hidden>
                <path d="M4 10.5l4 4 8-9" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {t}
            </li>
          ))}
        </ul>
      </section>

      {/* Pricing */}
      <section id="pricing" className="scroll-mt-4 bg-ink text-paper">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-24">
          <div className="grid gap-10 lg:grid-cols-[1fr_1.4fr] lg:items-end">
            <div>
              <h2 className="font-display text-4xl font-semibold leading-[0.95] tracking-[-0.03em] sm:text-6xl">One price for the whole family.</h2>
              <p className="mt-5 max-w-md text-paper/75">
                Up to six profiles, every workout, on every device. Prices are in Australian dollars and include GST.
                Have an offer code? You can add it when you join.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Plan name="Monthly" price="A$14.99" per="a month" note="Cancel any time." href="/join/?plan=monthly" />
              <Plan name="Yearly" price="A$149.99" per="a year" note="Two months free compared with monthly." href="/join/?plan=annual" best />
            </div>
          </div>
          <p className="mt-10 text-sm text-muted">
            Both plans start with a 7-day free trial for new families. After the trial your plan renews automatically
            until you cancel, which you can do in your family account before the next payment.
          </p>
        </div>
      </section>

      {/* Coaches */}
      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-24">
        <div className="grid items-center gap-8 rounded-[32px] bg-gum-tint p-7 sm:p-12 lg:grid-cols-[auto_1fr_auto]">
          <div className="flex -space-x-4">
            {["@coach1", "@yoga1", "@box1"].map((id) => <Art key={id} id={id} size={72} className="ring-4 ring-gum-tint" />)}
          </div>
          <div>
            <h2 className="font-display text-3xl font-semibold tracking-[-0.02em] text-ink sm:text-4xl">Teach on {brand.name}</h2>
            <p className="mt-2 max-w-xl text-ink/75">
              Coaches earn a share of membership income for every minute families spend in their workouts, plus a reward
              for each family they bring in. We handle filming advice, captions, billing and payments.
            </p>
          </div>
          <Link href="/support/" className="w-fit rounded-full bg-ink px-6 py-3.5 font-bold text-paper hover:bg-ink-3">Get in touch</Link>
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-3xl px-4 pb-24 sm:px-6">
        <h2 className="font-display text-4xl font-semibold tracking-[-0.03em] text-ink sm:text-5xl">Questions families ask</h2>
        <div className="mt-8 divide-y divide-ink/10 border-y border-ink/10">
          {FAQ.map(([q, a]) => (
            <details key={q} className="group py-1">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 text-lg font-bold text-ink [&::-webkit-details-marker]:hidden">
                {q}
                <span aria-hidden className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-paper-2 text-xl leading-none text-ink transition-transform group-open:rotate-45">+</span>
              </summary>
              <p className="max-w-2xl pb-5 text-ink/75">{a}</p>
            </details>
          ))}
        </div>
        <div className="mt-14 flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-display text-2xl font-semibold text-ink">Ready when your family is.</p>
          <Link href="/join/" className="rounded-full bg-coral px-6 py-3.5 font-bold text-white hover:bg-gum-hover">Start your free trial</Link>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}

function Plan({ name, price, per, note, href, best }: { name: string; price: string; per: string; note: string; href: string; best?: boolean }) {
  return (
    <div className={`rounded-[28px] p-6 sm:p-7 ${best ? "bg-paper text-ink" : "bg-ink-2 ring-1 ring-white/10"}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="font-display text-xl font-semibold">{name}</span>
        {best && <span className="rounded-full bg-sun px-3 py-1 text-xs font-bold text-ink">Best value</span>}
      </div>
      <div className="mt-4 flex flex-wrap items-baseline gap-x-2">
        <span className="font-display text-4xl font-bold tracking-[-0.03em] xl:text-5xl">{price}</span>
        <span className={best ? "text-ink/60" : "text-muted"}>{per}</span>
      </div>
      <p className={`mt-1 text-sm ${best ? "text-ink/65" : "text-muted"}`}>{note}</p>
      <Link href={href} className={`mt-6 block rounded-full py-3 text-center font-bold ${best ? "bg-coral text-white hover:bg-gum-hover" : "bg-paper text-ink hover:bg-white"}`}>
        Choose {name.toLowerCase()}
      </Link>
    </div>
  );
}
