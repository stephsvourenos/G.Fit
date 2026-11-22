import type { Metadata } from "next";
import { plans } from "@app/config";
import { Btn, CheckList, Eyebrow, Feature, PageHero, ProfileVisual, Section, SectionHeading, Wrap } from "@/components/site/ui";
import { Art } from "@/components/site/Art";

export const metadata: Metadata = {
  title: "Individuals & families",
  description: `G.Fit works just for you, or for everyone at home: up to ${plans.maxProfiles} profiles, age-appropriate workouts for kids and a parent PIN.`,
  alternates: { canonical: "/everyone/" },
};

const h2 = "font-display mt-3 text-[clamp(2rem,3.8vw,3rem)] font-bold leading-[1.05] tracking-[-0.03em]";

export default function EveryonePage() {
  return (
    <main>
      <PageHero eyebrow="Individuals & families" title="For you. And everyone else at home." crumbs={[{ label: "For everyone" }]}
        lead="The complete fitness experience when it’s just you, with the option to add personal profiles for the people you live with." />
      <Section>
        <Wrap className="grid items-center gap-12 lg:grid-cols-2">
          <div>
            <Eyebrow>Start with yourself</Eyebrow>
            <h2 className={h2}>You don’t need a family to belong here.</h2>
            <p className="mt-4 text-lg text-paper/75">
              G.Fit starts with your own workouts, favourite instructors and preferences. Joining on your own isn’t a cut-down
              family plan. It’s the full experience.
            </p>
            <CheckList items={[
              "One profile works perfectly",
              "Find workouts that match your interests and level",
              "Save favourites and pick up where you left off",
              "Add household profiles later, if and when you want",
            ]} />
            <Btn href="/join/" className="mt-7">Start with your own profile →</Btn>
          </div>
          <div className="grid grid-cols-3 gap-4 rounded-[22px] bg-ink-2 p-8 ring-1 ring-line" aria-hidden>
            {["@yoga1", "@run1", "@lift1", "@danc2", "@bike1", "@hike1"].map((id) => <Art key={id} id={id} size={110} className="mx-auto" />)}
          </div>
        </Wrap>
      </Section>
      <Section tone="alt">
        <Wrap className="grid items-center gap-12 lg:grid-cols-2">
          <ProfileVisual />
          <div>
            <Eyebrow>Share the benefits</Eyebrow>
            <h2 className={h2}>One membership. Your own space.</h2>
            <p className="mt-4 text-lg text-paper/75">
              Up to {plans.maxProfiles} people can each enjoy their own kind of movement, without mixing up each other’s
              recommendations or progress.
            </p>
            <CheckList items={[
              "Separate interests, favourites and progress",
              "Age-appropriate workouts on younger people’s profiles",
              "A parent PIN for adult workouts, profiles and billing",
              "No extra cost for each profile",
            ]} />
            <Btn href="/pricing/" variant="ghost" className="mt-7">See what’s included →</Btn>
          </div>
        </Wrap>
      </Section>
      <Section tone="light">
        <Wrap>
          <SectionHeading tone="light" eyebrow="Kids’ movement" title="Fun for their age. Reassurance for you."
            desc="Kids and teens need a different experience from adults, so their workouts, access and settings are different too." />
          <div className="grid gap-5 md:grid-cols-3">
            <Feature tone="light" art="@bunny" title="Little movers">Playful movement and balance games for the youngest members of the house.</Feature>
            <Feature tone="light" art="@socc" title="Kids & teens">Dance, sport skills and strength basics made for younger bodies, with good technique first.</Feature>
            <Feature tone="light" art="@star" title="Parents stay in charge">
              Children’s profiles need only a nickname and an age group. They only show approved workouts, and the PIN keeps adult
              workouts, settings and billing locked.
            </Feature>
          </div>
          <p className="mt-6 max-w-3xl text-sm text-ink/65">
            Every workout is checked by our team before it’s published. There are no ads, comments or chat, and no diet or
            weight-loss content for children.
          </p>
        </Wrap>
      </Section>
      <Section>
        <Wrap className="text-center">
          <Eyebrow>Any age. One way to begin.</Eyebrow>
          <h2 className={h2}>Start with you. Add others later.</h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-paper/75">Your membership grows with your household, without a family-first sign-up.</p>
          <Btn href="/join/" className="mt-7">Create your G.Fit account</Btn>
        </Wrap>
      </Section>
    </main>
  );
}
