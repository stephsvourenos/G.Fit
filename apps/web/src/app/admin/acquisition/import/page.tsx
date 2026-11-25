import { PageHeader } from "@/components/AdminShell";
import { NeedsDatabase } from "../_ui";
import { ImportWizard } from "./ImportWizard";

export const metadata = { title: "Import prospects · Creator Acquisition" };

export default function Page() {
  return (
    <>
      <PageHeader title="Import prospects" sub="Bring in creator research from ChatGPT Work (CSV or Excel). Duplicates are checked against everyone already in the CRM, and nothing about existing outreach, notes or stages is ever overwritten." />
      <NeedsDatabase><ImportWizard /></NeedsDatabase>
    </>
  );
}
