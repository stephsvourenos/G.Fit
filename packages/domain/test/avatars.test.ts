import { describe, expect, it } from "vitest";
import { AVATARS, AVATAR_GROUPS, avatarById, stillSvg } from "../src/avatars";

describe("profile picture library", () => {
  it("has plenty of choice in every group", () => {
    for (const g of AVATAR_GROUPS) expect(AVATARS.filter((a) => a.group === g).length).toBeGreaterThanOrEqual(6);
    expect(AVATARS.length).toBeGreaterThanOrEqual(50);
  });
  it("ids are unique, start with @ and fit the 8-character profile field", () => {
    const ids = AVATARS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) {
      expect(id.startsWith("@")).toBe(true);
      expect([...id].length).toBeLessThanOrEqual(8);
    }
  });
  it("every picture is a self-contained square SVG with no ids, scripts or links", () => {
    for (const a of AVATARS) {
      expect(a.svg.startsWith("<svg")).toBe(true);
      expect(a.svg.endsWith("</svg>")).toBe(true);
      expect(a.svg).toContain('viewBox="0 0 100 100"');
      expect(a.svg).not.toMatch(/<script|href=|\bid=|on\w+=/i);
      expect(a.name.length).toBeGreaterThan(2);
    }
  });
  it("animated pictures move, and their still versions don't", () => {
    for (const a of AVATARS.filter((x) => x.group === "animated")) {
      expect(a.svg).toMatch(/<animate/);
      const s = stillSvg(a.svg);
      expect(s).not.toMatch(/<animate/);
      expect(s.endsWith("</svg>")).toBe(true);
    }
  });
  it("emoji avatars aren't mistaken for library pictures", () => {
    expect(avatarById("🦊")).toBeUndefined();
    expect(avatarById("@nope")).toBeUndefined();
    expect(avatarById("@roo")?.name).toBe("Kangaroo boxer");
  });
});
