import { allocateByWeight, applyRate, sumMinor, type BasisPoints } from "./money";
import type { RecognisedReceipt } from "./receipts";
import type { QualifiedView } from "./playback";

/**
 * Content royalty pool — "household-balanced" (also called user-centric).
 *
 * Each household's own subscription money is split only between the creators
 * THAT household actually watched, in proportion to its qualified minutes.
 * So a household that watches 40 hours can never take more of the pool than
 * the one subscription it paid — big or heavy-viewing households cannot
 * swamp the pool, and creators are paid by the families who value them.
 */
export interface RoyaltyPoolPolicy {
  version: string;
  poolRateBps: BasisPoints;
  /**
   * Households that paid but watched nothing qualifying this month:
   *  - "redistribute": their pool share is shared across creators pro-rata to royalties earned;
   *  - "retain": the business keeps it.
   */
  zeroViewHouseholds: "redistribute" | "retain";
  /**
   * Viewing of a creator whose licence is paused/ineligible this month:
   *  - "redistribute-within-household": that household's share goes to the other eligible creators it watched;
   *  - "retain": the business keeps it.
   */
  ineligibleCreatorViews: "redistribute-within-household" | "retain";
}

export const DEFAULT_ROYALTY_POLICY: RoyaltyPoolPolicy = {
  version: "royalty-pool-v1",
  poolRateBps: 3000,
  zeroViewHouseholds: "redistribute",
  ineligibleCreatorViews: "redistribute-within-household",
};

export interface RoyaltyLine {
  creatorId: string;
  month: string;
  amountMinor: number;
  basis: "household-viewing" | "zero-view-redistribution";
  householdId?: string;
  invoiceId?: string;
  qualifiedSec?: number;
}

export interface RoyaltyRunResult {
  month: string;
  policyVersion: string;
  totalNetReceiptsMinor: number;
  poolMinor: number;
  allocatedMinor: number;
  retainedMinor: number;
  lines: RoyaltyLine[];
  byCreator: Map<string, number>;
}

export function runRoyaltyPool(args: {
  month: string;
  receipts: RecognisedReceipt[];
  views: QualifiedView[];
  isCreatorEligible: (creatorId: string, month: string) => boolean;
  policy?: RoyaltyPoolPolicy;
}): RoyaltyRunResult {
  const { month, isCreatorEligible } = args;
  const policy = args.policy ?? DEFAULT_ROYALTY_POLICY;
  const receipts = args.receipts.filter((r) => r.serviceMonth === month);
  const views = args.views.filter((v) => v.month === month);

  const lines: RoyaltyLine[] = [];
  let retained = 0;
  let zeroViewPot = 0;

  // Sum qualified seconds per household per creator.
  const watched = new Map<string, Map<string, number>>();
  for (const v of views) {
    const h = watched.get(v.householdId) ?? new Map<string, number>();
    h.set(v.creatorId, (h.get(v.creatorId) ?? 0) + v.creditedSec);
    watched.set(v.householdId, h);
  }

  let poolTotal = 0;
  for (const r of [...receipts].sort((a, b) => (a.invoiceId < b.invoiceId ? -1 : 1))) {
    const pool = applyRate(r.netMinor, policy.poolRateBps);
    poolTotal += pool;
    const creators = watched.get(r.householdId);
    if (!creators || creators.size === 0) {
      if (policy.zeroViewHouseholds === "redistribute") zeroViewPot += pool;
      else retained += pool;
      continue;
    }

    const eligible = [...creators.entries()].filter(([c]) => isCreatorEligible(c, month));
    const ineligibleSec = [...creators.entries()]
      .filter(([c]) => !isCreatorEligible(c, month))
      .reduce((a, [, s]) => a + s, 0);
    const totalSec = [...creators.values()].reduce((a, s) => a + s, 0);

    let toAllocate = pool;
    if (policy.ineligibleCreatorViews === "retain" && ineligibleSec > 0) {
      // Keep the paused creators' share; split the rest among eligible creators.
      const parts = allocateByWeight(pool, [
        { key: "__eligible", weight: totalSec - ineligibleSec },
        { key: "__retained", weight: ineligibleSec },
      ]);
      retained += parts.get("__retained") ?? 0;
      toAllocate = parts.get("__eligible") ?? 0;
    }
    if (eligible.length === 0) {
      if (policy.zeroViewHouseholds === "redistribute") zeroViewPot += toAllocate;
      else retained += toAllocate;
      continue;
    }

    const split = allocateByWeight(
      toAllocate,
      eligible.map(([creatorId, sec]) => ({ key: creatorId, weight: sec })),
    );
    for (const [creatorId, amount] of split) {
      lines.push({
        creatorId,
        month,
        amountMinor: amount,
        basis: "household-viewing",
        householdId: r.householdId,
        invoiceId: r.invoiceId,
        qualifiedSec: creators.get(creatorId),
      });
    }
  }

  // Redistribute zero-view households pro-rata to what each creator earned from viewing.
  if (zeroViewPot > 0) {
    const earned = new Map<string, number>();
    for (const l of lines) earned.set(l.creatorId, (earned.get(l.creatorId) ?? 0) + l.amountMinor);
    if (earned.size === 0) {
      retained += zeroViewPot; // nobody watched anything eligible: nothing to share by
    } else {
      const split = allocateByWeight(
        zeroViewPot,
        [...earned.entries()].map(([key, weight]) => ({ key, weight })),
      );
      for (const [creatorId, amount] of split) {
        if (amount !== 0) lines.push({ creatorId, month, amountMinor: amount, basis: "zero-view-redistribution" });
      }
    }
  }

  const byCreator = new Map<string, number>();
  for (const l of lines) byCreator.set(l.creatorId, (byCreator.get(l.creatorId) ?? 0) + l.amountMinor);
  const allocated = sumMinor(lines.map((l) => l.amountMinor));

  if (allocated + retained !== poolTotal) {
    throw new Error(`royalty run does not balance: ${allocated} + ${retained} != ${poolTotal}`);
  }

  return {
    month,
    policyVersion: policy.version,
    totalNetReceiptsMinor: sumMinor(receipts.map((r) => r.netMinor)),
    poolMinor: poolTotal,
    allocatedMinor: allocated,
    retainedMinor: retained,
    lines,
    byCreator,
  };
}
