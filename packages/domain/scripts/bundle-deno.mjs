// Packages the business rules into one ES module the Supabase Edge Functions (Deno) can import.
// Usage: node scripts/bundle-deno.mjs [--check]
//   --check  fails if supabase/functions/_shared/domain.js is out of date (used by the tests and CI).
import { build } from "esbuild";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const out = fileURLToPath(new URL("../../../supabase/functions/_shared/domain.js", import.meta.url));
const r = await build({
  entryPoints: [fileURLToPath(new URL("../src/index.ts", import.meta.url))],
  bundle: true,
  format: "esm",
  platform: "neutral",
  target: "es2022",
  write: false,
  legalComments: "none",
  banner: { js: "// GENERATED from packages/domain/src by scripts/bundle-deno.mjs — do not edit by hand.\n// deno-lint-ignore-file" },
});
const code = r.outputFiles[0].text;
if (process.argv.includes("--check")) {
  const current = existsSync(out) ? readFileSync(out, "utf8") : "";
  if (current !== code) {
    console.error("supabase/functions/_shared/domain.js is out of date — run: pnpm --filter @app/domain bundle:deno");
    process.exit(1);
  }
  console.log("domain bundle up to date");
} else {
  writeFileSync(out, code);
  console.log(`wrote ${out} (${code.length} bytes)`);
}
