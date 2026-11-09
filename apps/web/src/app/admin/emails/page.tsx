import { PageHeader } from "@/components/AdminShell";
import { LiveEmails } from "./LiveEmails";

export default function EmailsPage() {
  return (
    <>
      <PageHeader
        title="Member emails"
        sub="Every email the system owes a family — trial started, trial ending reminder, welcome, payment failed, cancellation — with exactly what it said and when it went."
      />
      <LiveEmails />
    </>
  );
}
