/// <reference types="node" />
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// The Supabase scoring job runs on Deno and can't import this package, so it
// carries a copy of the rules. This test fails if the two ever drift apart.
describe("server copy of the playback rules", () => {
  it("supabase/functions/_shared/playback.ts is identical to src/playback.ts", () => {
    const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");
    expect(read("../../../supabase/functions/_shared/playback.ts")).toBe(read("../src/playback.ts"));
  });
});
