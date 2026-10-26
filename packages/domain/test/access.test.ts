import { describe, expect, it } from "vitest";
import {
  canPublish,
  decidePlayback,
  InMemoryEventStore,
  processBillingEvent,
  type HouseholdEntitlement,
  type Instructor,
  type Profile,
  type ProviderSubscription,
  type Workout,
} from "../src";

const workout: Workout = {
  id: "w1",
  title: "Teen Strength Basics",
  description: "",
  instructorId: "i1",
  creatorId: "c1",
  category: "strength",
  durationSec: 900,
  intensity: "moderate",
  equipment: ["none"],
  ageBands: ["13-15", "16-17", "adult"],
  captions: true,
  state: "published",
  rights: { creatorLicenceSigned: true, musicCleared: true, safetyReviewed: true, guardianConsent: "not-applicable", territories: ["AU"] },
  thumbnail: { from: "#000", to: "#111", emoji: "💪" },
};
const child: Profile = { id: "p-kid", householdId: "h1", nickname: "Kid", avatar: { emoji: "🦊", colour: "#f90" }, ageBand: "6-8", interests: [], pinProtected: false };
const parent: Profile = { ...child, id: "p-parent", ageBand: "adult", pinProtected: true };
const active: HouseholdEntitlement = { householdId: "h1", provider: "stripe", providerSubscriptionId: "sub_1", status: "active", currentPeriodEnd: "2026-12-01T00:00:00Z", graceDays: 3 };
const now = new Date("2026-11-10T00:00:00Z");

describe("acceptance 9 — playback gate", () => {
  it("denies when household entitlement has expired", () => {
    const expired = { ...active, status: "canceled" as const, currentPeriodEnd: "2026-11-01T00:00:00Z" };
    expect(decidePlayback({ entitlement: expired, profile: parent, workout, pinUnlocked: true, now })).toEqual({ allowed: false, reason: "no-entitlement" });
  });
  it("denies a child profile content outside its age band", () => {
    expect(decidePlayback({ entitlement: active, profile: child, workout, pinUnlocked: false, now })).toEqual({ allowed: false, reason: "age-restricted" });
  });
  it("adult profile needs the parent PIN", () => {
    expect(decidePlayback({ entitlement: active, profile: parent, workout, pinUnlocked: false, now }).reason).toBe("pin-required");
    expect(decidePlayback({ entitlement: active, profile: parent, workout, pinUnlocked: true, now }).allowed).toBe(true);
  });
  it("a failed renewal keeps access during the short grace period only", () => {
    const pastDue = { ...active, status: "past_due" as const, currentPeriodEnd: "2026-11-09T00:00:00Z" };
    expect(decidePlayback({ entitlement: pastDue, profile: parent, workout, pinUnlocked: true, now }).allowed).toBe(true);
    expect(decidePlayback({ entitlement: pastDue, profile: parent, workout, pinUnlocked: true, now: new Date("2026-11-20T00:00:00Z") }).allowed).toBe(false);
  });
});

describe("acceptance 6 — webhooks", () => {
  it("duplicate delivery is ignored and out-of-order events use the provider's current state", async () => {
    const store = new InMemoryEventStore();
    const saved: HouseholdEntitlement[] = [];
    // Provider's truth: the subscription is now canceled.
    const current: ProviderSubscription = { subscriptionId: "sub_1", householdId: "h1", status: "canceled", currentPeriodEnd: "2026-11-30T00:00:00Z" };
    const deps = { store, fetchCurrent: async () => current, upsertEntitlement: (e: HouseholdEntitlement) => saved.push(e), provider: "stripe" as const };

    // The older "updated → active" event arrives AFTER the cancel.
    const late = { eventId: "evt_old", type: "customer.subscription.updated", createdAt: 1, subscriptionId: "sub_1" };
    expect(await processBillingEvent({ ...deps, event: late })).toBe("processed");
    expect(await processBillingEvent({ ...deps, event: late })).toBe("duplicate");
    expect(saved).toHaveLength(1);
    expect(saved[0]!.status).toBe("canceled");
  });
});

describe("content publishing gate", () => {
  const minor: Instructor = { id: "i1", displayName: "Coach Junior", isMinor: true, bio: "", specialties: [], creatorId: "c1", accent: "#000" };
  it("blocks publishing a minor's video without guardian consent and music clearance", () => {
    const w = { ...workout, state: "approved" as const, rights: { ...workout.rights, musicCleared: false, guardianConsent: false } };
    const r = canPublish(w, minor);
    expect(r.ok).toBe(false);
    expect(r.problems).toContain("Music rights not cleared");
    expect(r.problems).toContain("Guardian consent missing for a minor instructor");
  });
  it("allows publishing when every check is complete", () => {
    const w = { ...workout, state: "approved" as const, rights: { ...workout.rights, guardianConsent: true as const } };
    expect(canPublish(w, minor).ok).toBe(true);
  });
});
