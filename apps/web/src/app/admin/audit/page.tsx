import { PageHeader, Table } from "@/components/AdminShell";

const rows = [
  ["2026-10-26 09:12", "ops@demo", "content", "Moved “Superhero Training Camp” to approved"],
  ["2026-10-25 16:40", "finance@demo", "payouts", "Approved batch PB-2026-10 (maker: ops@demo)"],
  ["2026-10-25 11:02", "ops@demo", "creators", "Created contract ct-cr-theo v2 (licence pause Aug 2026)"],
  ["2026-10-24 08:30", "system", "billing", "Processed evt_demo_8812 invoice.paid (idempotent)"],
  ["2026-10-24 08:30", "system", "billing", "Ignored duplicate delivery evt_demo_8812"],
  ["2026-10-20 14:05", "ops@demo", "referrals", "Rejected self-referral attempt for code BEE"],
  ["2026-09-15 23:00", "finance@demo", "payouts", "Confirmed PB-2026-09 with BANK-REF-0915"],
];

export default function AuditPage() {
  return (
    <>
      <PageHeader title="Audit log" sub="Every admin and system action that changes content, money or access is recorded with who, when and what. Entries cannot be edited." />
      <Table head={["When", "Who", "Area", "What"]}>
        {rows.map((r) => <tr key={r.join()}>{r.map((c, i) => <td key={i} className="px-4 py-3 text-sm">{c}</td>)}</tr>)}
      </Table>
    </>
  );
}
