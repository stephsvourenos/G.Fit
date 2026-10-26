import { notFound } from "next/navigation";
import { creators, instructors } from "@app/mock-data";
import { SiteNav } from "@/components/SiteChrome";
import { CaptureReferral } from "./CaptureReferral";

export function generateStaticParams() {
  return creators.map((c) => ({ code: c.referralCode }));
}

export default async function ReferralLanding({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const creator = creators.find((c) => c.referralCode === code.toUpperCase());
  if (!creator) notFound();
  const ins = instructors.find((i) => i.creatorId === creator.id)!;
  return (
    <main className="flex-1 bg-paper">
      <SiteNav />
      <section className="mx-auto max-w-3xl px-4 py-14 text-center sm:px-6">
        <div className="mx-auto grid h-20 w-20 place-items-center rounded-3xl font-display text-3xl text-white" style={{ background: ins.accent }}>
          {ins.displayName.split(" ").pop()![0]}
        </div>
        <p className="mt-6 text-sm font-bold uppercase tracking-wider text-coral">Invited by {creator.displayName}</p>
        <h1 className="font-display mt-2 text-5xl text-ink">Train with {ins.displayName.replace("Junior ", "")} and the whole crew.</h1>
        <p className="mx-auto mt-4 max-w-xl text-lg text-ink/70">{ins.bio} Join and get a profile for everyone in your household.</p>
        <CaptureReferral code={creator.referralCode} />
      </section>
    </main>
  );
}
