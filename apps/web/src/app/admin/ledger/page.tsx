import { formatMoney } from "@app/domain";
import { creators, demoFinance } from "@app/mock-data";
import { Badge, Kpi, PageHeader, Table } from "@/components/AdminShell";
import { creatorBalances } from "@/lib/finance";

export default function LedgerPage() {
  const f = demoFinance();
  const balances = creatorBalances();
  const total = (k: keyof (typeof balances)[number]) => balances.reduce((a, b) => a + (typeof b[k] === "number" ? (b[k] as number) : 0), 0);
  const adjustments = f.ledger.filter((e) => e.kind === "adjustment");
  const sample = f.ledger.filter((e) => e.creatorId === "cr-pip").slice(-12).reverse();
  return (
    <>
      <PageHeader title="Creator liability ledger" sub={`Append-only: ${f.ledger.length.toLocaleString()} entries. Nothing is ever edited or deleted — refunds and corrections are new, linked adjusting entries.`} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Kpi label="Royalties accrued" value={formatMoney(total("royalties"))} />
        <Kpi label="Referral accrued" value={formatMoney(total("referrals"))} />
        <Kpi label="Adjustments" value={formatMoney(total("adjustments"))} />
        <Kpi label="Provisional (Oct)" value={formatMoney(total("provisional"))} hint="not payable until month closes" />
        <Kpi label="Paid" value={formatMoney(total("paid"))} />
      </div>
      <h2 className="mt-8 mb-3 font-semibold">Balances by creator</h2>
      <Table head={["Creator", "Royalties", "Referrals", "Adjustments", "Final", "Provisional", "Scheduled", "Paid", "Unpaid final"]}>
        {balances.map((b) => (
          <tr key={b.creator.id}>
            <td className="px-4 py-3 font-semibold">{b.creator.displayName}</td>
            <td className="px-4 py-3">{formatMoney(b.royalties)}</td>
            <td className="px-4 py-3">{formatMoney(b.referrals)}</td>
            <td className="px-4 py-3">{formatMoney(b.adjustments)}</td>
            <td className="px-4 py-3">{formatMoney(b.final)}</td>
            <td className="px-4 py-3 text-ink/60">{formatMoney(b.provisional)}</td>
            <td className="px-4 py-3">{formatMoney(b.scheduled)}</td>
            <td className="px-4 py-3">{formatMoney(b.paid)}</td>
            <td className="px-4 py-3 font-semibold">{formatMoney(b.unpaidFinal)}</td>
          </tr>
        ))}
      </Table>
      <h2 className="mt-8 mb-3 font-semibold">Refund adjustments</h2>
      <Table head={["Entry", "Creator", "Amount", "Reverses", "Source"]}>
        {adjustments.map((e) => (
          <tr key={e.id}>
            <td className="px-4 py-3 font-mono text-xs">{e.id.slice(0, 40)}…</td>
            <td className="px-4 py-3">{creators.find((c) => c.id === e.creatorId)?.displayName}</td>
            <td className="px-4 py-3 text-coral">{formatMoney(e.amountMinor)}</td>
            <td className="px-4 py-3 font-mono text-xs">{e.reversesEntryId?.slice(0, 32)}…</td>
            <td className="px-4 py-3 text-xs">{e.sourceRefs.join(", ")}</td>
          </tr>
        ))}
      </Table>
      <h2 className="mt-8 mb-3 font-semibold">Latest entries — Junior Coach Pip</h2>
      <Table head={["Month", "Type", "Amount", "Run", "Contract", "Source", "Memo"]}>
        {sample.map((e) => (
          <tr key={e.id}>
            <td className="px-4 py-3">{e.earningMonth}</td>
            <td className="px-4 py-3"><Badge tone={e.kind === "referral" ? "blue" : e.kind === "adjustment" ? "red" : "green"}>{e.kind}</Badge></td>
            <td className="px-4 py-3">{formatMoney(e.amountMinor)}</td>
            <td className="px-4 py-3 text-xs">{e.runStatus}</td>
            <td className="px-4 py-3 text-xs">{e.contractRef}</td>
            <td className="px-4 py-3 text-xs">{e.sourceRefs[0]}</td>
            <td className="px-4 py-3 text-xs">{e.memo}</td>
          </tr>
        ))}
      </Table>
    </>
  );
}
