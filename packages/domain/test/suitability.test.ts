import { describe, expect, it } from "vitest";
import { suitabilityLabel } from "../src/catalog";

describe("suitabilityLabel", () => {
  it("all bands → all ages", () => expect(suitabilityLabel(["under-6", "6-8", "9-12", "13-15", "16-17", "adult"])).toBe("Suitable for all ages"));
  it("a run of child bands → age range", () => expect(suitabilityLabel(["6-8", "9-12"])).toBe("Suitable for ages 6–12"));
  it("from a band to adult → and up", () => expect(suitabilityLabel(["9-12", "13-15", "16-17", "adult"])).toBe("Suitable for ages 9 and up"));
  it("youngest bands → under N", () => expect(suitabilityLabel(["under-6", "6-8"])).toBe("Suitable for under 9s"));
  it("adults only", () => expect(suitabilityLabel(["adult"])).toBe("Suitable for adults"));
  it("gaps → list", () => expect(suitabilityLabel(["under-6", "13-15"])).toBe("Suitable for: Under 6, 13–15"));
});
