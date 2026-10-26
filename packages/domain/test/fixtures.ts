import {
  DEFAULT_PAYOUT_TERMS,
  DEFAULT_REFERRAL_TERMS,
  type CreatorContract,
  type InvoiceSnapshot,
  type QualifiedView,
} from "../src";

export function contract(creatorId: string, over: Partial<CreatorContract> = {}): CreatorContract {
  return {
    contractId: `ct-${creatorId}`,
    version: 1,
    creatorId,
    payoutCurrency: "AUD",
    licenceStartMonth: "2026-01",
    royaltyPauses: [],
    royaltyEligible: true,
    referral: { ...DEFAULT_REFERRAL_TERMS, acceptNewFromMonth: "2026-01" },
    netReceiptsPolicyVersion: "net-receipts-v1",
    royaltyPoolPolicyVersion: "royalty-pool-v1",
    payout: { ...DEFAULT_PAYOUT_TERMS },
    guardianManaged: false,
    ...over,
  };
}

/** A$14.99 GST-inclusive monthly invoice with a realistic Stripe-style fee (1.7% + 30c). */
export function invoice(householdId: string, month: string, over: Partial<InvoiceSnapshot> = {}): InvoiceSnapshot {
  const gross = over.grossPaidMinor ?? 1499;
  return {
    invoiceId: `in_${householdId}_${month}`,
    householdId,
    provider: "stripe",
    currency: "AUD",
    grossPaidMinor: gross,
    taxMinor: Math.round(gross / 11),
    processorFeeMinor: Math.round(gross * 0.017) + 30,
    platformFeeMinor: 0,
    serviceStartMonth: month,
    serviceMonths: 1,
    paidAt: `${month}-01T00:00:00Z`,
    ...over,
  };
}

export function view(householdId: string, creatorId: string, month: string, minutes: number, profileId = `${householdId}-p1`): QualifiedView {
  return {
    householdId,
    profileId,
    workoutId: `w-${creatorId}`,
    creatorId,
    day: `${month}-10`,
    month,
    creditedSec: minutes * 60,
    sessionId: `${householdId}-${creatorId}-${profileId}-${minutes}`,
  };
}
