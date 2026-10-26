import { z } from "zod";

/**
 * Environment validation. Each integration runs in "mock" mode until its
 * real keys are present, so the app always works locally without accounts.
 *
 * SECRETS: only ever put real values in `.env.local` (never committed) or in
 * your hosting provider's secret settings. Never paste them into chat.
 */
const optional = z.string().trim().min(1).optional();

export const serverEnvSchema = z.object({
  APP_ENV: z.enum(["local", "test", "staging", "production"]).default("local"),
  // Supabase — Phase 1
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: optional,
  SUPABASE_SERVICE_ROLE_KEY: optional,
  // Mux — Phase 2
  MUX_TOKEN_ID: optional,
  MUX_TOKEN_SECRET: optional,
  MUX_SIGNING_KEY_ID: optional,
  MUX_SIGNING_PRIVATE_KEY: optional,
  MUX_WEBHOOK_SECRET: optional,
  // Stripe — Phase 3 (TEST MODE keys start with sk_test_ / pk_test_)
  STRIPE_SECRET_KEY: optional,
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: optional,
  STRIPE_WEBHOOK_SECRET: optional,
  // Security
  PIN_PEPPER: optional,
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

export type IntegrationMode = "mock" | "test" | "live";

export interface IntegrationStatus {
  supabase: IntegrationMode;
  mux: IntegrationMode;
  stripe: IntegrationMode;
  problems: string[];
}

export function integrationStatus(env: ServerEnv): IntegrationStatus {
  const problems: string[] = [];
  const supabase: IntegrationMode = env.NEXT_PUBLIC_SUPABASE_URL && env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? "test" : "mock";
  const mux: IntegrationMode = env.MUX_TOKEN_ID && env.MUX_TOKEN_SECRET ? "test" : "mock";
  let stripe: IntegrationMode = "mock";
  if (env.STRIPE_SECRET_KEY) {
    stripe = env.STRIPE_SECRET_KEY.startsWith("sk_live_") || env.STRIPE_SECRET_KEY.startsWith("rk_live_") ? "live" : "test";
    if (stripe === "live" && env.APP_ENV !== "production") {
      problems.push("A LIVE Stripe key is configured outside production. Use sk_test_ keys until launch is approved.");
    }
    if (!env.STRIPE_WEBHOOK_SECRET) problems.push("STRIPE_WEBHOOK_SECRET missing: subscriptions cannot be activated safely.");
  }
  if (supabase !== "mock" && !env.SUPABASE_SERVICE_ROLE_KEY) {
    problems.push("SUPABASE_SERVICE_ROLE_KEY missing: server jobs (webhooks, royalty runs) cannot run.");
  }
  if (mux !== "mock" && (!env.MUX_SIGNING_KEY_ID || !env.MUX_SIGNING_PRIVATE_KEY)) {
    problems.push("Mux signing key missing: videos cannot be played with signed URLs.");
  }
  if (env.APP_ENV === "production" && !env.PIN_PEPPER) problems.push("PIN_PEPPER must be set in production.");
  return { supabase, mux, stripe, problems };
}

export function loadServerEnv(source: Record<string, string | undefined> = process.env): ServerEnv {
  const parsed = serverEnvSchema.safeParse(source);
  if (!parsed.success) {
    const lines = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`);
    throw new Error(`Invalid environment configuration:\n${lines.join("\n")}`);
  }
  return parsed.data;
}
