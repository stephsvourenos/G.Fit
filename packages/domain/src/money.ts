/**
 * Money is always stored as an integer number of minor units (cents for AUD).
 * Never use floating point for money. Every function here either returns an
 * integer or throws.
 */

export type CurrencyCode = "AUD" | "NZD" | "USD" | "GBP" | "EUR" | "CAD";

export interface Money {
  readonly amountMinor: number;
  readonly currency: CurrencyCode;
}

export function assertMinor(value: number, label = "amount"): number {
  if (!Number.isSafeInteger(value)) {
    throw new Error(`${label} must be a safe integer number of minor units, got ${value}`);
  }
  return value;
}

export function money(amountMinor: number, currency: CurrencyCode = "AUD"): Money {
  return { amountMinor: assertMinor(amountMinor), currency };
}

/** A rate expressed in basis points (1% = 100 bps) so that rates stay integers. */
export type BasisPoints = number;

export function pct(percent: number): BasisPoints {
  const bps = Math.round(percent * 100);
  if (bps < 0 || bps > 10_000) throw new Error(`rate out of range: ${percent}%`);
  return bps;
}

/**
 * Multiply an integer amount by a basis-point rate using round-half-up on the
 * absolute value (so refunds mirror charges exactly).
 */
export function applyRate(amountMinor: number, rateBps: BasisPoints): number {
  assertMinor(amountMinor);
  const sign = amountMinor < 0 ? -1 : 1;
  const abs = Math.abs(amountMinor);
  // Use BigInt to avoid any intermediate precision loss on large amounts.
  const TEN_K = BigInt(10_000);
  const ONE = BigInt(1);
  const TWO = BigInt(2);
  const scaled = BigInt(abs) * BigInt(rateBps);
  const quotient = scaled / TEN_K;
  const remainder = scaled % TEN_K;
  const rounded = remainder * TWO >= TEN_K ? quotient + ONE : quotient;
  return sign * Number(rounded);
}

export interface AllocationShare<K extends string = string> {
  key: K;
  weight: number;
}

/**
 * Split `totalMinor` across shares in proportion to their (non-negative)
 * weights using the largest-remainder method. The parts always sum exactly
 * to the total, so there is never a rounding residue. Ties on the remainder
 * are broken by key (alphabetical) so results are reproducible.
 */
export function allocateByWeight<K extends string>(
  totalMinor: number,
  shares: ReadonlyArray<AllocationShare<K>>,
): Map<K, number> {
  assertMinor(totalMinor, "total");
  const result = new Map<K, number>();
  const positive = shares.filter((s) => s.weight > 0);
  if (positive.length === 0) return result;
  for (const s of shares) {
    if (s.weight < 0 || !Number.isFinite(s.weight)) throw new Error(`invalid weight for ${s.key}`);
  }

  // Scale weights to integers (weights can be fractional minutes) for exact maths.
  const SCALE = 1_000_000;
  const intWeights = positive.map((s) => ({ key: s.key, w: BigInt(Math.round(s.weight * SCALE)) }));
  const ZERO = BigInt(0);
  const ONE = BigInt(1);
  const totalWeight = intWeights.reduce((acc, s) => acc + s.w, ZERO);
  if (totalWeight === ZERO) return result;

  const sign = totalMinor < 0 ? -ONE : ONE;
  const absTotal = BigInt(Math.abs(totalMinor));
  let assigned = ZERO;
  const parts = intWeights.map((s) => {
    const exact = absTotal * s.w;
    const floor = exact / totalWeight;
    const remainder = exact % totalWeight;
    assigned += floor;
    return { key: s.key, floor, remainder };
  });

  let leftover = absTotal - assigned;
  const byRemainder = [...parts].sort((a, b) =>
    a.remainder === b.remainder ? (a.key < b.key ? -1 : 1) : a.remainder > b.remainder ? -1 : 1,
  );
  for (const p of byRemainder) {
    if (leftover === ZERO) break;
    p.floor += ONE;
    leftover -= ONE;
  }
  for (const p of parts) result.set(p.key, Number(sign * p.floor));
  return result;
}

export function sumMinor(values: Iterable<number>): number {
  let total = 0;
  for (const v of values) total += assertMinor(v);
  return assertMinor(total, "sum");
}

const SYMBOLS: Record<CurrencyCode, string> = {
  AUD: "A$",
  NZD: "NZ$",
  USD: "US$",
  GBP: "£",
  EUR: "€",
  CAD: "C$",
};

export function formatMoney(amountMinor: number, currency: CurrencyCode = "AUD"): string {
  const sign = amountMinor < 0 ? "-" : "";
  const abs = Math.abs(amountMinor);
  const dollars = Math.floor(abs / 100).toLocaleString("en-AU");
  const cents = String(abs % 100).padStart(2, "0");
  return `${sign}${SYMBOLS[currency]}${dollars}.${cents}`;
}
