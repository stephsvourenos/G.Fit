import type { Metadata } from "next";
import { aud, plans } from "@app/config";
import { CompareBlock, Eyebrow, Faq, Feature, PageHero, PriceCards, Section, SectionHeading, TrialTerms, Wrap } from "@/components/site/ui";
import { FAQS } from "@/lib/site-content";

export const metadata: Metadata = {
  title: "Pricing",
  description: `G.Fit membership is ${aud(plans.monthly.amount)} a month or ${aud(plans.annual.amount)} a year (AUD, GST included), with a ${plans.trialDays}-day free trial. Every workout from every instructor, for up to ${plans.maxProfiles} profiles.`,
  alternates: { canonical: "/pricing/" },
};

export default function PricingPage() {
  return (
    <main>
      <PageHero eyebrow="Membership & pricing" title="One membership. More ways to move." crumbs={[{ label: "Pricing" }]}
        lead="Every workout and programme on G.Fit, from every instructor. Use it just for you, or share it with up to five other people at home." />
      <Section tone="soft">
        <Wrap>
          <SectionHeading tone="light" eyebrow="Choose what works for you" title="A simple way to get more." />
          <PriceCards />
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {[
              ["Every workout included", "No add-ons and no extra programmes to buy."],
              ["Personal discovery", "Find the styles, lengths and instructors that suit each person."],
              [`Up to ${plans.maxProfiles} profiles`, "Use one profile on your own, or add the people you live with."],
            ].map(([t, d]) => (
              <div key={t} className="rounded-[18px] bg-white p-6 text-ink ring-1 ring-ink/10">
                <div className="font-bold">✓ {t}</div>
                <p className="mt-2 text-sm text-ink/65">{d}</p>
              </div>
            ))}
          </div>
          <TrialTerms />
        </Wrap>
      </Section>
      <Section>
        <Wrap><CompareBlock /></Wrap>
      </Section>
      <Section tone="alt">
        <Wrap>
          <h2 className="font-display mb-8 text-[clamp(2rem,3.8vw,3rem)] font-bold tracking-[-0.03em]">Clear access. No surprises.</h2>
          <div className="grid gap-5 md:grid-cols-3">
            <Feature art="@heart" title="Everything is included">Every workout and programme on G.Fit is part of your membership for as long as it’s active.</Feature>
            <Feature art="@watch" title="Cancel online">Cancel in your account at any time. You keep access until the end of the period you’ve paid for.</Feature>
            <Feature art="@medal" title="Other instructor products">Some instructors sell their own memberships or programmes elsewhere. Those are separate services and aren’t part of G.Fit.</Feature>
          </div>
        </Wrap>
      </Section>
      <Section tone="light">
        <Wrap className="max-w-3xl">
          <Eyebrow tone="light">Questions before joining?</Eyebrow>
          <h2 className="font-display mb-8 mt-3 text-[clamp(2rem,3.8vw,3rem)] font-bold tracking-[-0.03em]">Membership FAQs</h2>
          <Faq items={FAQS.slice(0, 7)} />
        </Wrap>
      </Section>
    </main>
  );
}
