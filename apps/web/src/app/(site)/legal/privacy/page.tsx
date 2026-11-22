import { PageHero, Wrap } from "@/components/site/ui";

export const metadata = { title: "Privacy Policy", alternates: { canonical: "/legal/privacy/" } };

/* Draft text is with the lawyer ("G.Fit legal drafts for lawyer review"). Publish the reviewed version here; until then this stays a placeholder. */
export default function Page() {
  return (
    <main>
      <PageHero eyebrow="Legal information" title="Privacy Policy" crumbs={[{ label: "Privacy" }]} />
      <Wrap className="max-w-3xl py-12 sm:py-16">
        <div className="rounded-2xl bg-sun/15 p-5 text-sm font-bold text-sun ring-1 ring-sun/40" role="note">
          Draft under legal review. This page isn’t final and isn’t in force yet.
        </div>
        <p className="mt-8 text-lg text-paper/80">This page will set out, in plain English, what household and child-profile information we collect (minimal: nickname, age band, activity), why, how long we keep it, who processes it (e.g. our hosting, video and payment providers), and how parents can access, export or delete it. It must be reviewed against the Australian Privacy Act and the OAIC Children’s Online Privacy Code once registered.</p>
      </Wrap>
    </main>
  );
}
