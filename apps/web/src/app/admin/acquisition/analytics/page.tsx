import { PageHeader } from "@/components/AdminShell";
import { NeedsDatabase } from "../_ui";
import { Analytics } from "./Analytics";

export const metadata = { title: "Recruitment Analytics · Creator Acquisition" };

export default function Page() {
  return (
    <>
      <PageHeader title="Recruitment Analytics" sub="How prospects move through the pipeline. Each creator counts once per step, so repeated messages or stage changes can't inflate the numbers." />
      <NeedsDatabase><Analytics /></NeedsDatabase>
    </>
  );
}
