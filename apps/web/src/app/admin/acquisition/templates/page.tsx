import { PageHeader } from "@/components/AdminShell";
import { NeedsDatabase } from "../_ui";
import { Templates } from "./Templates";

export const metadata = { title: "Templates · Creator Acquisition" };

export default function Page() {
  return (
    <>
      <PageHeader title="Templates" sub="Message templates for every channel and stage. Every edit is saved as a new version. Merge fields only use real facts — gaps are flagged for you to fill, never invented." />
      <NeedsDatabase><Templates /></NeedsDatabase>
    </>
  );
}
