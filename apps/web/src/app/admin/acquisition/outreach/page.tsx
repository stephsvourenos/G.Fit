import { PageHeader } from "@/components/AdminShell";
import { NeedsDatabase } from "../_ui";
import { Outreach } from "./Outreach";

export const metadata = { title: "Outreach · Creator Acquisition" };

export default function Page() {
  return (
    <>
      <PageHeader title="Outreach" sub="Draft, review and log messages to creators. Nothing is ever sent automatically." />
      <NeedsDatabase><Outreach /></NeedsDatabase>
    </>
  );
}
