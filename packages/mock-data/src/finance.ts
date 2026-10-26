import {
  addMonths,
  computePayable,
  createPayoutBatch,
  approveBatch,
  markExported,
  confirmPaid,
  DEFAULT_PAYOUT_TERMS,
  DEFAULT_REFERRAL_TERMS,
  gstIncludedMinor,
  runMonthEnd,
  type Attribution,
  type CreatorContract,
  type InvoiceSnapshot,
  type LedgerEntry,
  type MonthEndSnapshot,
  type PayoutBatch,
  type QualifiedView,
  type RefundSnapshot,
} from "@app/domain";
import { instructors } from "./catalog";

/** Deterministic pseudo-random numbers so the demo looks the same every time. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s ^ (s >>> 15), 0x2c1b3c6d) + 0x9e3779b9) >>> 0;
    s ^= s >>> 12;
    return (s >>> 0) / 4294967296;
  };
}

export interface Creator {
  id: string;
  displayName: string;
  legalName: string;
  country: string;
  isMinor: boolean;
  status: "active" | "paused" | "ended";
  referralCode: string;
  bankOnFile: boolean;
  taxInfo: "ABN provided" | "Hobbyist declaration" | "Pending";
}

export const creators: Creator[] = instructors.map((i) => ({
  id: i.creatorId,
  displayName: i.displayName,
  legalName: i.isMinor ? `Guardian of ${i.displayName} (placeholder)` : `${i.displayName.replace("Coach ", "")} Example Pty Ltd`,
  country: "AU",
  isMinor: i.isMinor,
  status: i.creatorId === "cr-rosa" ? "ended" : i.creatorId === "cr-theo" ? "active" : "active",
  referralCode: i.displayName.split(" ").pop()!.toUpperCase(),
  bankOnFile: i.creatorId !== "cr-kit",
  taxInfo: i.isMinor ? "Hobbyist declaration" : i.creatorId === "cr-rosa" ? "Pending" : "ABN provided",
}));

const founding = (id: string): CreatorContract => ({
  contractId: `ct-${id}`,
  version: 1,
  creatorId: id,
  payoutCurrency: "AUD",
  licenceStartMonth: "2026-06",
  royaltyPauses: [],
  royaltyEligible: true,
  referral: { ...DEFAULT_REFERRAL_TERMS, maxPaidMonths: 120, acceptNewFromMonth: "2026-06" },
  netReceiptsPolicyVersion: "net-receipts-v1",
  royaltyPoolPolicyVersion: "royalty-pool-v1",
  payout: { ...DEFAULT_PAYOUT_TERMS },
  guardianManaged: true,
});

export const contracts: CreatorContract[] = [
  { ...founding("cr-ava"), guardianManaged: false, referral: { ...DEFAULT_REFERRAL_TERMS, acceptNewFromMonth: "2026-06" } },
  // Theo: v1 original, v2 adds a one-month licence pause in August and a longer referral term for NEW referrals.
  { ...founding("cr-theo"), guardianManaged: false, referral: { ...DEFAULT_REFERRAL_TERMS, acceptNewFromMonth: "2026-06" } },
  { ...founding("cr-theo"), version: 2, guardianManaged: false, royaltyPauses: [{ fromMonth: "2026-08", toMonth: "2026-08" }], referral: { ...DEFAULT_REFERRAL_TERMS, maxPaidMonths: 24, acceptNewFromMonth: "2026-06" } },
  // Rosa: content licence ended in September; referral commissions keep running for households she brought in.
  { ...founding("cr-rosa"), guardianManaged: false, licenceEndMonth: "2026-09", referral: { ...DEFAULT_REFERRAL_TERMS, rateBps: 1200, acceptNewFromMonth: "2026-06", acceptNewUntilMonth: "2026-09" } },
  founding("cr-pip"),
  founding("cr-bee"),
  founding("cr-kit"),
];

export type PlanKind = "founder" | "monthly" | "promo" | "annual";

export interface DemoHousehold {
  id: string;
  label: string;
  plan: PlanKind;
  profiles: number;
  joinedMonth: string;
  cancelledAfterMonth?: string;
  status: "active" | "past_due" | "canceled";
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  referredBy?: string;
}

const MONTHS = ["2026-06", "2026-07", "2026-08", "2026-09", "2026-10"];
const SURNAMES = ["Nguyen", "Smith", "Patel", "Kelly", "Rossi", "Chen", "Walker", "Haddad", "Okafor", "Brown", "Singh", "Murphy", "Lee", "Costa", "Tanaka", "Wilson", "Ali", "Moore", "Kowalski", "Ng", "Evans", "Garcia", "Clarke", "Silva", "Taylor", "Kim", "Ahmed", "Martin", "Lopez", "Young", "Hughes", "Dang", "Park", "Reid", "Fraser", "Baker"];

function buildHouseholds(): DemoHousehold[] {
  const r = rng(42);
  const COUNT = 840;
  return Array.from({ length: COUNT }, (_, i) => {
    const name = `${SURNAMES[i % SURNAMES.length]}${i >= SURNAMES.length ? `-${Math.floor(i / SURNAMES.length) + 1}` : ""}`;
    const plan: PlanKind = i < 260 ? "founder" : i % 7 === 0 ? "annual" : i % 5 === 0 ? "promo" : "monthly";
    // Growth curve: more households join in later months.
    const joinedMonth = plan === "founder" ? "2026-06" : MONTHS[Math.min(4, Math.floor(Math.sqrt(r()) * 5))]!;
    const cancelled = i % 17 === 9 && joinedMonth < "2026-10" ? addMonths(joinedMonth, 1) : undefined;
    const referrers = ["cr-pip", "cr-ava", "cr-bee", "cr-theo", "cr-rosa"];
    const referredBy = r() < 0.3 ? referrers[Math.floor(r() * referrers.length)] : undefined;
    return {
      id: `hh-${name.toLowerCase()}`,
      label: `${name.replace(/-\d+$/, "")} household${/-\d+$/.test(name) ? ` #${name.split("-").pop()}` : ""}`,
      plan,
      profiles: 1 + Math.floor(r() * 5),
      joinedMonth,
      cancelledAfterMonth: cancelled,
      status: cancelled ? "canceled" : i % 61 === 14 ? "past_due" : "active",
      stripeCustomerId: `cus_demo${String(i).padStart(4, "0")}`,
      stripeSubscriptionId: `sub_demo${String(i).padStart(4, "0")}`,
      referredBy: referredBy === "cr-rosa" && joinedMonth > "2026-09" ? undefined : referredBy,
    };
  });
}

export const households = buildHouseholds();

function chargeFor(h: DemoHousehold, cycle: number): number {
  switch (h.plan) {
    case "founder":
      return 999;
    case "promo":
      return cycle < 3 ? 499 : 1499;
    case "annual":
      return 14999;
    default:
      return 1499;
  }
}

function buildInvoices(): InvoiceSnapshot[] {
  const out: InvoiceSnapshot[] = [];
  for (const h of households) {
    if (h.plan === "annual") {
      out.push(inv(h, h.joinedMonth, 14999, 12));
      continue;
    }
    let cycle = 0;
    for (const m of MONTHS) {
      if (m < h.joinedMonth) continue;
      if (h.cancelledAfterMonth && m > h.cancelledAfterMonth) break;
      if (h.status === "past_due" && m === "2026-10") break; // October payment failed
      out.push(inv(h, m, chargeFor(h, cycle++), 1));
    }
  }
  return out;
}

function inv(h: DemoHousehold, month: string, gross: number, months: number): InvoiceSnapshot {
  return {
    invoiceId: `in_${h.id}_${month}`,
    householdId: h.id,
    provider: "stripe",
    currency: "AUD",
    grossPaidMinor: gross,
    taxMinor: gstIncludedMinor(gross),
    processorFeeMinor: Math.round(gross * 0.017) + 30,
    platformFeeMinor: 0,
    serviceStartMonth: month,
    serviceMonths: months,
    paidAt: `${month}-03T02:00:00Z`,
  };
}

export const invoices = buildInvoices();

export const refunds: RefundSnapshot[] = [
  {
    refundId: "re_demo_patel",
    invoiceId: "in_hh-patel_2026-08",
    grossRefundMinor: 999,
    taxRefundMinor: gstIncludedMinor(999),
    processorFeeReturnedMinor: 0,
    kind: "refund",
    disputeFeeMinor: 0,
    createdAt: "2026-09-04T00:00:00Z",
  },
];

function buildViews(): QualifiedView[] {
  const r = rng(7);
  const creatorIds = ["cr-ava", "cr-theo", "cr-rosa", "cr-pip", "cr-bee", "cr-kit"];
  const out: QualifiedView[] = [];
  for (const h of households) {
    const taste = creatorIds.map(() => r() ** 2);
    for (const m of MONTHS) {
      if (m < h.joinedMonth) continue;
      if (h.cancelledAfterMonth && m > h.cancelledAfterMonth) continue;
      if (r() < 0.12) continue; // paid but watched nothing this month
      for (let p = 0; p < h.profiles; p++) {
        creatorIds.forEach((c, ci) => {
          const minutes = Math.round(taste[ci]! * 120 * r());
          if (minutes < 4) return;
          out.push({
            householdId: h.id,
            profileId: `${h.id}-p${p}`,
            workoutId: `w-${c}`,
            creatorId: c,
            day: `${m}-12`,
            month: m,
            creditedSec: minutes * 60,
            sessionId: `${h.id}-${m}-${p}-${c}`,
          });
        });
      }
    }
  }
  return out;
}

export const views = buildViews();

export const attributions: Attribution[] = households
  .filter((h) => h.referredBy)
  .map((h) => {
    const c = contracts.filter((x) => x.creatorId === h.referredBy).sort((a, b) => b.version - a.version)[0]!;
    return {
      householdId: h.id,
      creatorId: c.creatorId,
      code: creators.find((x) => x.id === c.creatorId)!.referralCode,
      attributedAt: `${h.joinedMonth}-02T09:00:00Z`,
      contractId: c.contractId,
      contractVersion: c.version,
      terms: { ...c.referral },
      source: "link" as const,
    };
  });

export const referralFunnel: Record<string, { clicks: number; registered: number; paying: number }> = {
  "cr-ava": { clicks: 3120, registered: 214, paying: 0 },
  "cr-theo": { clicks: 2410, registered: 160, paying: 0 },
  "cr-rosa": { clicks: 1650, registered: 98, paying: 0 },
  "cr-pip": { clicks: 4980, registered: 301, paying: 0 },
  "cr-bee": { clicks: 3305, registered: 187, paying: 0 },
  "cr-kit": { clicks: 1210, registered: 96, paying: 0 },
};
for (const a of attributions) referralFunnel[a.creatorId]!.paying += 1;

export interface DemoFinance {
  snapshots: MonthEndSnapshot[];
  ledger: LedgerEntry[];
  batches: PayoutBatch[];
  asOfDate: string;
}

let cache: DemoFinance | undefined;

/**
 * Runs the real month-end engine over the demo data: June–September are
 * final, October is provisional (month not yet closed). June earnings were
 * paid in September; July earnings are in an approved batch awaiting export.
 */
export function demoFinance(): DemoFinance {
  if (cache) return cache;
  const ledger: LedgerEntry[] = [];
  const snapshots: MonthEndSnapshot[] = [];
  for (const month of MONTHS) {
    const status = month === "2026-10" ? "provisional" : "final";
    const res = runMonthEnd({
      month,
      status,
      invoices,
      refunds,
      views,
      contracts,
      attributions,
      priorEntries: ledger,
      now: `${addMonths(month, 1)}-05T00:00:00Z`,
    });
    ledger.push(...res.entries);
    snapshots.push(res.snapshot);
  }

  const terms = DEFAULT_PAYOUT_TERMS;
  const creatorIds = creators.map((c) => c.id);
  // September batch: June earnings, created by ops, approved by finance, confirmed with bank evidence.
  const juneLedger = ledger.filter((e) => e.earningMonth === "2026-06");
  const sepSummaries = creatorIds.map((id) => computePayable({ creatorId: id, ledger: juneLedger, batches: [], terms, asOfDate: "2026-09-15" }));
  let sep = createPayoutBatch({ id: "PB-2026-09", summaries: sepSummaries, existing: [], createdBy: "ops@PROJECT_NAME", now: "2026-09-10T00:00:00Z", currency: "AUD" });
  sep = approveBatch(sep, "finance@PROJECT_NAME", "2026-09-11T00:00:00Z");
  sep = markExported(sep, "finance@PROJECT_NAME", "2026-09-12T00:00:00Z");
  sep = confirmPaid(sep, { bankReference: "BANK-REF-0915", evidence: "bank-confirmation-2026-09-15.csv", confirmedBy: "finance@PROJECT_NAME", now: "2026-09-15T23:00:00Z" });

  const octSummaries = creatorIds.map((id) => computePayable({ creatorId: id, ledger, batches: [sep], terms, asOfDate: "2026-10-15" }));
  let oct = createPayoutBatch({ id: "PB-2026-10", summaries: octSummaries, existing: [sep], createdBy: "ops@PROJECT_NAME", now: "2026-10-10T00:00:00Z", currency: "AUD" });
  oct = approveBatch(oct, "finance@PROJECT_NAME", "2026-10-11T00:00:00Z");

  cache = { snapshots, ledger, batches: [sep, oct], asOfDate: "2026-10-26" };
  return cache;
}
