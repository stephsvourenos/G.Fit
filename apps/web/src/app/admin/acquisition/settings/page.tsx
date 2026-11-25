import { PageHeader } from "@/components/AdminShell";
import { NeedsDatabase } from "../_ui";
import { CrmSettings } from "./CrmSettings";

export const metadata = { title: "Settings · Creator Acquisition" };

export default function Page() {
  return (
    <>
      <PageHeader title="Settings" sub="Targets, the daily queue, scoring and pipeline stages for the creator CRM." />
      <NeedsDatabase><CrmSettings /></NeedsDatabase>
    </>
  );
}
