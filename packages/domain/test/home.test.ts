import { describe, expect, it } from "vitest";
import { buildHomeRows, currentStreak, type Profile, type Workout } from "../src";

const mk = (id: string, ageBands: Workout["ageBands"], intensity: Workout["intensity"] = "gentle", category: Workout["category"] = "dance"): Workout => ({
  id, title: id, description: "", instructorId: "i", creatorId: "c", category, durationSec: 300, intensity, equipment: ["none"], ageBands, captions: true,
  state: "published", publishedAt: "2026-10-01",
  rights: { creatorLicenceSigned: true, musicCleared: true, safetyReviewed: true, guardianConsent: "not-applicable", territories: ["AU"] },
  thumbnail: { from: "#000", to: "#111", emoji: "x" },
});
const leo: Profile = { id: "leo", householdId: "h", nickname: "Leo", avatar: { emoji: "x", colour: "#000" }, ageBand: "under-6", interests: ["dance"], pinProtected: false };

describe("personalised home", () => {
  it("never shows a child anything outside their age band or intensity limit", () => {
    const list = [mk("kids", ["under-6"]), mk("teen", ["13-15"]), mk("hard", ["under-6"], "energetic")];
    const rows = buildHomeRows({ profile: { ...leo, maxIntensity: "moderate" }, workouts: list, instructors: [], progress: {}, favourites: [], completed: [] });
    const ids = new Set(rows.flatMap((r) => r.workouts.map((w) => w.id)));
    expect([...ids]).toEqual(["kids"]);
  });
  it("hides empty rows and shows Continue Watching only for part-watched workouts", () => {
    const rows = buildHomeRows({ profile: leo, workouts: [mk("a", ["under-6"]), mk("b", ["under-6"])], instructors: [], progress: { a: 120, b: 299 }, favourites: [], completed: [] });
    expect(rows.find((r) => r.id === "continue")!.workouts.map((w) => w.id)).toEqual(["a"]);
    expect(rows.every((r) => r.workouts.length > 0)).toBe(true);
  });
  it("counts a streak of consecutive days", () => {
    expect(currentStreak(["2026-10-24", "2026-10-25", "2026-10-26"], "2026-10-26")).toBe(3);
    expect(currentStreak(["2026-10-24"], "2026-10-26")).toBe(0);
  });
});
