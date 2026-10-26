import { brand } from "@app/config";
import { SiteFooter, SiteNav } from "@/components/SiteChrome";

export const metadata = { title: "Support" };

export default function Support() {
  return (
    <main className="flex-1 bg-paper">
      <SiteNav />
      <section className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <h1 className="font-display text-4xl text-ink">How can we help?</h1>
        <div className="mt-8 space-y-4">
          {[
            ["How do I cancel?", "Sign in on the website, open Family account → Manage membership. You keep access until the end of the period you’ve paid for."],
            ["I forgot the parent PIN", "The account owner can reset it from a link sent to the account email."],
            ["Can my child have their own login?", "No. Children use a profile inside the parent’s household account — no child email or payment details are ever collected."],
            ["Is this safe for my kids?", "Every workout is reviewed before publishing, profiles only show age-appropriate content, and there’s no chat, comments or ads."],
          ].map(([q, a]) => (
            <details key={q} className="rounded-2xl bg-white p-5 ring-1 ring-ink/10">
              <summary className="cursor-pointer font-semibold text-ink">{q}</summary>
              <p className="mt-2 text-ink/70">{a}</p>
            </details>
          ))}
        </div>
        <p className="mt-8 text-ink/70">Still stuck? Email <b>{brand.supportEmail}</b> (placeholder).</p>
      </section>
      <SiteFooter />
    </main>
  );
}
