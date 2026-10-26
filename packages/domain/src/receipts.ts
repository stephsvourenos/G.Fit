import { allocateByWeight, assertMinor, type CurrencyCode } from "./money";
import type { BillingProvider } from "./entitlement";

/**
 * A snapshot of one paid invoice, copied from the billing provider (Stripe is the
 * source of truth). We store the provider's IDs and the amounts exactly as paid.
 */
export interface InvoiceSnapshot {
  invoiceId: string;
  householdId: string;
  provider: BillingProvider;
  currency: CurrencyCode;
  /** Amount actually paid by the customer, including GST, after discounts. */
  grossPaidMinor: number;
  /** GST / tax included in gross. */
  taxMinor: number;
  /** Card processing fee (e.g. Stripe fee) attributable to this invoice. */
  processorFeeMinor: number;
  /** App-store commission when sold via Apple/Google in-app purchase. */
  platformFeeMinor: number;
  /** First service month this invoice pays for, e.g. "2026-11". */
  serviceStartMonth: string;
  /** 1 for monthly, 12 for annual. */
  serviceMonths: number;
  paidAt: string;
}

export interface RefundSnapshot {
  refundId: string;
  invoiceId: string;
  /** Gross amount refunded including GST. */
  grossRefundMinor: number;
  taxRefundMinor: number;
  /** Processor fees are usually NOT returned on refunds; recorded for completeness. */
  processorFeeReturnedMinor: number;
  kind: "refund" | "chargeback";
  /** Chargeback dispute fee charged to us, if any. */
  disputeFeeMinor: number;
  createdAt: string;
}

/**
 * Versioned definition of "eligible net receipts". Creators are paid on this,
 * never on list price. Each creator contract points at a specific version.
 */
export interface NetReceiptsPolicy {
  version: string;
  excludeTax: true; // GST is never revenue — always excluded.
  deductProcessorFees: boolean;
  deductPlatformFees: boolean;
  deductDisputeFees: boolean;
  description: string;
}

export const DEFAULT_NET_RECEIPTS_POLICY: NetReceiptsPolicy = {
  version: "net-receipts-v1",
  excludeTax: true,
  deductProcessorFees: true,
  deductPlatformFees: true,
  deductDisputeFees: true,
  description:
    "Net receipts = amount the customer actually paid, minus GST/tax, minus payment-processor fees, " +
    "minus any app-store commission. Refunds and chargebacks are deducted when they happen, as " +
    "adjusting entries (earlier statements are never rewritten).",
};

export function invoiceNetMinor(inv: InvoiceSnapshot, policy: NetReceiptsPolicy): number {
  let net = inv.grossPaidMinor - inv.taxMinor;
  if (policy.deductProcessorFees) net -= inv.processorFeeMinor;
  if (policy.deductPlatformFees) net -= inv.platformFeeMinor;
  return assertMinor(Math.max(0, net), "invoice net");
}

/** Net amount a refund/chargeback removes (positive number). */
export function refundNetMinor(r: RefundSnapshot, policy: NetReceiptsPolicy): number {
  let net = r.grossRefundMinor - r.taxRefundMinor - r.processorFeeReturnedMinor;
  if (policy.deductDisputeFees) net += r.disputeFeeMinor;
  return assertMinor(Math.max(0, net), "refund net");
}

export function addMonths(month: string, n: number): string {
  const [y, m] = month.split("-").map(Number) as [number, number];
  const idx = y * 12 + (m - 1) + n;
  const ny = Math.floor(idx / 12);
  const nm = (idx % 12) + 1;
  return `${ny}-${String(nm).padStart(2, "0")}`;
}

export function monthsBetween(a: string, b: string): number {
  const [ay, am] = a.split("-").map(Number) as [number, number];
  const [by, bm] = b.split("-").map(Number) as [number, number];
  return by * 12 + bm - (ay * 12 + am);
}

export interface RecognisedReceipt {
  householdId: string;
  invoiceId: string;
  serviceMonth: string;
  netMinor: number;
  currency: CurrencyCode;
}

/**
 * Spreads an invoice's net receipts evenly across the months it pays for.
 * An annual plan paid once becomes 12 monthly amounts that sum exactly to the
 * invoice net (any odd cents go to the earliest months, deterministically).
 */
export function recogniseInvoice(inv: InvoiceSnapshot, policy: NetReceiptsPolicy): RecognisedReceipt[] {
  if (!Number.isInteger(inv.serviceMonths) || inv.serviceMonths < 1) {
    throw new Error("serviceMonths must be a positive integer");
  }
  const net = invoiceNetMinor(inv, policy);
  const keys = Array.from({ length: inv.serviceMonths }, (_, i) => addMonths(inv.serviceStartMonth, i));
  // Equal weights; ties are broken by key ("YYYY-MM" sorts chronologically),
  // so any leftover cents land on the earliest months, deterministically.
  const parts = allocateByWeight(
    net,
    keys.map((k) => ({ key: k, weight: 1 })),
  );
  return keys.map((k) => ({
    householdId: inv.householdId,
    invoiceId: inv.invoiceId,
    serviceMonth: k,
    netMinor: parts.get(k) ?? 0,
    currency: inv.currency,
  }));
}

export function receiptsForMonth(
  invoices: InvoiceSnapshot[],
  month: string,
  policy: NetReceiptsPolicy,
): RecognisedReceipt[] {
  return invoices.flatMap((inv) => recogniseInvoice(inv, policy)).filter((r) => r.serviceMonth === month);
}
