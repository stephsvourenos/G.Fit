import { SiteFooter, SiteNav } from "@/components/SiteChrome";

export const metadata = { title: "Terms of Service" };

export default function Page() {
  return (
    <main className="flex-1 bg-paper">
      <SiteNav />
      <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <div className="rounded-2xl border-2 border-coral bg-coral/5 p-4 text-sm font-semibold text-ink">
          PLACEHOLDER — REQUIRES LEGAL REVIEW BEFORE LAUNCH. Not legal advice and not in force.
        </div>
        <h1 className="font-display mt-8 text-4xl text-ink">Terms of Service</h1>
        <p className="mt-4 text-ink/70">This page will set out, in plain English, membership terms, automatic renewal and cancellation, refunds consistent with the Australian Consumer Law, acceptable use, health and safety notices for exercise, and the rules for household profiles.</p>
      </article>
      <SiteFooter />
    </main>
  );
}
