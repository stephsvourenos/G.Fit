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

describe("server bundle of the business rules", () => {
  it("supabase/functions/_shared/domain.js matches packages/domain/src", async () => {
    const { execFileSync } = await import("node:child_process");
    const script = fileURLToPath(new URL("../scripts/bundle-deno.mjs", import.meta.url));
    expect(() => execFileSync(process.execPath, [script, "--check"], { stdio: "pipe" })).not.toThrow();
  });
});
