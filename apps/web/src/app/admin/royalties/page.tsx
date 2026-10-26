import { DEFAULT_ROYALTY_POLICY, formatMoney, payoutDueDate, DEFAULT_PAYOUT_TERMS } from "@app/domain";
import { creators, demoFinance } from "@app/mock-data";
import { Badge, PageHeader, Table } from "@/components/AdminShell";

export default function RoyaltiesPage() {
  const f = demoFinance();
  return (
    <>
      <PageHeader
        title="Monthly royalty run"
        sub="Household-balanced: each household’s 30% royalty share is split only between the creators that household actually watched (qualified minutes). Closed months are frozen; corrections arrive as adjustments in later months."
      />
      <Table head={["Month", "Status", "Net receipts", "Royalty pool", "Allocated", "Retained", "Referral", "Adjustments", "Pay date", "Fingerprint"]}>
        {[...f.snapshots].reverse().map((s) => (
          <tr key={s.month}>
            <td className="px-4 py-3 font-semibold">{s.month}</td>
            <td className="px-4 py-3"><Badge tone={s.status === "final" ? "green" : "amber"}>{s.status}</Badge></td>
            <td className="px-4 py-3">{formatMoney(s.netReceiptsMinor)}</td>
            <td className="px-4 py-3">{formatMoney(s.royaltyPoolMinor)}</td>
            <td className="px-4 py-3">{formatMoney(s.royaltyAllocatedMinor)}</td>
            <td className="px-4 py-3">{formatMoney(s.royaltyRetainedMinor)}</td>
            <td className="px-4 py-3">{formatMoney(s.referralMinor)}</td>
            <td className="px-4 py-3">{formatMoney(s.adjustmentsMinor)}</td>
            <td className="px-4 py-3 text-xs">{payoutDueDate(s.month, DEFAULT_PAYOUT_TERMS)}</td>
            <td className="px-4 py-3 font-mono text-xs">{s.fingerprint}</td>
          </tr>
        ))}
      </Table>

      <h2 className="mt-8 mb-3 font-semibold">By creator</h2>
      <Table head={["Creator", ...f.snapshots.map((s) => s.month)]}>
        {creators.map((c) => (
          <tr key={c.id}>
            <td className="px-4 py-3 font-semibold">{c.displayName}</td>
            {f.snapshots.map((s) => {
              const roy = f.ledger.filter((e) => e.creatorId === c.id && e.earningMonth === s.month && e.kind === "royalty").reduce((a, e) => a + e.amountMinor, 0);
              return <td key={s.month} className="px-4 py-3">{roy ? formatMoney(roy) : <span className="text-ink/40">paused / none</span>}</td>;
            })}
          </tr>
        ))}
      </Table>

      <div className="mt-8 grid gap-4 md:grid-cols-3 text-sm">
        <div className="rounded-xl bg-white p-4 ring-1 ring-ink/5"><div className="font-semibold">Policy {DEFAULT_ROYALTY_POLICY.version}</div><p className="mt-1 text-ink/60">Pool = {DEFAULT_ROYALTY_POLICY.poolRateBps / 100}% of eligible net receipts, recognised monthly (annual plans spread over 12 months).</p></div>
        <div className="rounded-xl bg-white p-4 ring-1 ring-ink/5"><div className="font-semibold">Households with no viewing</div><p className="mt-1 text-ink/60">Their share is redistributed pro-rata to creators’ viewing royalties (configurable: or retained).</p></div>
        <div className="rounded-xl bg-white p-4 ring-1 ring-ink/5"><div className="font-semibold">Paused / ended licences</div><p className="mt-1 text-ink/60">Viewing of a paused creator earns them nothing that month; that household’s share goes to the other creators it watched.</p></div>
      </div>
      <p className="mt-4 text-xs text-ink/50">The fingerprint proves reproducibility: re-running a closed month with the same inputs gives the identical result, to the cent.</p>
    </>
  );
}
