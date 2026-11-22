import type { Metadata } from "next";
import { InstructorCard } from "@/components/site/PublicCards";
import { Btn, EmptyState, PageHero, Strip, Wrap } from "@/components/site/ui";
import { getCatalogue } from "@/lib/public-catalogue";

export const metadata: Metadata = {
  title: "Instructors",
  description: "Meet the instructors and coaches behind G.Fit workouts: Pilates, dance, strength, mobility and more.",
  alternates: { canonical: "/instructors/" },
};

export default async function InstructorsPage() {
  const { instructors } = await getCatalogue();
  return (
    <main>
      <PageHero eyebrow="Instructors & coaches" title="Meet the people who move you." crumbs={[{ label: "Instructors" }]}
        lead="Find the teaching styles and personalities behind the workouts, and the instructors who make you want to come back." />
      <Wrap className="py-12 sm:py-16">
        {instructors.length ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{instructors.map((i) => <InstructorCard key={i.slug} i={i} />)}</div>
        ) : (
          <EmptyState title="Our first instructors are joining now">
            Instructor profiles appear here once their first workout is published.
          </EmptyState>
        )}
        <Strip title="Teach fitness? Share what you love." action={<Btn href="/teach/">Teach on G.Fit →</Btn>}>
          Find out how G.Fit pays instructors and helps members find you.
        </Strip>
      </Wrap>
    </main>
  );
}
