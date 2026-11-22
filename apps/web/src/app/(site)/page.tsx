import { brand, plans } from "@app/config";
import { Art } from "@/components/site/Art";
import { InstructorCard, PublicWorkoutCard } from "@/components/site/PublicCards";
import {
  Btn, CheckList, CompareBlock, CtaBanner, EmptyState, Eyebrow, Faq, Feature, PriceCards, ProfileVisual, Section, SectionHeading,
  Strip, TrialTerms, Wrap,
} from "@/components/site/ui";
import { getCatalogue } from "@/lib/public-catalogue";
import { FAQS } from "@/lib/site-content";

const HERO_ART = ["@danc1", "@yoga1", "@lift1", "@run2", "@coach1", "@hoop1"];

export default async function Home() {
  const { workouts, instructors } = await getCatalogue();
  const featured = workouts.filter((w) => w.ageBands.includes("adult")).slice(0, 4);
  return (
    <main>
      {/* Hero */}
      <Wrap className="pt-5">
        <div className="relative overflow-hidden rounded-[26px] bg-[radial-gradient(ellipse_at_80%_40%,#7a2560_0%,#2e2034_45%,#1b1724_80%)] ring-1 ring-line">
          <div aria-hidden className="pointer-events-none absolute inset-y-0 right-0 hidden w-[46%] grid-cols-3 content-center gap-5 p-10 md:grid">
            {HERO_ART.map((id, n) => (
              <div key={id} className={n % 2 ? "translate-y-8" : ""}><Art id={id} size={118} still={false} className="shadow-2xl" /></div>
            ))}
          </div>
          <div className="relative max-w-2xl px-6 py-14 sm:px-12 sm:py-20">
            <Eyebrow>The fitness streaming experience</Eyebrow>
            <h1 className="font-display mt-5 text-[clamp(3rem,6.5vw,5.25rem)] font-bold leading-[0.95] tracking-[-0.045em]">
              Find your <span className="text-coral-2">kind of fit.</span>
            </h1>
            <p className="mt-5 text-lg text-paper/80">
              Why limit yourself to one instructor? Discover workouts you’ll love from instructors who move you, all with one {brand.name} membership.
            </p>
            <p className="mt-3 font-bold text-paper">{brand.promise}</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Btn href="/workouts/">Explore workouts →</Btn>
              <Btn href="/join/" variant="ghost">Start your free trial</Btn>
            </div>
            <p className="mt-4 text-sm text-paper/65">Join just for you. Add household profiles if you want.</p>
            <ul className="mt-10 flex flex-wrap gap-2 text-xs">
              {["Dance", "Pilates & strength", "Mobility", "Kids & teens"].map((t) => (
                <li key={t} className="rounded-full bg-white/5 px-3 py-1.5 ring-1 ring-white/20">{t}</li>
              ))}
            </ul>
          </div>
        </div>
      </Wrap>

      {/* Featured workouts */}
      <Section>
        <Wrap>
          <SectionHeading eyebrow="Start exploring" title="Something you’ll love pressing play on."
            desc="Find workouts that match your mood, your schedule and your level, and explore before you join." href="/workouts/" />
          {featured.length ? (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">{featured.map((w) => <PublicWorkoutCard key={w.slug} w={w} />)}</div>
          ) : (
            <EmptyState title="Our first workouts are on their way">They’ll appear here as soon as they’re published.</EmptyState>
          )}
          <Strip title="Don’t know where to start?" action={<Btn href="/workouts/">Find a workout →</Btn>}>
            Pick what you’re in the mood for and find a workout that fits today.
          </Strip>
        </Wrap>
      </Section>

      <Section tone="alt"><Wrap><CompareBlock /></Wrap></Section>

      {/* Why */}
      <Section tone="light">
        <Wrap>
          <SectionHeading tone="light" eyebrow={`Why ${brand.name}`} title="Less scrolling. More moving." desc="Choosing your next workout should be the easy part." />
          <div className="grid gap-5 md:grid-cols-3">
            <Feature tone="light" art="@adance" title="Move because you want to">Find movement that matches your mood, not another routine that feels like a chore.</Feature>
            <Feature tone="light" art="@awatch" title="A workout for right now">Filter by length, style, intensity and equipment, and pick what suits your day.</Feature>
            <Feature tone="light" art="@aheart" title="Keep discovering">Find favourite instructors, try other styles and build a routine that’s yours.</Feature>
          </div>
        </Wrap>
      </Section>

      {/* Instructors */}
      {instructors.length > 0 && (
        <Section>
          <Wrap>
            <SectionHeading eyebrow="The people behind the movement" title="Meet the people who move you."
              desc="Dance teachers, Pilates instructors, personal trainers and coaches. Find the styles that keep you coming back." href="/instructors/" />
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{instructors.slice(0, 3).map((i) => <InstructorCard key={i.slug} i={i} />)}</div>
          </Wrap>
        </Section>
      )}

      {/* Households */}
      <Section tone="alt">
        <Wrap className="grid items-center gap-12 lg:grid-cols-2">
          <div>
            <Eyebrow>Just for you, or everyone at home</Eyebrow>
            <h2 className="font-display mt-3 text-[clamp(2rem,3.8vw,3rem)] font-bold leading-[1.05] tracking-[-0.03em]">One membership. Every way you move.</h2>
            <p className="mt-4 text-lg text-paper/75">
              Your own fitness space comes first. If you like, add profiles for the people you live with, including parent-managed
              profiles for younger members.
            </p>
            <CheckList items={[
              "The full experience on your own, with no family account needed",
              `Up to ${plans.maxProfiles} profiles on one membership`,
              "Separate workouts, favourites and progress for each person",
              "Age-appropriate workouts for kids, with parent controls",
            ]} />
            <Btn href="/everyone/" className="mt-7">How profiles work →</Btn>
          </div>
          <ProfileVisual />
        </Wrap>
      </Section>

      {/* Pricing */}
      <Section tone="soft" id="pricing">
        <Wrap>
          <SectionHeading tone="light" eyebrow="Simple, flexible membership" title="All your favourite fitness, in one place."
            desc="One membership for everything on G.Fit. No juggling separate instructor subscriptions." />
          <PriceCards />
          <TrialTerms />
        </Wrap>
      </Section>

      {/* FAQ */}
      <Section tone="light">
        <Wrap className="max-w-3xl">
          <div className="text-center">
            <Eyebrow tone="light">Good to know</Eyebrow>
            <h2 className="font-display mb-8 mt-3 text-[clamp(2rem,3.8vw,3rem)] font-bold tracking-[-0.03em]">Questions? We’ve got you.</h2>
          </div>
          <Faq items={FAQS.slice(0, 6)} />
          <div className="mt-8 text-center"><Btn href="/support/" variant="dark">Visit the help centre</Btn></div>
        </Wrap>
      </Section>

      <div className="pt-14">
        <CtaBanner eyebrow="Your next favourite workout is out there" title="Ready to find your fit?"
          actions={<><Btn href="/workouts/" variant="white">Explore workouts →</Btn><Btn href="/join/" variant="ghost">Get started</Btn></>}>
          Start with an instructor you love, and find a whole world of workouts along the way.
        </CtaBanner>
      </div>
    </main>
  );
}
