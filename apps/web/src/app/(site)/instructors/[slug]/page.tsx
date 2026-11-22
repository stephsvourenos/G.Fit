import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CATEGORY_LABEL } from "@app/domain";
import { Art, CATEGORY_ART } from "@/components/site/Art";
import { PublicWorkoutCard } from "@/components/site/PublicCards";
import { Btn, PageHero, Section, SectionHeading, Wrap } from "@/components/site/ui";
import { getCatalogue } from "@/lib/public-catalogue";

export async function generateStaticParams() {
  const { instructors } = await getCatalogue();
  return instructors.map((i) => ({ slug: i.slug }));
}

async function find(slug: string) {
  const cat = await getCatalogue();
  return { cat, i: cat.instructors.find((x) => x.slug === slug) };
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const { i } = await find(slug);
  if (!i) return { title: "Instructor not found" };
  const what = i.specialties.map((s) => CATEGORY_LABEL[s] ?? s).join(" & ");
  return {
    title: `${i.name}${what ? ` — ${what} instructor` : ""}`,
    description: `${i.bio} Workouts with ${i.name} are included in G.Fit membership.`.slice(0, 300),
    alternates: { canonical: `/instructors/${i.slug}/` },
  };
}

export default async function InstructorPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { cat, i } = await find(slug);
  if (!i) notFound();
  const ws = cat.workouts.filter((w) => w.instructorSlug === i.slug);
  const jsonLd = { "@context": "https://schema.org", "@type": "Person", name: i.name, description: i.bio, jobTitle: "Fitness instructor" };

  return (
    <main>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <PageHero eyebrow="Meet your instructor" title={i.name} crumbs={[{ href: "/instructors/", label: "Instructors" }, { label: i.name }]} />
      <Wrap className="py-12 sm:py-16">
        <div className="grid items-center gap-10 lg:grid-cols-[1fr_1.1fr]">
          <div className="relative grid aspect-[1.15] place-items-center overflow-hidden rounded-[22px] ring-1 ring-line"
            style={{ background: `radial-gradient(ellipse at 60% 30%, ${i.accent}, #211e2b 75%)` }}>
            {i.portraitUrl
              // eslint-disable-next-line @next/next/no-img-element -- consented coach portrait from our storage
              ? <img src={i.portraitUrl} alt={`${i.name}, G.Fit instructor`} className="absolute inset-0 h-full w-full object-cover" />
              : <Art id={i.specialties[0] ? CATEGORY_ART[i.specialties[0]] ?? "@star" : "@star"} size={160} />}
          </div>
          <div>
            <div className="text-sm font-bold uppercase tracking-[0.14em] text-coral-2">{i.specialties.map((s) => CATEGORY_LABEL[s] ?? s).join(" & ")}</div>
            <p className="mt-4 text-lg text-paper/85">{i.bio}</p>
            <div className="mt-6 flex flex-wrap gap-2">
              {i.specialties.map((s) => <span key={s} className="rounded-full bg-ink-2 px-4 py-2 text-sm ring-1 ring-line">{CATEGORY_LABEL[s] ?? s}</span>)}
            </div>
            <div className="mt-7 flex flex-wrap gap-3">
              <Btn href="/join/">Start your free trial</Btn>
              <Btn href="/workouts/" variant="ghost">Explore all workouts</Btn>
            </div>
          </div>
        </div>
      </Wrap>
      <Section tone="alt">
        <Wrap>
          <SectionHeading eyebrow="Included in G.Fit" title={`Workouts with ${i.name}`}
            desc={`All ${ws.length} of ${i.name}’s workouts on G.Fit come with your membership.`} />
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">{ws.map((w) => <PublicWorkoutCard key={w.slug} w={w} />)}</div>
        </Wrap>
      </Section>
    </main>
  );
}
