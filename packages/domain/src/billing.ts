import type { CurrencyCode } from "./money";
import type { HouseholdEntitlement, SubscriptionStatus } from "./entitlement";

/**
 * Pricing model mirrors Stripe's: a Price is immutable. "Changing the price"
 * means creating a NEW Price and pointing new sign-ups at it. Existing
 * subscribers stay on the Price they bought (grandfathering) unless the
 * business deliberately migrates them with notice.
 */
export interface Price {
  priceId: string;
  productId: string;
  amountMinor: number; // GST-inclusive, as displayed to Australian consumers
  currency: CurrencyCode;
  interval: "month" | "year";
  active: boolean;
  label: string;
}

export interface Coupon {
  couponId: string;
  amountOffMinor?: number;
  percentOff?: number;
  /** "repeating" for N months, "once", or "forever" — same semantics as Stripe. */
  duration: "once" | "repeating" | "forever";
  durationInMonths?: number;
}

export interface SubscriptionModel {
  subscriptionId: string;
  householdId: string;
  priceId: string;
  coupon?: Coupon;
  startMonth: string;
}

/** Amount charged for the Nth billing cycle (0-based) of a monthly subscription. */
export function chargeForCycle(sub: SubscriptionModel, prices: Price[], cycle: number): number {
  const price = prices.find((p) => p.priceId === sub.priceId);
  if (!price) throw new Error(`unknown price ${sub.priceId}`);
  let amount = price.amountMinor;
  const c = sub.coupon;
  const couponApplies =
    c && (c.duration === "forever" || (c.duration === "once" && cycle === 0) || (c.duration === "repeating" && cycle < (c.durationInMonths ?? 0)));
  if (c && couponApplies) {
    if (c.amountOffMinor) amount -= c.amountOffMinor;
    if (c.percentOff) amount -= Math.round((amount * c.percentOff) / 100);
  }
  return Math.max(0, amount);
}

/** GST is 1/11th of a GST-inclusive Australian price. */
export function gstIncludedMinor(grossMinor: number): number {
  return Math.round(grossMinor / 11);
}

/* ---------------- Webhook processing (provider-agnostic) ---------------- */

export interface BillingEvent {
  eventId: string;
  type: string;
  createdAt: number;
  subscriptionId: string;
}

/** What the provider says the subscription looks like RIGHT NOW. */
export interface ProviderSubscription {
  subscriptionId: string;
  householdId: string;
  status: SubscriptionStatus;
  currentPeriodEnd: string;
}

export interface EventStore {
  hasProcessed(eventId: string): boolean;
  markProcessed(eventId: string): void;
}

export class InMemoryEventStore implements EventStore {
  #ids = new Set<string>();
  hasProcessed(id: string) {
    return this.#ids.has(id);
  }
  markProcessed(id: string) {
    this.#ids.add(id);
  }
}

/**
 * Handles a webhook safely:
 *  1. signature is verified BEFORE this is called (provider SDK);
 *  2. the same event delivered twice is ignored (idempotent);
 *  3. we never trust the event's copy of the subscription — events can arrive
 *     out of order — so we fetch the provider's current object and store that.
 */
export async function processBillingEvent(args: {
  event: BillingEvent;
  store: EventStore;
  fetchCurrent: (subscriptionId: string) => Promise<ProviderSubscription>;
  upsertEntitlement: (e: HouseholdEntitlement) => void;
  provider: HouseholdEntitlement["provider"];
}): Promise<"processed" | "duplicate" | "ignored"> {
  const { event, store, fetchCurrent, upsertEntitlement, provider } = args;
  if (store.hasProcessed(event.eventId)) return "duplicate";
  const relevant = event.type.startsWith("customer.subscription.") || event.type.startsWith("invoice.");
  if (!relevant) {
    store.markProcessed(event.eventId);
    return "ignored";
  }
  const current = await fetchCurrent(event.subscriptionId);
  upsertEntitlement({
    householdId: current.householdId,
    provider,
    providerSubscriptionId: current.subscriptionId,
    status: current.status,
    currentPeriodEnd: current.currentPeriodEnd,
    graceDays: 3,
  });
  store.markProcessed(event.eventId);
  return "processed";
}
