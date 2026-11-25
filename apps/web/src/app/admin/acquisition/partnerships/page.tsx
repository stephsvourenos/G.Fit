import Link from "next/link";
import { PageHeader } from "@/components/AdminShell";

export const metadata = { title: "Partnerships · Creator Acquisition" };

export default function Page() {
  return (
    <>
      <PageHeader title="Partnerships" sub="Phase 3 — organisation partnerships" />
      <div className="max-w-2xl rounded-xl bg-white p-6 text-sm text-ink/70 ring-1 ring-ink/5">
        <p>A separate pipeline for fitness education organisations, associations, communities, studios and podcasts, with their own application links so we can see which partners bring in creators. That arrives in Phase 3.</p>
        <p className="mt-3">Until then, track these creators on the <Link href="/admin/acquisition/pipeline/" className="underline">Recruitment Pipeline</Link> and in <Link href="/admin/acquisition/today/" className="underline">Today’s Tasks</Link>.</p>
      </div>
    </>
  );
}
