import { PageHeader } from "@/components/AdminShell";
import { LiveHealth } from "./LiveHealth";

export default function HealthPage() {
  return (
    <>
      <PageHeader
        title="System health"
        sub="Problems from the website, the app and the server, plus an hourly check that scheduled jobs, emails and month-end are running. Repeats are grouped and counted."
      />
      <LiveHealth />
    </>
  );
}
