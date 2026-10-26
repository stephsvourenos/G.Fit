import { SiteFooter, SiteNav } from "@/components/SiteChrome";

export const metadata = { title: "Privacy Policy" };

export default function Page() {
  return (
    <main className="flex-1 bg-paper">
      <SiteNav />
      <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <div className="rounded-2xl border-2 border-coral bg-coral/5 p-4 text-sm font-semibold text-ink">
          PLACEHOLDER — REQUIRES LEGAL REVIEW BEFORE LAUNCH. Not legal advice and not in force.
        </div>
        <h1 className="font-display mt-8 text-4xl text-ink">Privacy Policy</h1>
        <p className="mt-4 text-ink/70">This page will set out, in plain English, what household and child-profile information we collect (minimal: nickname, age band, activity), why, how long we keep it, who processes it (e.g. our hosting, video and payment providers), and how parents can access, export or delete it. It must be reviewed against the Australian Privacy Act and the OAIC Children’s Online Privacy Code once registered.</p>
      </article>
      <SiteFooter />
    </main>
  );
}
