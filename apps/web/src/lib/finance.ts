import { DEFAULT_PAYOUT_TERMS, computePayable, payoutDueDate, sumMinor, type LedgerEntry } from "@app/domain";
import { creators, demoFinance } from "@app/mock-data";

export function creatorBalances() {
  const f = demoFinance();
  return creators.map((c) => {
    const mine = f.ledger.filter((e) => e.creatorId === c.id);
    const paid = sumMinor(f.batches.filter((b) => b.status === "confirmed").flatMap((b) => b.items.filter((i) => i.creatorId === c.id).map((i) => i.amountMinor)));
    const scheduled = sumMinor(f.batches.filter((b) => b.status === "approved" || b.status === "exported").flatMap((b) => b.items.filter((i) => i.creatorId === c.id).map((i) => i.amountMinor)));
    const sumKind = (k: LedgerEntry["kind"]) => sumMinor(mine.filter((e) => e.kind === k).map((e) => e.amountMinor));
    const provisional = sumMinor(mine.filter((e) => e.runStatus === "provisional").map((e) => e.amountMinor));
    const final = sumMinor(mine.filter((e) => e.runStatus === "final").map((e) => e.amountMinor));
    const due = computePayable({ creatorId: c.id, ledger: f.ledger, batches: f.batches, terms: DEFAULT_PAYOUT_TERMS, asOfDate: f.asOfDate });
    return {
      creator: c,
      royalties: sumKind("royalty"),
      referrals: sumKind("referral"),
      adjustments: sumKind("adjustment"),
      provisional,
      final,
      paid,
      scheduled,
      unpaidFinal: final - paid - scheduled,
      carriedForward: due.status === "below-minimum-carry-forward" ? due.dueMinor : 0,
    };
  });
}

export function nextPayDates(month: string) {
  return payoutDueDate(month, DEFAULT_PAYOUT_TERMS);
}
