# Rebuild and restore

Two different jobs:

1. **Rebuild the system from scratch.** You need this for a new environment, or if a project is lost entirely. The
   database structure, rules and tests all come from `supabase/migrations/` in order.
2. **Restore the data** from a backup into a database rebuilt that way.

## 1. Rebuild (rehearsed 9 Nov 2026)

Rehearsed on a temporary free project (`gfit-restore-drill`, now paused):
- All 26 migration files applied, in order, to an empty database with no manual steps.
- Every test suite passed: security 32/32, app journey 19/19, finance 38/38.
- Two problems found and fixed during the rehearsal:
  - Scheduled jobs had the development address built in. They now read it from `private.app_config`.
  - The app-journey test relied on sample workouts that had been loaded by hand. It now brings its own.

Steps for a new project (see also PRODUCTION_SETUP.md):
1. Create the Supabase project (Sydney region).
2. Apply every file in `supabase/migrations/` in name order, with `supabase db push` or the Supabase SQL editor.
3. Tell the scheduled jobs this project's address:
   ```sql
   insert into private.app_config values ('functions_url', 'https://<project-ref>.supabase.co/functions/v1')
   on conflict (key) do update set value = excluded.value, updated_at = now();
   ```
4. Deploy the functions. Point the GitHub deploy workflow at the new project ref, or run
   `supabase functions deploy --project-ref <ref>`.
5. Set the function secrets: Stripe keys, Mux keys, `APP_ENV`, and the email settings.
6. Run `select tests.run_rls_checks(); select tests.run_app_journey(); select tests.run_finance_checks();`.
   All three must say "ROLLBACK OK — ALL … PASSED".

## 2. Restore data from a nightly backup
Backups come from the **Database backup** GitHub workflow (nightly). Each one is an encrypted file kept for 14 days.

1. GitHub → Actions → Database backup → choose a run → download the artifact.
2. Decrypt it with the passphrase from your password manager:
   `gpg --decrypt gfit-db-<stamp>.dump.gpg > db.dump`
3. Check the fingerprint first: `sha256sum -c gfit-db-<stamp>.sha256` (run it on the .gpg file before decrypting).
4. Restore it into a project rebuilt as in section 1. Restoring onto live data is never done.
   `pg_restore --no-owner --no-privileges --data-only --disable-triggers -d "<new project connection string>" db.dump`
   - `--disable-triggers` is needed because the ledger, statements and audit log refuse edits by design.
5. Run the three test suites, then spot-check a family, a creator statement and a payout batch.
6. Only then point the website and apps at the restored project.

**Production:** also turn on Supabase's own daily backups and point-in-time recovery (Pro plan). Our nightly backup
is a second copy held outside Supabase.

**Rehearse a data restore every 3 months:** restore the latest backup into a temporary project, run the tests, then
pause or delete the project. Record the date in BUILD_STATUS.
