import { sumMinor } from "./money";
import type { LedgerEntry, PayoutBatch } from "./ledger";

export interface CreatorStatement {
  creatorId: string;
  month: string;
  openingBalanceMinor: number;
  royaltiesMinor: number;
  referralsMinor: number;
  adjustmentsMinor: number;
  paidOutMinor: number;
  closingBalanceMinor: number;
  entries: LedgerEntry[];
}

/** Monthly statement: what was earned, adjusted and paid, and what is still owed. */
export function buildStatement(args: {
  creatorId: string;
  month: string;
  ledger: readonly LedgerEntry[];
  batches: PayoutBatch[];
}): CreatorStatement {
  const { creatorId, month, ledger, batches } = args;
  const mine = ledger.filter((e) => e.creatorId === creatorId);
  const before = mine.filter((e) => e.earningMonth < month);
  const during = mine.filter((e) => e.earningMonth === month);

  const paidIn = (pred: (confirmedMonth: string) => boolean) =>
    sumMinor(
      batches
        .filter((b) => b.status === "confirmed" && b.confirmation && pred(b.confirmation.confirmedAt.slice(0, 7)))
        .flatMap((b) => b.items.filter((i) => i.creatorId === creatorId).map((i) => i.amountMinor)),
    );

  const opening = sumMinor(before.map((e) => e.amountMinor)) - paidIn((m) => m < month);
  const royalties = sumMinor(during.filter((e) => e.kind === "royalty").map((e) => e.amountMinor));
  const referrals = sumMinor(during.filter((e) => e.kind === "referral").map((e) => e.amountMinor));
  const adjustments = sumMinor(during.filter((e) => e.kind === "adjustment").map((e) => e.amountMinor));
  const paidOut = paidIn((m) => m === month);
  return {
    creatorId,
    month,
    openingBalanceMinor: opening,
    royaltiesMinor: royalties,
    referralsMinor: referrals,
    adjustmentsMinor: adjustments,
    paidOutMinor: paidOut,
    closingBalanceMinor: opening + royalties + referrals + adjustments - paidOut,
    entries: during,
  };
}
