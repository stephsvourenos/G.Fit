import { commissionForHousehold, formatMoney, recogniseInvoice, DEFAULT_NET_RECEIPTS_POLICY } from "@app/domain";
import { attributions, creators, invoices, referralFunnel } from "@app/mock-data";
import { PageHeader, Table } from "@/components/AdminShell";

export default function ReferralsPage() {
  const receipts = invoices.flatMap((i) => recogniseInvoice(i, DEFAULT_NET_RECEIPTS_POLICY)).filter((r) => r.serviceMonth <= "2026-10");
  return (
    <>
      <PageHeader title="Referrals" sub="A household is attributed once, at its first paid conversion, to the creator whose link or code it used within 30 days. Self-referrals and duplicates are rejected. Overrides need a reason and approval." />
      <Table head={["Creator", "Code", "Link clicks", "Registered", "Paying households", "Conversion", "Commission to date", "Paid months used"]}>
        {creators.map((c) => {
          const f = referralFunnel[c.id]!;
          const mine = attributions.filter((a) => a.creatorId === c.id);
          const sched = mine.map((a) => commissionForHousehold(a, receipts));
          const total = sched.reduce((a, s) => a + s.lines.reduce((x, l) => x + l.amountMinor, 0), 0);
          const used = sched.reduce((a, s) => a + s.paidMonthsCounted, 0);
          return (
            <tr key={c.id}>
              <td className="px-4 py-3 font-semibold">{c.displayName}</td>
              <td className="px-4 py-3 font-mono text-xs">/r/{c.referralCode}</td>
              <td className="px-4 py-3">{f.clicks.toLocaleString()}</td>
              <td className="px-4 py-3">{f.registered}</td>
              <td className="px-4 py-3">{f.paying}</td>
              <td className="px-4 py-3">{((f.paying / f.clicks) * 100).toFixed(1)}%</td>
              <td className="px-4 py-3">{formatMoney(total)}</td>
              <td className="px-4 py-3 text-xs">{used} months</td>
            </tr>
          );
        })}
      </Table>
      <p className="mt-4 text-xs text-ink/50">Click and registration counts are sample numbers. Commission figures are calculated by the real referral engine from the demo invoices.</p>
    </>
  );
}
