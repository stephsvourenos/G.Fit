import type { Metadata } from "next";
import { Btn, EmptyState, PageHero, Wrap } from "@/components/site/ui";

export const metadata: Metadata = {
  title: "Programmes",
  description: "G.Fit programmes put workouts in order around a style or goal. Every programme is included in your membership.",
  alternates: { canonical: "/programmes/" },
};

/** Programmes arrive in a later stage (new table + admin screen). Until then this page says so honestly. */
export default function ProgrammesPage() {
  return (
    <main>
      <PageHero eyebrow="Workout programmes" title="Go beyond one workout." crumbs={[{ label: "Programmes" }]}
        lead="Follow a guided series when you want more structure, or pick any single workout when you just want to press play. Every programme is included in your membership." />
      <Wrap className="py-12 sm:py-16">
        <EmptyState title="Programmes are coming soon" action={<Btn href="/workouts/">Browse workouts →</Btn>}>
          Our instructors are putting together the first programmes now. In the meantime, every workout is ready to explore.
        </EmptyState>
      </Wrap>
    </main>
  );
}
