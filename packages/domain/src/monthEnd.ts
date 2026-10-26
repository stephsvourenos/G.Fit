import { sumMinor, type CurrencyCode } from "./money";
import { royaltyEligibleInMonth, type CreatorContract } from "./contracts";
import {
  DEFAULT_NET_RECEIPTS_POLICY,
  invoiceNetMinor,
  receiptsForMonth,
  recogniseInvoice,
  refundNetMinor,
  type InvoiceSnapshot,
  type NetReceiptsPolicy,
  type RefundSnapshot,
} from "./receipts";
import { DEFAULT_ROYALTY_POLICY, runRoyaltyPool, type RoyaltyPoolPolicy, type RoyaltyRunResult } from "./royalty";
import { commissionForHousehold, type Attribution } from "./referral";
import { refundReversals, type LedgerEntry } from "./ledger";
import type { QualifiedView } from "./playback";

export interface MonthEndSnapshot {
  runId: string;
  month: string;
  status: "provisional" | "final";
  policyVersions: { netReceipts: string; royaltyPool: string };
  netReceiptsMinor: number;
  royaltyPoolMinor: number;
  royaltyAllocatedMinor: number;
  royaltyRetainedMinor: number;
  referralMinor: number;
  adjustmentsMinor: number;
  entryCount: number;
  /** Deterministic fingerprint: same inputs => same fingerprint. Proves reproducibility. */
  fingerprint: string;
}

export interface MonthEndResult {
  snapshot: MonthEndSnapshot;
  entries: LedgerEntry[];
  royalty: RoyaltyRunResult;
}

function fnv1a(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

export function runMonthEnd(args: {
  month: string;
  status: "provisional" | "final";
  invoices: InvoiceSnapshot[];
  refunds: RefundSnapshot[];
  views: QualifiedView[];
  contracts: CreatorContract[];
  attributions: Attribution[];
  /** Ledger entries from earlier (already final) months — needed to reverse refunded earnings. */
  priorEntries: readonly LedgerEntry[];
  currency?: CurrencyCode;
  netPolicy?: NetReceiptsPolicy;
  royaltyPolicy?: RoyaltyPoolPolicy;
  now: string;
}): MonthEndResult {
  const { month, status, invoices, refunds, views, contracts, attributions, priorEntries, now } = args;
  const currency = args.currency ?? "AUD";
  const netPolicy = args.netPolicy ?? DEFAULT_NET_RECEIPTS_POLICY;
  const royaltyPolicy = args.royaltyPolicy ?? DEFAULT_ROYALTY_POLICY;
  const runId = `run-${month}-${status}`;
  const latest = (creatorId: string) =>
    contracts.filter((c) => c.creatorId === creatorId).sort((a, b) => b.version - a.version)[0];

  const receipts = receiptsForMonth(invoices, month, netPolicy);

  // A. Royalty pool (household-balanced).
  const royalty = runRoyaltyPool({
    month,
    receipts,
    views,
    policy: royaltyPolicy,
    isCreatorEligible: (creatorId, m) => {
      const c = latest(creatorId);
      return c ? royaltyEligibleInMonth(c, m) : false;
    },
  });

  // Group royalty lines per creator + invoice for a readable, traceable ledger.
  const grouped = new Map<string, { creatorId: string; invoiceId?: string; amount: number; basis: string }>();
  for (const l of royalty.lines) {
    const key = `${l.creatorId}|${l.invoiceId ?? "pool"}|${l.basis}`;
    const g = grouped.get(key) ?? { creatorId: l.creatorId, invoiceId: l.invoiceId, amount: 0, basis: l.basis };
    g.amount += l.amountMinor;
    grouped.set(key, g);
  }

  const entries: LedgerEntry[] = [];
  for (const [key, g] of [...grouped.entries()].sort(([a], [b]) => (a < b ? -1 : 1))) {
    if (g.amount === 0) continue;
    const c = latest(g.creatorId);
    entries.push({
      id: `roy:${month}:${key}`,
      creatorId: g.creatorId,
      kind: "royalty",
      amountMinor: g.amount,
      currency,
      earningMonth: month,
      runId,
      runStatus: status,
      sourceRefs: [g.invoiceId ? `invoice:${g.invoiceId}` : "pool:zero-view", `policy:${royaltyPolicy.version}`, `views:${month}`],
      contractRef: c ? `${c.contractId}@v${c.version}` : "none",
      memo: g.basis === "household-viewing" ? "Content royalty from household viewing" : "Share of unwatched households' pool",
      createdAt: now,
    });
  }

  // B. Referral commission (terms frozen at attribution).
  // Every month recognised up to and including this one, so paid-month counts are right.
  const recognisedToDate = invoices
    .flatMap((inv) => recogniseInvoice(inv, netPolicy))
    .filter((r) => r.serviceMonth <= month);
  for (const a of attributions) {
    const schedule = commissionForHousehold(a, recognisedToDate);
    for (const line of schedule.lines.filter((l) => l.serviceMonth === month)) {
      if (line.amountMinor === 0) continue;
      entries.push({
        id: `ref:${month}:${a.creatorId}:${line.invoiceId}`,
        creatorId: a.creatorId,
        kind: "referral",
        amountMinor: line.amountMinor,
        currency,
        earningMonth: month,
        runId,
        runStatus: status,
        sourceRefs: [`invoice:${line.invoiceId}`, `attribution:${a.householdId}`],
        contractRef: `${a.contractId}@v${a.contractVersion}`,
        memo: `Referral commission — paid month ${line.paidMonthNumber} of ${a.terms.maxPaidMonths}`,
        createdAt: now,
      });
    }
  }

  // C. Refunds posted this month reverse earnings from the refunded invoice.
  const adjustments: LedgerEntry[] = [];
  for (const r of refunds.filter((x) => x.createdAt.slice(0, 7) === month)) {
    const inv = invoices.find((i) => i.invoiceId === r.invoiceId);
    if (!inv) continue;
    const reversals = refundReversals({
      entries: [...priorEntries, ...entries],
      invoiceId: r.invoiceId,
      refundNetMinor: refundNetMinor(r, netPolicy),
      invoiceNetMinor: invoiceNetMinor(inv, netPolicy),
      refundId: r.refundId,
      postingMonth: month,
      runId,
      now,
    }).map((e) => ({ ...e, runStatus: status }));
    adjustments.push(...reversals);
  }
  entries.push(...adjustments);

  const canonical = JSON.stringify(
    entries.map((e) => [e.id, e.creatorId, e.kind, e.amountMinor, e.earningMonth, e.contractRef]).sort(),
  );

  return {
    royalty,
    entries,
    snapshot: {
      runId,
      month,
      status,
      policyVersions: { netReceipts: netPolicy.version, royaltyPool: royaltyPolicy.version },
      netReceiptsMinor: royalty.totalNetReceiptsMinor,
      royaltyPoolMinor: royalty.poolMinor,
      royaltyAllocatedMinor: royalty.allocatedMinor,
      royaltyRetainedMinor: royalty.retainedMinor,
      referralMinor: sumMinor(entries.filter((e) => e.kind === "referral").map((e) => e.amountMinor)),
      adjustmentsMinor: sumMinor(adjustments.map((e) => e.amountMinor)),
      entryCount: entries.length,
      fingerprint: fnv1a(canonical),
    },
  };
}
