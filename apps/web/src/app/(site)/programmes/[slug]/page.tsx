import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CATEGORY_LABEL, formatDuration, suitabilityLabel } from "@app/domain";
import { ProgrammeArt, ProgrammeCard } from "@/components/site/PublicCards";
import { Btn, PageHero, Section, SectionHeading, Tag, Wrap } from "@/components/site/ui";
import { equipmentText, getCatalogue, INTENSITY_LABEL } from "@/lib/public-catalogue";

export async function generateStaticParams() {
  const { programmes } = await getCatalogue();
  return programmes.map((p) => ({ slug: p.slug }));
}

async function find(slug: string) {
  const cat = await getCatalogue();
  return { cat, p: cat.programmes.find((x) => x.slug === slug) };
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const { p } = await find(slug);
  if (!p) return { title: "Programme not found" };
  return {
    title: `${p.title} — ${p.workoutCount}-session programme`,
    description: `${p.description} ${p.workoutCount} sessions${p.instructorName ? ` with ${p.instructorName}` : ""}. Included in G.Fit membership.`.slice(0, 300),
    alternates: { canonical: `/programmes/${p.slug}/` },
  };
}

export default async function ProgrammePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { cat, p } = await find(slug);
  if (!p) notFound();
  const bySlug = new Map(cat.workouts.map((w) => [w.slug, w]));
  const steps = p.steps.map((s) => bySlug.get(s)).filter((w) => w !== undefined);
  const others = cat.programmes.filter((x) => x.slug !== p.slug).slice(0, 3);
  const minutes = Math.round(p.totalDurationSec / 60);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ExercisePlan",
    name: p.title,
    description: p.description,
    activityDuration: `PT${minutes}M`,
    ...(p.instructorName ? { author: { "@type": "Person", name: p.instructorName } } : {}),
  };

  return (
    <main>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <PageHero eyebrow="Guided programme" title={p.title} crumbs={[{ href: "/programmes/", label: "Programmes" }, { label: p.title }]} />
      <Wrap className="py-12 sm:py-16">
        <div className="grid items-center gap-10 lg:grid-cols-[1.05fr_1fr]">
          <div className="relative aspect-[1.2] overflow-hidden rounded-[22px] ring-1 ring-line">
            <ProgrammeArt p={p} big />
            <div className="absolute bottom-4 left-4"><Tag>Included with membership</Tag></div>
          </div>
          <div>
            <h2 className="font-display text-[clamp(1.8rem,3.2vw,2.6rem)] font-bold leading-[1.05] tracking-[-0.03em]">A little structure. A lot more momentum.</h2>
            <p className="mt-4 text-lg text-paper/85">{p.description}</p>
            <div className="mt-6 flex flex-wrap gap-2 text-sm">
              {[`${p.workoutCount} session${p.workoutCount === 1 ? "" : "s"}`, `${minutes} min in total`, suitabilityLabel(p.ageBands), ...p.categories.map((c) => CATEGORY_LABEL[c] ?? c)].map((t) => (
                <span key={t} className="rounded-lg bg-ink-2 px-3 py-2 ring-1 ring-line">{t}</span>
              ))}
            </div>
            <p className="mt-5 text-sm text-muted">
              {p.instructorSlug ? <>Programme by <Link href={`/instructors/${p.instructorSlug}/`} className="font-bold text-coral-2 hover:text-white">{p.instructorName}</Link></> : "Programme by G.Fit coaches"}
            </p>
            <p className="mt-5 font-bold">Included in your G.Fit membership. There’s nothing extra to buy.</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Btn href="/join/">Start your free trial</Btn>
              <Btn href="/watch/" variant="ghost">Members: start now</Btn>
            </div>
          </div>
        </div>
      </Wrap>
      <Section tone="alt">
        <Wrap>
          <SectionHeading eyebrow="Inside the programme" title="Session by session" desc="Do them in order, at your own pace. Every session can also be watched on its own." />
          <ol className="grid gap-3">
            {steps.map((w, n) => (
              <li key={w.slug}>
                <Link href={`/workouts/${w.slug}/`} className="flex items-center gap-4 rounded-[16px] bg-ink-2 p-4 ring-1 ring-line transition hover:ring-coral/60">
                  <span className="font-display grid h-10 w-10 shrink-0 place-items-center rounded-full bg-coral font-bold">{n + 1}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-bold">{w.title}</span>
                    <span className="block truncate text-sm text-muted">{formatDuration(w.durationSec)} · {INTENSITY_LABEL[w.intensity]} · {equipmentText(w)}</span>
                  </span>
                  <span aria-hidden className="text-coral-2">→</span>
                </Link>
              </li>
            ))}
          </ol>
        </Wrap>
      </Section>
      {others.length > 0 && (
        <Section>
          <Wrap>
            <SectionHeading eyebrow="More to explore" title="Other programmes you may love." href="/programmes/" />
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{others.map((x) => <ProgrammeCard key={x.slug} p={x} />)}</div>
          </Wrap>
        </Section>
      )}
    </main>
  );
}
