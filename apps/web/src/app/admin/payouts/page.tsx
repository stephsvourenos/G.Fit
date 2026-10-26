import { formatMoney } from "@app/domain";
import { creators, demoFinance } from "@app/mock-data";
import { Badge, PageHeader, Table } from "@/components/AdminShell";
import { creatorBalances } from "@/lib/finance";

export default function PayoutsPage() {
  const f = demoFinance();
  const carried = creatorBalances().filter((b) => b.carriedForward > 0);
  const oct = f.batches.find((b) => b.id === "PB-2026-10")!;
  const csv = ["creator_id,payee_name,bsb,account,amount_aud,reference", ...oct.items.map((i) => {
    const c = creators.find((x) => x.id === i.creatorId)!;
    return `${c.id},"${c.legalName}",***-***,*****${c.bankOnFile ? "123" : "???"},${(i.amountMinor / 100).toFixed(2)},PB-2026-10`;
  })].join("\n");
  return (
    <>
      <PageHeader title="Payout batches" sub="Payments are due on the 15th of the third month after the earning month. Batches need a maker and a different checker, and are only marked paid with bank evidence. An entry can never be in two live batches." />
      <Table head={["Batch", "Status", "Creators", "Total", "Created by", "Approved by", "Bank confirmation"]}>
        {f.batches.map((b) => (
          <tr key={b.id}>
            <td className="px-4 py-3 font-semibold">{b.id}</td>
            <td className="px-4 py-3"><Badge tone={b.status === "confirmed" ? "green" : "amber"}>{b.status}</Badge></td>
            <td className="px-4 py-3">{b.items.length}</td>
            <td className="px-4 py-3">{formatMoney(b.items.reduce((a, i) => a + i.amountMinor, 0))}</td>
            <td className="px-4 py-3 text-xs">{b.createdBy}</td>
            <td className="px-4 py-3 text-xs">{b.approvedBy ?? "—"}</td>
            <td className="px-4 py-3 text-xs">{b.confirmation ? `${b.confirmation.bankReference} · ${b.confirmation.evidence}` : "awaiting export"}</td>
          </tr>
        ))}
      </Table>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl bg-white p-5 ring-1 ring-ink/5">
          <h2 className="font-semibold">PB-2026-10 — sample bank file</h2>
          <p className="mt-1 text-xs text-ink/60">SAMPLE ONLY. The real ABA/CSV layout will be built from your bank’s published specification in Phase 5. No bank credentials are ever stored in this app.</p>
          <pre className="mt-3 overflow-x-auto rounded-lg bg-ink p-3 text-xs text-paper">{csv}</pre>
          {oct.items.some((i) => !creators.find((c) => c.id === i.creatorId)?.bankOnFile) && (
            <p className="mt-3 text-sm text-coral">⚠ One payee has no bank details — that line must be held before export.</p>
          )}
        </section>
        <section className="rounded-xl bg-white p-5 ring-1 ring-ink/5">
          <h2 className="font-semibold">Carried forward (below A$100 minimum)</h2>
          {carried.length ? (
            <ul className="mt-2 text-sm">{carried.map((b) => <li key={b.creator.id} className="flex justify-between py-1"><span>{b.creator.displayName}</span><span>{formatMoney(b.carriedForward)}</span></li>)}</ul>
          ) : (
            <p className="mt-2 text-sm text-ink/60">Nobody is below the minimum right now. Balances under the minimum roll into the next batch automatically and are never marked paid.</p>
          )}
          <h2 className="mt-6 font-semibold">Batch audit trail</h2>
          <ul className="mt-2 space-y-1 font-mono text-xs">
            {f.batches.flatMap((b) => b.audit.map((a) => `${a.at.slice(0, 10)} ${b.id} ${a.action} — ${a.by}`)).map((l) => <li key={l}>{l}</li>)}
          </ul>
        </section>
      </div>
    </>
  );
}
