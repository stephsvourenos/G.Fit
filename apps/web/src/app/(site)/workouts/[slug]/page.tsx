import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CATEGORY_LABEL, formatDuration, suitabilityLabel } from "@app/domain";
import { PublicWorkoutCard, WorkoutArt } from "@/components/site/PublicCards";
import { Btn, CheckList, PageHero, Section, SectionHeading, Tag, Wrap } from "@/components/site/ui";
import { audienceOf, equipmentText, getCatalogue, INTENSITY_LABEL } from "@/lib/public-catalogue";

export async function generateStaticParams() {
  const { workouts } = await getCatalogue();
  return workouts.map((w) => ({ slug: w.slug }));
}

async function find(slug: string) {
  const cat = await getCatalogue();
  return { cat, w: cat.workouts.find((x) => x.slug === slug) };
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const { w } = await find(slug);
  if (!w) return { title: "Workout not found" };
  const by = w.instructorName ? ` with ${w.instructorName}` : "";
  return {
    title: `${w.title} — ${formatDuration(w.durationSec)} ${CATEGORY_LABEL[w.category] ?? ""} workout`,
    description: `${w.description} ${formatDuration(w.durationSec)}${by}. ${equipmentText(w)}. Included in G.Fit membership.`.slice(0, 300),
    alternates: { canonical: `/workouts/${w.slug}/` },
  };
}

export default async function WorkoutPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { cat, w } = await find(slug);
  if (!w) notFound();
  const more = [
    ...cat.workouts.filter((x) => x.slug !== w.slug && (x.category === w.category || (w.instructorSlug && x.instructorSlug === w.instructorSlug))),
    ...cat.workouts.filter((x) => x.slug !== w.slug && x.category !== w.category),
  ].filter((x, i, a) => a.findIndex((y) => y.slug === x.slug) === i).slice(0, 4);
  const minutes = Math.round(w.durationSec / 60);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ExercisePlan",
    name: w.title,
    description: w.description,
    exerciseType: CATEGORY_LABEL[w.category] ?? w.category,
    activityDuration: `PT${minutes}M`,
    intensity: INTENSITY_LABEL[w.intensity],
    ...(w.instructorName ? { author: { "@type": "Person", name: w.instructorName } } : {}),
  };

  return (
    <main>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <PageHero eyebrow={`${CATEGORY_LABEL[w.category] ?? w.category} workout`} title={w.title}
        crumbs={[{ href: "/workouts/", label: "Workouts" }, { label: w.title }]} />
      <Wrap className="py-12 sm:py-16">
        <div className="grid items-center gap-10 lg:grid-cols-[1.05fr_1fr]">
          <div className="relative aspect-[1.2] overflow-hidden rounded-[22px] ring-1 ring-line">
            <WorkoutArt w={w} big />
            <div className="absolute bottom-4 left-4"><Tag>Included with membership</Tag></div>
          </div>
          <div>
            <p className="text-lg text-paper/85">{w.description}</p>
            <div className="mt-6 flex flex-wrap gap-2 text-sm">
              {[formatDuration(w.durationSec), INTENSITY_LABEL[w.intensity], equipmentText(w), suitabilityLabel(w.ageBands)].map((t) => (
                <span key={t} className="rounded-lg bg-ink-2 px-3 py-2 ring-1 ring-line">{t}</span>
              ))}
            </div>
            <p className="mt-5 text-sm text-muted">
              {w.instructorSlug ? <>With <Link href={`/instructors/${w.instructorSlug}/`} className="font-bold text-coral-2 hover:text-white">{w.instructorName}</Link></> : "With one of our junior coaches"}
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Btn href="/join/">Start your free trial</Btn>
              <Btn href="/watch/" variant="ghost">Members: watch now</Btn>
            </div>
          </div>
        </div>
      </Wrap>
      <Section tone="alt">
        <Wrap className="grid gap-5 md:grid-cols-2">
          <div className="rounded-[18px] bg-ink-2 p-7 ring-1 ring-line">
            <h2 className="font-display text-xl font-bold">Workout details</h2>
            <dl className="mt-5 grid grid-cols-[120px_1fr] gap-3 text-sm">
              <dt className="text-muted">Type</dt><dd>{CATEGORY_LABEL[w.category] ?? w.category}</dd>
              <dt className="text-muted">Length</dt><dd>{formatDuration(w.durationSec)}</dd>
              <dt className="text-muted">Intensity</dt><dd>{INTENSITY_LABEL[w.intensity]}</dd>
              <dt className="text-muted">Equipment</dt><dd>{equipmentText(w)}</dd>
              <dt className="text-muted">Who it’s for</dt><dd>{suitabilityLabel(w.ageBands)}</dd>
              <dt className="text-muted">Captions</dt><dd>{w.captions ? "Yes, English" : "Coming soon"}</dd>
              {w.accessibilityNotes && <><dt className="text-muted">Accessibility</dt><dd>{w.accessibilityNotes}</dd></>}
              <dt className="text-muted">Membership</dt><dd>Included</dd>
            </dl>
          </div>
          <div className="rounded-[18px] bg-ink-2 p-7 ring-1 ring-line">
            <h2 className="font-display text-xl font-bold">Before you start</h2>
            <p className="mt-3 text-sm text-muted">
              Move at a pace that suits you, and stop if anything hurts. If you have an injury or health condition, check with a
              qualified health professional first.
            </p>
            <CheckList items={[
              "Included in your membership, with no extra charge",
              audienceOf(w) === "Adults" ? "Shown on adult profiles" : "Only shown on profiles of the right age",
              "Your own progress and favourites on every profile",
            ]} />
          </div>
        </Wrap>
      </Section>
      {more.length > 0 && (
        <Section>
          <Wrap>
            <SectionHeading eyebrow="Keep discovering" title="You might like these, too." href="/workouts/" />
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">{more.map((x) => <PublicWorkoutCard key={x.slug} w={x} />)}</div>
          </Wrap>
        </Section>
      )}
    </main>
  );
}
