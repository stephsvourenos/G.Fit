import { PageHeader } from "@/components/AdminShell";
import { NeedsDatabase } from "../_ui";
import { Today } from "./Today";

export const metadata = { title: "Today's Tasks · Creator Acquisition" };

export default function Page() {
  return (
    <>
      <PageHeader title="Today's Tasks" sub="Your list for today: replies first, then follow-ups, then the best new creators to contact. G.Fit never sends social messages for you — copy, send it yourself, then confirm." />
      <NeedsDatabase><Today /></NeedsDatabase>
    </>
  );
}
