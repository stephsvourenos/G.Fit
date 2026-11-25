import { Suspense } from "react";
import { PageHeader } from "@/components/AdminShell";
import { NeedsDatabase } from "../_ui";
import { ProspectList } from "./ProspectList";

export const metadata = { title: "All Prospects · Creator Acquisition" };

export default function Page() {
  return (
    <>
      <PageHeader title="All Prospects" sub="Every creator we've researched. Scores are research assessments, not commitments from the creator. Unknown means we don't know yet." />
      <NeedsDatabase><Suspense fallback={<p className="text-ink/60">Loading…</p>}><ProspectList /></Suspense></NeedsDatabase>
    </>
  );
}
