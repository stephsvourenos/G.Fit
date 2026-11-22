import type { Metadata } from "next";
import { ProgrammeCard } from "@/components/site/PublicCards";
import { Btn, EmptyState, PageHero, Strip, Wrap } from "@/components/site/ui";
import { getCatalogue } from "@/lib/public-catalogue";

export const metadata: Metadata = {
  title: "Programmes",
  description: "G.Fit programmes put workouts in order around a style or goal. Every programme is included in your membership.",
  alternates: { canonical: "/programmes/" },
};

export default async function ProgrammesPage() {
  const { programmes } = await getCatalogue();
  return (
    <main>
      <PageHero eyebrow="Workout programmes" title="Go beyond one workout." crumbs={[{ label: "Programmes" }]}
        lead="Follow a guided series when you want more structure, or pick any single workout when you just want to press play. Every programme is included in your membership." />
      <Wrap className="py-12 sm:py-16">
        {programmes.length ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{programmes.map((p) => <ProgrammeCard key={p.slug} p={p} />)}</div>
        ) : (
          <EmptyState title="Programmes are coming soon" action={<Btn href="/workouts/">Browse workouts →</Btn>}>
            Our instructors are putting together the first programmes now. In the meantime, every workout is ready to explore.
          </EmptyState>
        )}
        <Strip title="Just want to press play?" action={<Btn href="/workouts/">Browse workouts →</Btn>}>
          Every workout in every programme can also be watched on its own.
        </Strip>
      </Wrap>
    </main>
  );
}
