import Link from "next/link";
import { formatMoney, sumMinor } from "@app/domain";
import { demoFinance, households, workouts } from "@app/mock-data";
import { Badge, Kpi, PageHeader } from "@/components/AdminShell";
import { creatorBalances } from "@/lib/finance";

export default function Overview() {
  const f = demoFinance();
  const oct = f.snapshots.at(-1)!;
  const active = households.filter((h) => h.status !== "canceled");
  const balances = creatorBalances();
  const owed = sumMinor(balances.map((b) => b.final - b.paid));
  const awaiting = workouts.filter((w) => w.state === "awaiting-review" || w.state === "approved");
  const max = Math.max(...f.snapshots.map((s) => s.netReceiptsMinor));

  return (
    <>
      <PageHeader title="Good morning 👋" sub="Everything below is generated from sample data by the real royalty, referral and payout engines." />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Active households" value={active.length.toLocaleString()} hint={`${households.filter((h) => h.status === "past_due").length} payment issues`} />
        <Kpi label="Net receipts (Oct, provisional)" value={formatMoney(oct.netReceiptsMinor)} hint="after GST & card fees" />
        <Kpi label="Royalty pool (Oct)" value={formatMoney(oct.royaltyPoolMinor)} hint="30% of net receipts" />
        <Kpi label="Owed to creators (final)" value={formatMoney(owed)} hint="earned, not yet paid" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <section className="rounded-xl bg-white p-5 ring-1 ring-ink/5">
          <h2 className="font-semibold">Net receipts by month</h2>
          <div className="mt-6 flex h-48 items-end gap-4">
            {f.snapshots.map((s) => (
              <div key={s.month} className="flex flex-1 flex-col items-center gap-2">
                <div className="text-xs tabular-nums text-ink/60">{formatMoney(s.netReceiptsMinor).replace(".00", "")}</div>
                <div className={`w-full rounded-t-md ${s.status === "final" ? "bg-ink" : "bg-ink/30"}`} style={{ height: `${(s.netReceiptsMinor / max) * 140}px` }} />
                <div className="text-xs text-ink/60">{s.month.slice(5)}/{s.month.slice(2, 4)}</div>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-ink/50">Dark = closed month (final). Light = current month (provisional).</p>
        </section>

        <section className="rounded-xl bg-white p-5 ring-1 ring-ink/5">
          <h2 className="font-semibold">Needs your attention</h2>
          <ul className="mt-3 space-y-3 text-sm">
            <li className="flex items-start justify-between gap-3"><span>{awaiting.length} workouts waiting for review or publishing</span><Link className="text-sky underline" href="/admin/content/">Review</Link></li>
            <li className="flex items-start justify-between gap-3"><span>Payout batch PB-2026-10 approved — export bank file</span><Link className="text-sky underline" href="/admin/payouts/">Open</Link></li>
            <li className="flex items-start justify-between gap-3"><span>October royalty run is provisional (closes after month end)</span><Link className="text-sky underline" href="/admin/royalties/">View</Link></li>
            <li className="flex items-start justify-between gap-3"><span>Junior Coach Kit: guardian bank details missing</span><Link className="text-sky underline" href="/admin/creators/">Fix</Link></li>
          </ul>
          <h2 className="mt-6 font-semibold">Integrations</h2>
          <ul className="mt-2 space-y-1.5 text-sm">
            {[["Supabase (accounts & data)", "Phase 1"], ["Mux (video)", "Phase 2"], ["Stripe (billing)", "Phase 3"], ["Bank payout file", "Phase 5"]].map(([n, p]) => (
              <li key={n} className="flex justify-between"><span>{n}</span><Badge tone="amber">Mock · {p}</Badge></li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}
