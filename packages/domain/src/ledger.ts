import { allocateByWeight, sumMinor, type CurrencyCode } from "./money";
import { addMonths } from "./receipts";
import type { PayoutTerms } from "./contracts";

/**
 * Append-only creator ledger. Entries are never edited or deleted:
 * corrections (refunds, chargebacks, mistakes) are new adjusting entries
 * that point at the entry they correct.
 */
export type LedgerKind = "royalty" | "referral" | "adjustment";

export interface LedgerEntry {
  readonly id: string;
  readonly creatorId: string;
  readonly kind: LedgerKind;
  readonly amountMinor: number;
  readonly currency: CurrencyCode;
  /** Month the money was earned in ("YYYY-MM"). */
  readonly earningMonth: string;
  /** Run that produced it: provisional runs can be re-run; final runs are frozen. */
  readonly runId: string;
  readonly runStatus: "provisional" | "final";
  readonly sourceRefs: readonly string[];
  readonly contractRef: string;
  readonly memo: string;
  readonly reversesEntryId?: string;
  readonly createdAt: string;
}

export class AppendOnlyLedger {
  #entries: LedgerEntry[] = [];
  #ids = new Set<string>();

  append(entry: LedgerEntry): void {
    if (this.#ids.has(entry.id)) throw new Error(`duplicate ledger entry ${entry.id}`);
    if (!Number.isSafeInteger(entry.amountMinor)) throw new Error("ledger amounts must be integer minor units");
    this.#ids.add(entry.id);
    this.#entries.push(Object.freeze({ ...entry, sourceRefs: Object.freeze([...entry.sourceRefs]) }));
  }

  /** Idempotent append — used by webhook/run retries. Returns false if already present. */
  appendOnce(entry: LedgerEntry): boolean {
    if (this.#ids.has(entry.id)) return false;
    this.append(entry);
    return true;
  }

  all(): readonly LedgerEntry[] {
    return this.#entries;
  }

  forCreator(creatorId: string): LedgerEntry[] {
    return this.#entries.filter((e) => e.creatorId === creatorId);
  }

  balance(creatorId: string): number {
    return sumMinor(this.forCreator(creatorId).map((e) => e.amountMinor));
  }
}

/**
 * When an invoice is refunded (fully or partly), reverse the same share of every
 * ledger entry that was earned from it. Earlier statements stay untouched.
 */
export function refundReversals(args: {
  entries: readonly LedgerEntry[];
  invoiceId: string;
  /** Net amount refunded vs net amount originally received for the invoice. */
  refundNetMinor: number;
  invoiceNetMinor: number;
  refundId: string;
  postingMonth: string;
  runId: string;
  now: string;
}): LedgerEntry[] {
  const { entries, invoiceId, refundNetMinor, invoiceNetMinor, refundId, postingMonth, runId, now } = args;
  if (invoiceNetMinor <= 0 || refundNetMinor <= 0) return [];
  const affected = entries.filter((e) => e.sourceRefs.includes(`invoice:${invoiceId}`) && !e.reversesEntryId);
  const out: LedgerEntry[] = [];
  for (const e of affected) {
    // Exact proportional reversal: allocate the entry between "kept" and "reversed".
    const parts = allocateByWeight(e.amountMinor, [
      { key: "reversed", weight: Math.min(refundNetMinor, invoiceNetMinor) },
      { key: "kept", weight: Math.max(0, invoiceNetMinor - refundNetMinor) },
    ]);
    const reversed = parts.get("reversed") ?? 0;
    if (reversed === 0) continue;
    out.push({
      id: `${e.id}~${refundId}`,
      creatorId: e.creatorId,
      kind: "adjustment",
      amountMinor: -reversed,
      currency: e.currency,
      earningMonth: postingMonth,
      runId,
      runStatus: "provisional",
      sourceRefs: [`refund:${refundId}`, `invoice:${invoiceId}`],
      contractRef: e.contractRef,
      memo: `Refund adjustment for ${e.kind} earned ${e.earningMonth}`,
      reversesEntryId: e.id,
      createdAt: now,
    });
  }
  return out;
}

export function payoutDueDate(earningMonth: string, terms: PayoutTerms): string {
  const m = addMonths(earningMonth, terms.monthsAfterEarning);
  return `${m}-${String(terms.payDay).padStart(2, "0")}`;
}

export type PayoutStatus = "draft" | "approved" | "exported" | "confirmed" | "failed" | "cancelled";

export interface PayoutBatchItem {
  creatorId: string;
  entryIds: string[];
  amountMinor: number;
  currency: CurrencyCode;
}

export interface PayoutBatch {
  id: string;
  status: PayoutStatus;
  items: PayoutBatchItem[];
  createdBy: string;
  approvedBy?: string;
  exportedAt?: string;
  confirmation?: { bankReference: string; confirmedBy: string; confirmedAt: string; evidence: string };
  audit: Array<{ at: string; by: string; action: string }>;
}

export interface PayableSummary {
  creatorId: string;
  dueEntries: LedgerEntry[];
  dueMinor: number;
  status: "payable" | "below-minimum-carry-forward" | "negative-carry-forward" | "nothing-due";
}

/** Entries already in a live (not failed/cancelled) batch can never be paid again. */
export function entriesAlreadyInBatches(batches: PayoutBatch[]): Set<string> {
  const used = new Set<string>();
  for (const b of batches) {
    if (b.status === "failed" || b.status === "cancelled") continue;
    for (const item of b.items) for (const id of item.entryIds) used.add(id);
  }
  return used;
}

export function computePayable(args: {
  creatorId: string;
  ledger: readonly LedgerEntry[];
  batches: PayoutBatch[];
  terms: PayoutTerms;
  asOfDate: string;
}): PayableSummary {
  const { creatorId, ledger, batches, terms, asOfDate } = args;
  const used = entriesAlreadyInBatches(batches);
  const dueEntries = ledger.filter(
    (e) =>
      e.creatorId === creatorId &&
      e.runStatus === "final" &&
      !used.has(e.id) &&
      payoutDueDate(e.earningMonth, terms) <= asOfDate,
  );
  const dueMinor = sumMinor(dueEntries.map((e) => e.amountMinor));
  let status: PayableSummary["status"] = "payable";
  if (dueEntries.length === 0) status = "nothing-due";
  else if (dueMinor < 0) status = "negative-carry-forward";
  else if (dueMinor < terms.minPayoutMinor) status = "below-minimum-carry-forward";
  return { creatorId, dueEntries, dueMinor, status };
}

export function createPayoutBatch(args: {
  id: string;
  summaries: PayableSummary[];
  existing: PayoutBatch[];
  createdBy: string;
  now: string;
  currency: CurrencyCode;
}): PayoutBatch {
  const used = entriesAlreadyInBatches(args.existing);
  const items: PayoutBatchItem[] = [];
  for (const s of args.summaries) {
    if (s.status !== "payable") continue;
    if (s.dueEntries.some((e) => used.has(e.id))) throw new Error(`entries for ${s.creatorId} already in a batch`);
    items.push({ creatorId: s.creatorId, entryIds: s.dueEntries.map((e) => e.id), amountMinor: s.dueMinor, currency: args.currency });
  }
  return { id: args.id, status: "draft", items, createdBy: args.createdBy, audit: [{ at: args.now, by: args.createdBy, action: "created" }] };
}

/** Maker/checker: the person approving must not be the person who created the batch. */
export function approveBatch(b: PayoutBatch, approver: string, now: string): PayoutBatch {
  if (b.status !== "draft") throw new Error(`cannot approve a ${b.status} batch`);
  if (approver === b.createdBy) throw new Error("maker/checker: creator of a batch cannot approve it");
  return { ...b, status: "approved", approvedBy: approver, audit: [...b.audit, { at: now, by: approver, action: "approved" }] };
}

export function markExported(b: PayoutBatch, by: string, now: string): PayoutBatch {
  if (b.status !== "approved") throw new Error("only approved batches can be exported to a bank file");
  return { ...b, status: "exported", exportedAt: now, audit: [...b.audit, { at: now, by, action: "exported" }] };
}

/** A batch is only "paid" with reconciliation evidence (bank reference + statement/file). */
export function confirmPaid(
  b: PayoutBatch,
  c: { bankReference: string; evidence: string; confirmedBy: string; now: string },
): PayoutBatch {
  if (b.status !== "exported") throw new Error("only exported batches can be confirmed");
  if (!c.bankReference.trim() || !c.evidence.trim()) throw new Error("bank reference and evidence are required to confirm payment");
  return {
    ...b,
    status: "confirmed",
    confirmation: { bankReference: c.bankReference, evidence: c.evidence, confirmedBy: c.confirmedBy, confirmedAt: c.now },
    audit: [...b.audit, { at: c.now, by: c.confirmedBy, action: `confirmed ${c.bankReference}` }],
  };
}
