import { PageHeader } from "@/components/AdminShell";
import { NeedsDatabase } from "../_ui";
import { Pipeline } from "./Pipeline";

export const metadata = { title: "Recruitment Pipeline · Creator Acquisition" };

export default function Page() {
  return (
    <>
      <PageHeader title="Recruitment Pipeline" sub="Drag a card to move a creator. Stages marked 🔒 mean something really happened (an application, an accepted agreement, approved content), so they're set automatically — an admin can override with a reason." />
      <NeedsDatabase><Pipeline /></NeedsDatabase>
    </>
  );
}
