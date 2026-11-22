import type { Metadata } from "next";
import Link from "next/link";
import { Faq, PageHero, Wrap } from "@/components/site/ui";
import { FAQS } from "@/lib/site-content";

export const metadata: Metadata = {
  title: "Help & FAQs",
  description: "Answers about G.Fit membership, the free trial, cancelling, profiles, the parent PIN and watching on your devices.",
  alternates: { canonical: "/support/" },
};

const ACCOUNT = [
  ["I forgot my password", "Use “Forgot password” on the sign-in page and we’ll email you a link to choose a new one."],
  ["I forgot the parent PIN", "The account owner can change the PIN in their account. If you can’t get in, contact us and we’ll help."],
  ["Can my child have their own login?", "No. Children use a profile inside the account owner’s membership. We never ask for a child’s email, photo or payment details."],
  ["How do I close my account?", "Cancel your membership first, then choose Close account in your account settings. We keep only the financial records the law requires."],
  ["Can I download my information?", "Yes. The account owner can download a copy of the household’s information from their account at any time."],
] as const;

export default function SupportPage() {
  return (
    <main>
      <PageHero eyebrow="G.Fit help" title="How can we help?" crumbs={[{ label: "Help" }]}
        lead="Answers about membership, workouts, profiles and getting started." />
      <Wrap className="grid gap-10 py-12 sm:py-16 lg:grid-cols-[1.4fr_1fr]">
        <div>
          <h2 className="font-display mb-4 text-2xl font-bold">Frequently asked questions</h2>
          <Faq tone="dark" items={FAQS} />
          <h2 className="font-display mb-4 mt-12 text-2xl font-bold">Your account</h2>
          <Faq tone="dark" items={ACCOUNT} />
        </div>
        <aside className="h-fit rounded-[20px] bg-ink-2 p-7 ring-1 ring-line lg:sticky lg:top-24">
          <h2 className="font-display text-xl font-bold">Need something else?</h2>
          <p className="mt-2 text-sm text-muted">Our support inbox opens at launch. You’ll find the address on the contact page.</p>
          <ul className="mt-5 grid gap-2.5 text-sm font-bold text-coral-2">
            <li><Link href="/contact/" className="hover:text-white">Contact G.Fit →</Link></li>
            <li><Link href="/pricing/" className="hover:text-white">Membership and pricing →</Link></li>
            <li><Link href="/everyone/" className="hover:text-white">Household and kids’ profiles →</Link></li>
            <li><Link href="/account/sign-in/" className="hover:text-white">Sign in →</Link></li>
          </ul>
        </aside>
      </Wrap>
    </main>
  );
}
