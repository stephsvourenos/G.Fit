import Link from "next/link";
import { PageHeader } from "@/components/AdminShell";

export const metadata = { title: "Onboarding · Creator Acquisition" };

export default function Page() {
  return (
    <>
      <PageHeader title="Onboarding" sub="Phase 2 — onboarding and launch readiness" />
      <div className="max-w-2xl rounded-xl bg-white p-6 text-sm text-ink/70 ring-1 ring-ink/5">
        <p>The onboarding checklist will update itself from real platform events — agreement accepted, workouts uploaded and approved, payout details, referral link — and show what’s stopping each creator from being launch-ready. That arrives in Phase 2.</p>
        <p className="mt-3">Until then, track these creators on the <Link href="/admin/acquisition/pipeline/" className="underline">Recruitment Pipeline</Link> and in <Link href="/admin/acquisition/today/" className="underline">Today’s Tasks</Link>.</p>
      </div>
    </>
  );
}
