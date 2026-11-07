import { PageHeader } from "@/components/AdminShell";
import { LiveReports } from "./LiveReports";

export default function ReportsPage() {
  return (
    <>
      <PageHeader
        title="Finance reports"
        sub="Subscribers, trial conversion, cash in, creator costs and contribution margin, and how each month’s new families stay. Figures exclude GST unless marked."
      />
      <LiveReports />
    </>
  );
}
