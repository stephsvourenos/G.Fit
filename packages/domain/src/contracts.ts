import type { BasisPoints, CurrencyCode } from "./money";

/**
 * A creator agreement. Each change creates a NEW version; old versions are
 * kept forever so historic statements can always be reproduced.
 * Months are "YYYY-MM" strings (inclusive ranges).
 */
export interface CreatorContract {
  contractId: string;
  version: number;
  creatorId: string;
  payoutCurrency: CurrencyCode;
  /** Content licence term. */
  licenceStartMonth: string;
  licenceEndMonth?: string;
  /** Months in which the licence is paused (no royalty accrues for those months). */
  royaltyPauses: Array<{ fromMonth: string; toMonth: string }>;
  royaltyEligible: boolean;
  referral: ReferralTerms;
  netReceiptsPolicyVersion: string;
  royaltyPoolPolicyVersion: string;
  payout: PayoutTerms;
  /** Creator is a minor: contract signed and payments received by a parent/guardian. */
  guardianManaged: boolean;
}

export interface ReferralTerms {
  rateBps: BasisPoints;
  /** Number of PAID months that earn commission for each referred household. */
  maxPaidMonths: number;
  /** New referrals accepted between these months (inclusive). */
  acceptNewFromMonth: string;
  acceptNewUntilMonth?: string;
  /** Stops NEW referrals only — commission already earned or still running is unaffected. */
  newReferralsPaused: boolean;
  attributionWindowDays: number;
}

export interface PayoutTerms {
  minPayoutMinor: number;
  /** Payment date = `payDay` of the Nth calendar month after the earning month. */
  monthsAfterEarning: number;
  payDay: number;
}

export const DEFAULT_REFERRAL_TERMS: Omit<ReferralTerms, "acceptNewFromMonth"> = {
  rateBps: 1000,
  maxPaidMonths: 12,
  newReferralsPaused: false,
  attributionWindowDays: 30,
};

export const DEFAULT_PAYOUT_TERMS: PayoutTerms = {
  minPayoutMinor: 10_000,
  monthsAfterEarning: 3,
  payDay: 15,
};

function inRange(month: string, from: string, to?: string): boolean {
  return month >= from && (to === undefined || month <= to);
}

export function royaltyEligibleInMonth(c: CreatorContract, month: string): boolean {
  if (!c.royaltyEligible) return false;
  if (!inRange(month, c.licenceStartMonth, c.licenceEndMonth)) return false;
  return !c.royaltyPauses.some((p) => inRange(month, p.fromMonth, p.toMonth));
}

export function acceptsNewReferrals(c: CreatorContract, month: string): boolean {
  if (c.referral.newReferralsPaused) return false;
  return inRange(month, c.referral.acceptNewFromMonth, c.referral.acceptNewUntilMonth);
}

/** Latest contract version for a creator that was in force for a month. */
export function contractFor(contracts: CreatorContract[], creatorId: string): CreatorContract | undefined {
  return contracts
    .filter((c) => c.creatorId === creatorId)
    .sort((a, b) => b.version - a.version)[0];
}
