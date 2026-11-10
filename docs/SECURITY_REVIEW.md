# Security review — 9 Nov 2026 (pre-launch, Phase 6)

This review was done in-house, by the build agent. A short independent penetration test before launch is still
recommended (see LAUNCH_CHECKLIST).

## Summary
| Area | Result |
|---|---|
| Secrets in Git (whole history) | ✅ None found. Scanned for Stripe, Supabase, webhook, JWT, private-key and email-service patterns, and for the test password. Only public values are committed (Supabase URL and publishable key). |
| Data access rules (Row-Level Security) | ✅ On every table. 32 security checks, 19 journey checks and 38 finance checks pass on the test system **and** on a database rebuilt from scratch. |
| Server functions | ✅ Webhooks verify signatures (Stripe, Mux). Scheduled calls use single-use nonces. Staff functions check roles. Live Stripe keys are refused outside production. |
| Money | ✅ Ledger, statements and audit log can't be edited. Payouts need two different people (maker/checker), a bank file and an exact-amount confirmation. Bank-detail changes are audited (number masked) and trigger a warning before payment. |
| Children | ✅ Child profiles carry no personal details (nickname + age band). Adult profiles and billing sit behind a parent PIN, which locks after 5 wrong tries. Guardian consent is required to publish a minor instructor. |
| Website headers | 🔧 **Fixed:** added a content security policy (only our site, Supabase, Mux and Stripe), click-jacking protection, no-sniff, a referrer policy, a permissions policy (camera, microphone and location off), and HTTPS enforcement (HSTS). Key pages including the video player load with no violations. |
| Error reports | 🔧 **Fixed:** anonymous crash reports strip emails and tokens, are limited to 60 a minute, and from this review are capped at 500 new problem types a day. |
| Closing an account | 🔴→✅ **Found and fixed (live 10 Nov 2026):** closing an account (1) did **not cancel the Stripe subscription**, so a family could keep being charged after deleting their account, and (2) **deleted their invoices, refunds, viewing totals and trial claims**. That lost 7-year tax records, changed creator royalty inputs and allowed a repeat free trial. Now a server function cancels the subscription first, then deletes the login and all personal data, keeping anonymous financial and viewing records. 8 new automatic checks pass; end-to-end test on a test family: subscription cancelled in Stripe, login and profiles gone, invoices and trial record kept. |
| Scheduled jobs | 🔧 **Fixed:** the jobs no longer contain the development address, so a production copy can't call the test system. |
| Dependencies | ⚠️ 16 advisories (7 high), **all inside Expo's developer tools** (`@expo/cli`: node-forge, zod, glob, minimatch, deepmerge), which run on build machines and are not shipped in the app or website. Accepted; they clear when Expo updates its CLI. Re-check monthly with `pnpm audit --prod`. |
| Supabase advisor | ⚠️ Known and accepted: some signed-in functions are `SECURITY DEFINER` by design, and each checks the caller's role inside. 4 internal tables have row security on with no policies, which means server-only (intended). `pg_net` is in the public schema (Supabase default). |

## Needs a decision or action from you
1. **Make the GitHub repository private** before launch (it's public now). Nothing secret is in it, but it shows how
   the system works, the test account emails, and (once backups run) the existence of the encrypted backup files.
   Vercel and Expo keep working. Settings → General → Danger zone → Change visibility.
2. **Leaked-password protection** (blocks passwords known from data breaches) and **multi-factor sign-in for
   staff**. Turn both on in the production Supabase project (Auth settings). Leaked-password checks may need the
   paid plan.
3. **Staff accounts:** use separate, named accounts with strong passwords. Remove the `e2e-*` test accounts from
   production (they only ever exist in the test system).
4. **Independent penetration test** (optional but recommended before taking real money at scale).

## Re-run this review
Before launch, after any big change, and every 3 months:
- `select tests.run_rls_checks(); select tests.run_app_journey(); select tests.run_finance_checks();`
- Supabase → Advisors → Security
- `pnpm audit --prod`
- `git log --all -p | grep -E "sk_(live|test)_|whsec_|sb_secret_|PRIVATE KEY"` (should print nothing)
