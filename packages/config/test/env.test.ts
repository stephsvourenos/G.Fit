import { describe, expect, it } from "vitest";
import { integrationStatus, loadServerEnv } from "../src/env";

describe("environment validation", () => {
  it("runs entirely in mock mode with no keys", () => {
    const s = integrationStatus(loadServerEnv({}));
    expect(s).toEqual({ supabase: "mock", mux: "mock", stripe: "mock", problems: [] });
  });
  it("refuses a live Stripe key outside production", () => {
    const s = integrationStatus(loadServerEnv({ APP_ENV: "local", STRIPE_SECRET_KEY: "sk_live_abc", STRIPE_WEBHOOK_SECRET: "whsec_x" }));
    expect(s.stripe).toBe("live");
    expect(s.problems[0]).toMatch(/LIVE Stripe key/);
  });
  it("flags a missing webhook secret", () => {
    const s = integrationStatus(loadServerEnv({ STRIPE_SECRET_KEY: "sk_test_abc" }));
    expect(s.problems.join()).toMatch(/WEBHOOK_SECRET/);
  });
});
