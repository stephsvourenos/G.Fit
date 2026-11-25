import Link from "next/link";
import { PageHeader } from "@/components/AdminShell";

export const metadata = { title: "Applications · Creator Acquisition" };

export default function Page() {
  return (
    <>
      <PageHeader title="Applications" sub="Phase 2 — application and approval" />
      <div className="max-w-2xl rounded-xl bg-white p-6 text-sm text-ink/70 ring-1 ring-ink/5">
        <p>Creator applications will be listed here once the founding creator landing page and personalised application links are built (Phase 2). Approved applicants will move straight into the existing creator account and onboarding workflow.</p>
        <p className="mt-3">Until then, track these creators on the <Link href="/admin/acquisition/pipeline/" className="underline">Recruitment Pipeline</Link> and in <Link href="/admin/acquisition/today/" className="underline">Today’s Tasks</Link>.</p>
      </div>
    </>
  );
}
