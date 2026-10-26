import { isAllowedForProfile, type Profile, type Workout } from "./catalog";

/**
 * Billing is provider-agnostic. Stripe (website) is first; Apple/Google in-app
 * purchase can be added later as further providers without changing how
 * profiles get access or how creators are paid.
 */
export type BillingProvider = "stripe" | "apple_iap" | "google_play" | "manual_grant" | "mock";

export type SubscriptionStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "unpaid"
  | "canceled"
  | "incomplete"
  | "incomplete_expired"
  | "paused";

export interface HouseholdEntitlement {
  householdId: string;
  provider: BillingProvider;
  /** Provider's own ID, e.g. Stripe subscription ID. Stored, never invented. */
  providerSubscriptionId: string;
  status: SubscriptionStatus;
  /** ISO timestamp — access ends at this instant unless renewed. */
  currentPeriodEnd: string;
  /** Short grace period for failed renewals so a declined card doesn't instantly lock a family out. */
  graceDays: number;
}

export function hasStreamingAccess(e: HouseholdEntitlement | undefined, now: Date): boolean {
  if (!e) return false;
  const end = new Date(e.currentPeriodEnd).getTime();
  const graceEnd = end + e.graceDays * 86_400_000;
  switch (e.status) {
    case "active":
    case "trialing":
      return now.getTime() < graceEnd;
    case "past_due":
      return now.getTime() < graceEnd;
    case "canceled":
      // Cancelled at period end keeps access until the paid period finishes (no grace).
      return now.getTime() < end;
    default:
      return false;
  }
}

export type PlaybackDenial =
  | "no-entitlement"
  | "not-published"
  | "age-restricted"
  | "pin-required";

export interface PlaybackDecision {
  allowed: boolean;
  reason?: PlaybackDenial;
}

/**
 * Server-side check made before minting a signed playback token.
 * The client UI hides the same content, but this is the real gate.
 */
export function decidePlayback(args: {
  entitlement: HouseholdEntitlement | undefined;
  profile: Profile;
  workout: Workout;
  pinUnlocked: boolean;
  now: Date;
}): PlaybackDecision {
  const { entitlement, profile, workout, pinUnlocked, now } = args;
  if (!hasStreamingAccess(entitlement, now)) return { allowed: false, reason: "no-entitlement" };
  if (profile.pinProtected && !pinUnlocked) return { allowed: false, reason: "pin-required" };
  if (workout.state !== "published") return { allowed: false, reason: "not-published" };
  if (!isAllowedForProfile(workout, profile)) return { allowed: false, reason: "age-restricted" };
  return { allowed: true };
}
