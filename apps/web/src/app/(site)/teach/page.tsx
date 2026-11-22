import type { Metadata } from "next";
import { Art } from "@/components/site/Art";
import { Btn, CheckList, CtaBanner, Eyebrow, Feature, PageHero, Section, SectionHeading, Wrap } from "@/components/site/ui";

export const metadata: Metadata = {
  title: "Teach on G.Fit",
  description: "For fitness instructors and coaches: reach new members on G.Fit and earn from membership income and referrals.",
  alternates: { canonical: "/teach/" },
};

export default function TeachPage() {
  return (
    <main>
      <PageHero eyebrow="For instructors & coaches" title="Teach what you love. Grow with G.Fit." crumbs={[{ label: "Teach on G.Fit" }]}
        lead="For fitness professionals who make great classes and want to reach people beyond their existing audience." />
      <Section>
        <Wrap className="grid items-center gap-12 lg:grid-cols-2">
          <div>
            <Eyebrow>A platform for your work</Eyebrow>
            <h2 className="font-display mt-3 text-[clamp(2rem,3.8vw,3rem)] font-bold leading-[1.05] tracking-[-0.03em]">Your sessions. A bigger audience.</h2>
            <p className="mt-4 text-lg text-paper/75">
              Your workouts sit alongside other styles and specialists, so members who come for one instructor discover you too.
            </p>
            <CheckList items={[
              "Show your workouts and programmes to every G.Fit member",
              "Earn a share of membership income for the minutes members spend in your workouts",
              "Earn a reward for each paying member you bring in with your own link",
              "Monthly statements in your instructor portal, paid into your Australian bank account",
              "We look after captions, billing and payments",
            ]} />
            <Btn href="/contact/" className="mt-7">Enquire about teaching →</Btn>
          </div>
          <div className="grid grid-cols-2 gap-5 rounded-[22px] bg-ink-2 p-10 ring-1 ring-line" aria-hidden>
            {["@coach1", "@whist", "@box1", "@martl1"].map((id) => <Art key={id} id={id} size={150} className="mx-auto" />)}
          </div>
        </Wrap>
      </Section>
      <Section tone="light">
        <Wrap>
          <SectionHeading tone="light" eyebrow="How you earn" title="Two ways your work pays."
            desc="Exact rates and rules are set out in your instructor agreement before anything is published." />
          <div className="grid gap-5 md:grid-cols-2">
            <Feature tone="light" art="@flame" title="Membership royalties">
              Each month, part of G.Fit’s membership income is shared between instructors based on the minutes paying members
              spend in their workouts. Free trials don’t count, so you’re paid from real income.
            </Feature>
            <Feature tone="light" art="@bolt" title="Referral rewards">
              Share your own link. When someone joins through it and becomes a paying member, you earn a reward on the terms in
              your agreement.
            </Feature>
          </div>
        </Wrap>
      </Section>
      <Section>
        <Wrap>
          <Eyebrow>How it works</Eyebrow>
          <h2 className="font-display mb-8 mt-3 text-[clamp(2rem,3.8vw,3rem)] font-bold tracking-[-0.03em]">Three clear steps.</h2>
          <ol className="grid gap-5 md:grid-cols-3">
            {[
              ["Get in touch", "Tell us about your teaching, your style and any qualifications or clearances your category needs."],
              ["Sign and film", "Sign your instructor agreement. We check every workout for safety, music rights and captions before it goes live."],
              ["Reach members", "Members discover your workouts. Your portal shows your minutes, earnings and monthly statements."],
            ].map(([t, d], n) => (
              <li key={t} className="rounded-[20px] bg-ink-2 p-7 ring-1 ring-line">
                <span className="font-display grid h-10 w-10 place-items-center rounded-full bg-coral font-bold">{n + 1}</span>
                <h3 className="font-display mt-4 text-xl font-bold">{t}</h3>
                <p className="mt-2 text-muted">{d}</p>
              </li>
            ))}
          </ol>
        </Wrap>
      </Section>
      <CtaBanner title="Let’s build better fitness discovery." actions={<Btn href="/contact/" variant="white">Register your interest →</Btn>}>
        Interested in teaching on G.Fit? Tell us a little about you and we’ll be in touch.
      </CtaBanner>
    </main>
  );
}
