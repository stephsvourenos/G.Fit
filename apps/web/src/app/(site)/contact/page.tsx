import type { Metadata } from "next";
import { Btn, CheckList, PageHero, Wrap } from "@/components/site/ui";

export const metadata: Metadata = {
  title: "Contact",
  description: "Get in touch with G.Fit about membership, your account or teaching on G.Fit.",
  alternates: { canonical: "/contact/" },
};

/*
 * No support inbox exists yet (it needs the final domain and an email provider, decision D6). Until then this page
 * says so plainly rather than showing a form that goes nowhere. Replace with the real address and a working form at launch.
 */
export default function ContactPage() {
  return (
    <main>
      <PageHero eyebrow="Get in touch" title="Let’s talk." crumbs={[{ label: "Contact" }]}
        lead="Questions about joining, your account or teaching on G.Fit? Here’s where to start." />
      <Wrap className="grid gap-6 py-12 sm:py-16 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-[22px] bg-white p-7 text-ink sm:p-9">
          <h2 className="font-display text-3xl font-bold tracking-[-0.02em]">Our inbox opens at launch</h2>
          <p className="mt-3 text-ink/70">
            G.Fit is getting ready to launch, and our support email address will appear right here before we open to
            members. Until then, most answers are in the help centre.
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl bg-page p-5">
              <div className="font-bold">Membership & billing</div>
              <p className="mt-1 text-sm text-ink/65">Prices, the free trial, cancelling and refunds.</p>
            </div>
            <div className="rounded-2xl bg-page p-5">
              <div className="font-bold">Your account</div>
              <p className="mt-1 text-sm text-ink/65">Signing in, passwords, profiles and the parent PIN.</p>
            </div>
            <div className="rounded-2xl bg-page p-5">
              <div className="font-bold">Teaching on G.Fit</div>
              <p className="mt-1 text-sm text-ink/65">How instructors join, earn and get paid.</p>
            </div>
            <div className="rounded-2xl bg-page p-5">
              <div className="font-bold">Something else</div>
              <p className="mt-1 text-sm text-ink/65">Press, partnerships and general questions.</p>
            </div>
          </div>
          <Btn href="/support/" variant="dark" className="mt-7">Browse the help centre →</Btn>
        </div>
        <aside className="rounded-[22px] bg-ink-2 p-7 ring-1 ring-line">
          <h2 className="font-display text-xl font-bold">How we’ll support members</h2>
          <CheckList items={[
            "A real person answering a monitored inbox",
            "Cancel online at any time, with no call needed",
            "Password reset by email, and help if you’re locked out",
            "A separate route for instructor enquiries",
          ]} />
          <div className="mt-7 flex flex-wrap gap-3">
            <Btn href="/account/forgot/" variant="ghost" size="sm">Forgot password</Btn>
            <Btn href="/teach/" variant="ghost" size="sm">Teach on G.Fit</Btn>
          </div>
        </aside>
      </Wrap>
    </main>
  );
}
