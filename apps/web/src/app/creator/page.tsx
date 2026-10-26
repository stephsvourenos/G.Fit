import { buildStatement, DEFAULT_PAYOUT_TERMS, payoutDueDate, sumMinor } from "@app/domain";
import { attributions, creators, demoFinance, referralFunnel, views, workouts } from "@app/mock-data";
import { CreatorPortal, type CreatorData } from "./CreatorPortal";

export const metadata = { title: "Creator portal" };

/** Everything here is aggregated per creator. No viewer, household or child identity ever leaves the server. */
function build(): CreatorData[] {
  const f = demoFinance();
  return creators.map((c) => {
    const months = f.snapshots.map((s) => s.month);
    const statements = months.map((m) => {
      const st = buildStatement({ creatorId: c.id, month: m, ledger: f.ledger, batches: f.batches });
      const status = f.snapshots.find((s) => s.month === m)!.status;
      return { month: m, status, royalties: st.royaltiesMinor, referrals: st.referralsMinor, adjustments: st.adjustmentsMinor, closing: st.closingBalanceMinor, payDate: payoutDueDate(m, DEFAULT_PAYOUT_TERMS) };
    });
    const minutesByMonth = months.map((m) => Math.round(sumMinor(views.filter((v) => v.creatorId === c.id && v.month === m).map((v) => v.creditedSec)) / 60));
    const households = months.map((m) => new Set(views.filter((v) => v.creatorId === c.id && v.month === m).map((v) => v.householdId)).size);
    const payouts = f.batches.flatMap((b) => b.items.filter((i) => i.creatorId === c.id).map((i) => ({ batch: b.id, status: b.status, amount: i.amountMinor, date: b.confirmation?.confirmedAt.slice(0, 10) ?? "scheduled" })));
    return {
      id: c.id,
      name: c.displayName,
      isMinor: c.isMinor,
      code: c.referralCode,
      bankOnFile: c.bankOnFile,
      months,
      statements,
      minutesByMonth,
      households,
      funnel: referralFunnel[c.id]!,
      referredActive: attributions.filter((a) => a.creatorId === c.id).length,
      payouts,
      videos: workouts.filter((w) => w.creatorId === c.id).map((w) => ({ title: w.title, state: w.state })),
    };
  });
}

export default function Page() {
  return <CreatorPortal data={build()} />;
}
