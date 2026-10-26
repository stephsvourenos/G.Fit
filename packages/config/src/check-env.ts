import { integrationStatus, loadServerEnv } from "./env.ts";

const env = loadServerEnv();
const s = integrationStatus(env);
console.log(`Environment: ${env.APP_ENV}`);
console.log(`  Supabase: ${s.supabase}`);
console.log(`  Mux:      ${s.mux}`);
console.log(`  Stripe:   ${s.stripe}`);
if (s.problems.length) {
  console.log("\nProblems:");
  for (const p of s.problems) console.log(`  ✗ ${p}`);
  process.exit(1);
}
console.log("\nOK — anything shown as 'mock' is simulated and NOT live.");
