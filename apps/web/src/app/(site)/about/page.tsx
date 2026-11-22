import type { Metadata } from "next";
import { Art } from "@/components/site/Art";
import { Btn, Eyebrow, Feature, PageHero, Section, SectionHeading, Wrap } from "@/components/site/ui";

export const metadata: Metadata = {
  title: "About",
  description: "G.Fit is an Australian fitness streaming service built around choice, discovery and the instructors who inspire us to move.",
  alternates: { canonical: "/about/" },
};

export default function AboutPage() {
  return (
    <main>
      <PageHero eyebrow="About G.Fit" title="Movement belongs to everyone." crumbs={[{ label: "About" }]}
        lead="Fitness is personal. What works for one person won’t suit the next, so we’re building G.Fit around choice, discovery and the people who inspire us to move." />
      <Section>
        <Wrap className="grid items-center gap-12 lg:grid-cols-2">
          <div>
            <Eyebrow>The idea</Eyebrow>
            <h2 className="font-display mt-3 text-[clamp(2rem,3.8vw,3rem)] font-bold leading-[1.05] tracking-[-0.03em]">A streaming home for movement.</h2>
            <p className="mt-4 text-lg text-paper/75">
              Lots of people find an instructor they love on social media, then have to choose between that instructor’s own
              membership or buying one programme. G.Fit brings many instructors together in one subscription, so trying someone
              new is as easy as pressing play.
            </p>
            <p className="mt-4 text-muted">
              From Pilates and dance to strength, mobility and movement for kids, the aim is to make fitness feel accessible,
              flexible and enjoyable at every stage of life. G.Fit is made in Australia.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-5 rounded-[22px] bg-ink-2 p-10 ring-1 ring-line" aria-hidden>
            {["@danc1", "@yoga2", "@coach1", "@swim1"].map((id) => <Art key={id} id={id} size={150} className="mx-auto" still={false} />)}
          </div>
        </Wrap>
      </Section>
      <Section tone="light">
        <Wrap>
          <SectionHeading tone="light" eyebrow="What we believe" title="Choice makes fitness more enjoyable."
            desc="Rather than telling people how they should move, we help them find movement they want to do." />
          <div className="grid gap-5 md:grid-cols-3">
            <Feature tone="light" art="@peak" title="For every stage of life">Individuals, couples and households can all find their own experience.</Feature>
            <Feature tone="light" art="@astar" title="Built around discovery">Explore new styles and get to know the instructors behind the workouts.</Feature>
            <Feature tone="light" art="@medal" title="Powered by instructors">Instructors are paid from membership income, so sharing their expertise is worth their while.</Feature>
          </div>
        </Wrap>
      </Section>
      <Section>
        <Wrap className="text-center">
          <h2 className="font-display text-[clamp(2rem,3.8vw,3rem)] font-bold tracking-[-0.03em]">Come and find your fit.</h2>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Btn href="/workouts/">Explore workouts →</Btn>
            <Btn href="/contact/" variant="ghost">Get in touch</Btn>
          </div>
        </Wrap>
      </Section>
    </main>
  );
}
