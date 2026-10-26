import { applyRate } from "./money";
import { acceptsNewReferrals, type CreatorContract, type ReferralTerms } from "./contracts";
import type { RecognisedReceipt } from "./receipts";

export interface ReferralCode {
  code: string;
  creatorId: string;
  active: boolean;
}

/** Captured on the website when someone arrives via a creator link/code. */
export interface ReferralTouch {
  code: string;
  /** Anonymous first-party visitor ID stored in a cookie until checkout. */
  visitorId: string;
  at: string;
}

export interface ConversionEvent {
  householdId: string;
  visitorId: string;
  /** Hashed owner email, used only to block self-referral. */
  ownerEmailHash: string;
  convertedAt: string;
  /** Code typed at checkout, if any (wins over an older link click). */
  enteredCode?: string;
}

/**
 * The commercial terms are FROZEN at the moment of attribution, so later
 * contract changes only affect future referrals — never existing ones.
 */
export interface Attribution {
  householdId: string;
  creatorId: string;
  code: string;
  attributedAt: string;
  contractId: string;
  contractVersion: number;
  terms: ReferralTerms;
  source: "link" | "code" | "admin-override";
  overrideReason?: string;
  overrideApprovedBy?: string;
}

export type AttributionRejection =
  | "no-referral"
  | "unknown-code"
  | "code-inactive"
  | "outside-attribution-window"
  | "self-referral"
  | "already-attributed"
  | "creator-not-accepting-referrals";

export function attributeConversion(args: {
  conversion: ConversionEvent;
  touches: ReferralTouch[];
  codes: ReferralCode[];
  contracts: CreatorContract[];
  existing: Attribution[];
  creatorEmailHashes: Map<string, string[]>;
}): { ok: true; attribution: Attribution } | { ok: false; reason: AttributionRejection } {
  const { conversion, touches, codes, contracts, existing, creatorEmailHashes } = args;
  if (existing.some((a) => a.householdId === conversion.householdId)) return { ok: false, reason: "already-attributed" };

  const convertedMs = new Date(conversion.convertedAt).getTime();
  let code: string | undefined;
  let source: Attribution["source"] = "link";
  if (conversion.enteredCode) {
    code = conversion.enteredCode.trim().toUpperCase();
    source = "code";
  } else {
    // Most recent link click from this visitor before conversion.
    const latest = touches
      .filter((t) => t.visitorId === conversion.visitorId && new Date(t.at).getTime() <= convertedMs)
      .sort((a, b) => (a.at < b.at ? 1 : -1))[0];
    if (!latest) return { ok: false, reason: "no-referral" };
    code = latest.code.toUpperCase();
    const contract = contracts.find((c) => c.creatorId === codes.find((x) => x.code === code)?.creatorId);
    const windowDays = contract?.referral.attributionWindowDays ?? 30;
    if (convertedMs - new Date(latest.at).getTime() > windowDays * 86_400_000) {
      return { ok: false, reason: "outside-attribution-window" };
    }
  }

  const codeRec = codes.find((c) => c.code === code);
  if (!codeRec) return { ok: false, reason: "unknown-code" };
  if (!codeRec.active) return { ok: false, reason: "code-inactive" };
  if ((creatorEmailHashes.get(codeRec.creatorId) ?? []).includes(conversion.ownerEmailHash)) {
    return { ok: false, reason: "self-referral" };
  }

  const contract = contracts
    .filter((c) => c.creatorId === codeRec.creatorId)
    .sort((a, b) => b.version - a.version)[0];
  const month = conversion.convertedAt.slice(0, 7);
  if (!contract || !acceptsNewReferrals(contract, month)) {
    return { ok: false, reason: "creator-not-accepting-referrals" };
  }

  return {
    ok: true,
    attribution: {
      householdId: conversion.householdId,
      creatorId: codeRec.creatorId,
      code: codeRec.code,
      attributedAt: conversion.convertedAt,
      contractId: contract.contractId,
      contractVersion: contract.version,
      terms: { ...contract.referral },
      source,
    },
  };
}

export interface CommissionLine {
  creatorId: string;
  householdId: string;
  invoiceId: string;
  serviceMonth: string;
  paidMonthNumber: number;
  netMinor: number;
  amountMinor: number;
}

export interface CommissionSchedule {
  lines: CommissionLine[];
  paidMonthsCounted: number;
  remainingPaidMonths: number;
}

/**
 * Commission for one referred household across all its recognised paid months.
 * - Only months that were actually paid count ("paid months"), so cancelling
 *   and coming back later does NOT reset or extend the clock.
 * - Annual plans count as 12 paid months, earned month by month.
 * - Refunds are handled later as reversing ledger entries.
 */
export function commissionForHousehold(attribution: Attribution, receipts: RecognisedReceipt[]): CommissionSchedule {
  const paid = receipts
    .filter((r) => r.householdId === attribution.householdId && r.netMinor > 0 && r.serviceMonth >= attribution.attributedAt.slice(0, 7))
    .sort((a, b) => (a.serviceMonth === b.serviceMonth ? (a.invoiceId < b.invoiceId ? -1 : 1) : a.serviceMonth < b.serviceMonth ? -1 : 1));

  const lines: CommissionLine[] = [];
  const countedMonths = new Set<string>();
  for (const r of paid) {
    if (!countedMonths.has(r.serviceMonth)) {
      if (countedMonths.size >= attribution.terms.maxPaidMonths) break;
      countedMonths.add(r.serviceMonth);
    }
    lines.push({
      creatorId: attribution.creatorId,
      householdId: r.householdId,
      invoiceId: r.invoiceId,
      serviceMonth: r.serviceMonth,
      paidMonthNumber: countedMonths.size,
      netMinor: r.netMinor,
      amountMinor: applyRate(r.netMinor, attribution.terms.rateBps),
    });
  }
  return {
    lines,
    paidMonthsCounted: countedMonths.size,
    remainingPaidMonths: Math.max(0, attribution.terms.maxPaidMonths - countedMonths.size),
  };
}
