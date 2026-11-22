import type { Metadata } from "next";
import { Btn, EmptyState, PageHero, Strip, Wrap } from "@/components/site/ui";
import { getCatalogue } from "@/lib/public-catalogue";
import { WorkoutBrowser } from "./WorkoutBrowser";

export const metadata: Metadata = {
  title: "Workouts",
  description: "Browse G.Fit workouts by type, length, intensity and equipment. Pilates, dance, strength, mobility and more, all included in one membership.",
  alternates: { canonical: "/workouts/" },
};

export default async function WorkoutsPage() {
  const { workouts, ok } = await getCatalogue();
  return (
    <main>
      <PageHero eyebrow="Discover workouts" title="Find a workout that feels like you." crumbs={[{ label: "Workouts" }]}
        lead="Browse by type, length, intensity or equipment. Every workout here is included in your G.Fit membership." />
      <Wrap className="py-12 sm:py-16">
        {workouts.length ? (
          <WorkoutBrowser workouts={workouts} />
        ) : (
          <EmptyState title={ok ? "Our first workouts are on their way" : "Workouts are taking a moment to load"}
            action={<Btn href="/join/">Join and be first to try them</Btn>}>
            {ok ? "We’re filming and checking the launch library now. Every workout will appear here as soon as it’s published."
              : "Please refresh the page in a minute."}
          </EmptyState>
        )}
        <Strip title="Want more structure?" action={<Btn href="/programmes/">Browse programmes →</Btn>}>
          Programmes put workouts in order around a style or goal.
        </Strip>
      </Wrap>
    </main>
  );
}
