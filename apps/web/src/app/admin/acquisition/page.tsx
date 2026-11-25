import { PageHeader } from "@/components/AdminShell";
import { NeedsDatabase } from "./_ui";
import { Overview } from "./Overview";

export const metadata = { title: "Creator Acquisition" };

export default function Page() {
  return (
    <>
      <PageHeader title="Creator Acquisition" sub="Progress towards launch-ready founding creators. Targets are editable in Settings. Forecasts are estimates, never promises." />
      <NeedsDatabase><Overview /></NeedsDatabase>
    </>
  );
}
