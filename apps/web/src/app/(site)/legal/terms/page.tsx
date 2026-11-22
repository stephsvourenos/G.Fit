import { PageHero, Wrap } from "@/components/site/ui";

export const metadata = { title: "Terms of Service", alternates: { canonical: "/legal/terms/" } };

/* Draft text is with the lawyer ("G.Fit legal drafts for lawyer review"). Publish the reviewed version here; until then this stays a placeholder. */
export default function Page() {
  return (
    <main>
      <PageHero eyebrow="Legal information" title="Terms of Service" crumbs={[{ label: "Terms" }]} />
      <Wrap className="max-w-3xl py-12 sm:py-16">
        <div className="rounded-2xl bg-sun/15 p-5 text-sm font-bold text-sun ring-1 ring-sun/40" role="note">
          Draft under legal review. This page isn’t final and isn’t in force yet.
        </div>
        <p className="mt-8 text-lg text-paper/80">This page will set out, in plain English, membership terms, automatic renewal and cancellation, refunds consistent with the Australian Consumer Law, acceptable use, health and safety notices for exercise, and the rules for household profiles.</p>
      </Wrap>
    </main>
  );
}
