# BUILD_STATUS

_Last updated: 7 Nov 2026 — Phase 4 (creator economics on real data) built and tested_

## Done (Phase 0)
- Monorepo (pnpm workspaces): `apps/web` (Next.js 16), `apps/mobile` (Expo SDK 58), `packages/domain`,
  `packages/mock-data`, `packages/config`
- Domain engine + **50 automated tests** (all passing): money maths, playback gate, qualified-playback rules,
  annual-plan recognition, household-balanced royalty pool, referral attribution & paid-month terms (incl. 120-month
  simulation), refund reversals, append-only ledger, payout due dates, carry-forward, maker/checker, no double
  payout, webhook idempotency & out-of-order handling, env validation, demo month-end simulation
- Web prototype (member app, website, admin, creator portal) — builds cleanly and passes lint; static export works
- Hosted preview: not yet — the artifact host can't serve a multi-page Next.js export; a Vercel preview URL comes in Phase 1 (with GitHub)
- Mobile prototype — type-checks and bundles; renders correctly in a web build
- Browser checks run headlessly: full play earns 12/12 min; drag-to-end is flagged `seek-detected` and earns 0;
  wrong PIN rejected, correct PIN opens adult profile; Publish button disabled for a workout with music rights not
  cleared; no console errors on key pages
- Planning docs: `docs/BRIEF_REVIEW.md`, `docs/ARCHITECTURE.md`, `docs/IMPLEMENTATION_PLAN.md`,
  `ACCOUNT_SETUP.md`, `DECISIONS_REQUIRED.md`, `docs/APP_STORE_BILLING_DECISION.md` (open gate)

## Acceptance tests (brief §12) — status
| # | Test | Status |
|---|---|---|
| 1 | Sign-up → pay → webhook → 3 profiles → PIN | Domain parts tested (PIN gate, webhook); end-to-end needs Supabase + Stripe (Ph 1, 3) |
| 2 | Grandfathered A$9.99 / A$14.99 / A$4.99×3 | ✅ unit-tested (Stripe-equivalent model); live Stripe in Ph 3 |
| 3 | Referral vs royalty go to different creators | ✅ unit-tested |
| 4 | Household-balanced pool + refunds; skip-to-end earns nothing | ✅ unit-tested + browser-checked |
| 5 | 3 contracts, pause, cancelled, annual, refund — cent-exact & reproducible | ✅ unit-tested (fingerprint) |
| 6 | Duplicate & out-of-order webhooks | ✅ unit-tested; live Stripe in Ph 3 |
| 7 | Minimum payout carry-forward, evidence, no double payout | ✅ unit-tested |
| 8 | Role permissions & creator data isolation | Needs Supabase RLS (Ph 1) |
| 9 | Signed video denied on expiry / age mismatch | ✅ decision logic tested; Mux signing in Ph 2 |
| 10 | Full UX in mock mode, then sandbox | ✅ mock mode; sandbox after Ph 1–3 |

## Commands
```bash
pnpm install          # once
pnpm test             # all automated tests
pnpm dev              # website + member app + admin + creator portal → http://localhost:3000
pnpm dev:mobile       # mobile app (scan the QR code with the Expo Go app)
pnpm check:env        # shows which integrations are mock / test / live
pnpm --filter web build:preview   # static preview export to apps/web/out
```

## Phase 1 progress (3 Nov 2026)
- Supabase project **gfit-dev-sydney** (Sydney region): full schema applied, every table has Row-Level Security
- Sample catalogue loaded (6 creators, 6 instructors, 24 workouts)
- **Database privacy test suite: 32/32 checks pass** (`select tests.run_rls_checks();`), covering household isolation,
  creator isolation, staff can't read child profiles, PIN hashing + lockout after 5 tries, 6-profile cap, publish gate,
  append-only ledger, profile deletion removes activity
- Supabase security advisor: no warnings needing action. Its notes are intentional: PIN and billing tables have no
  client access at all, and the PIN/export functions are the deliberate, checked way in
- **Real accounts in the web app (3 Nov 2026):** sign up with email confirmation, sign in, forgot/reset password,
  first-run parent PIN setup, profiles, watch progress, favourites, completions, data export, delete household data,
  sign out. Uses only the public URL + publishable key; the database's privacy rules protect everything.
- **Live browser test against the real database: all 17 steps pass** (`e2e/live-journey.js`): sign-in redirect,
  wrong password, PIN setup (weak PIN refused), adding adult + child profiles, child sees only age-appropriate
  workouts, videos locked until membership, favourite saved, session survives reload, adult profile needs PIN,
  wrong PIN refused by the server, export, sign out, delete household data
- Mock mode still works when no Supabase keys are configured
- Waiting on approval: `supabase/migrations/20261103021500_app_journey_test.sql` (database-side journey test)
- **Private preview live (3 Nov 2026):** https://g-fit-liard.vercel.app (Vercel Authentication on all deployments;
  auto-deploys from GitHub `main`; Supabase email links point here)
- **Phase 1 completion (3 Nov 2026):**
  - Close account: parents can permanently close their account (login + all family data) — `delete_my_account()`
  - Admin login: `/admin` requires a staff login; the owner's account is the admin. Content approval and the audit
    log run on the real database; other admin pages are clearly labelled as sample figures until Phases 3–5
  - Every change to a workout's status or rights checklist is recorded automatically in the audit log
  - Creator login: `/creator` shows a creator (or their guardian) only their own record, workouts and earnings;
    admins see the sample preview
  - Branded account emails ready in `supabase/email-templates/` (to paste into Supabase)
  - Tests: privacy suite 32/32, database journey 19/19, family browser journey 17/17, admin/creator browser
    checks 14/14 (`e2e/staff-journey.js`), unit tests 50/50
  - Test logins on the dev project: e2e-parent@, e2e-admin@ (content editor), e2e-creator@ (guardian of sample
    creator "Junior Coach Pip"), all @gfit.test
- Before launch (noted for Phase 6): turn on Supabase leaked-password protection (paid plan feature), add a
  transactional email provider, admin screens to invite staff/creator logins
- Phase 1 complete. Branded emails wait for a custom email provider (Supabase requires custom SMTP to edit templates).

## Phase 2 progress (5 Nov 2026) — video
- Mux account (free plan), environment `gfit-dev`; secrets stored only in Supabase Edge Function secrets
- Supabase Edge Functions: `video-admin` (staff-only direct upload / sample clip / status), `playback-token`
  (server checks profile ownership, membership, age band, intensity limit and — for adult profiles — a parent
  PIN entered in the last 10 minutes, then issues expiring signed links), `mux-webhook` (signature-checked,
  repeat deliveries ignored, re-reads Mux before saving), `mux-health` (staff diagnostics)
- Videos are uploaded as *signed-only*: the stream refuses to play without a valid link (tested: 200 with, 403 without)
- Admin content page: upload/replace a video file (browser → Mux directly, with progress), sample test clip,
  live status; member app plays real video with Mux Player and falls back to the simulator for workouts
  without video
- Admin-only `admin_grant_membership()` gives test/comp memberships (`manual_grant`, never counted as paid)
- Tests: 7 server permission checks, `e2e/video-journey.js` 9/9 (upload → processing → ready → child plays →
  stream 200 → adult needs server-side PIN → child refused teen workout)
- **Mux webhook connected (5 Nov 2026):** uploads turn "ready" on their own; forged signatures are refused (401)
- **Qualified minutes on the server (5 Nov 2026):**
  - Pressing play opens a server-side *playback session*; the player sends a heartbeat every 12 seconds (5–12 s on
    very short clips) and on play / pause / end. The server stamps the arrival time itself, accepts heartbeats only
    for its own sessions and the caller's own profiles, ignores replays and spam, and ends sessions after 12 hours
  - A scheduled job every 15 minutes (`aggregate-playback`, pg_cron) scores sessions that have been quiet for 10
    minutes with the same rules as the app (a test keeps the server copy identical), applies the repeat and monthly
    caps, and writes `qualified_views` (royalty input) and `playback_anomalies` (fraud queue). Admin/finance can run
    it now from the Playback page. The job authenticates with single-use codes, so no secret is stored anywhere
  - Raw heartbeats are deleted automatically after 90 days (nightly job)
  - Admin **Playback & fraud alerts** page now shows real sessions, coverage, credited minutes and flags
  - Rule fix found in live testing: the stretch just before a pause or the end now counts (it used to be dropped);
    hidden/background play still never counts. Heartbeats are now sent one at a time so they arrive in order
  - Verified live: honest 12-second watch → 12 s credited, no flags; skip-ahead → 0 and flagged; replayed heartbeat
    ignored; same workout twice in a day → second not credited ("repeat same day"); forged/anonymous job calls refused;
    families can't read sessions or minutes; a creator sees only their own workouts' totals
- **Phone app (5 Nov 2026):** real household sign-in (stays signed in), real profiles, parent PIN checked by the
  server, signed Mux video in the phone's native player with server heartbeats; AirPlay button on iPhone. Leaving the
  app counts as "not watching". Still sign-in only — no purchase screens. Profiles/PIN are created on the website
- Tests: unit 55/55 (incl. server-copy check and casting rules), family journey 17/17, staff 14/14, video journey 8/8 playback checks (now incl.
  session opened + heartbeats accepted), phone-app journey 8/8 (`e2e/mobile-journey.js`, web build: sign-in, wrong
  password, real profiles, wrong/right PIN, signed playback granted, teen workout refused)
- **TV casting confirmed (7 Nov 2026):** you AirPlayed from an iPhone to a Samsung TV and it played. The server data
  showed a locked/away phone made casting look like "not watching", so playback rules **v2** now count video playing on
  a TV (AirPlay in Safari and the iPhone app, Chromecast in Chrome) even with the phone locked, accept longer heartbeat
  gaps while casting (up to 15 min) and still apply the real-time / skip-ahead checks. Each heartbeat records `casting`,
  and sessions are labelled "cast to tv" on the admin Playback page. Verified live: cast + locked phone → fully
  credited; hidden and not casting → 0
- **Fix (7 Nov 2026):** admin accounts saw "membership not active" on their own family (staff can read every family's
  membership; the lookup now filters to the signed-in family)
- Still to do in Phase 2: a play-through on a real phone in the app (needs a free test build)

## Blockers
- None. Phone testing on a real device needs either the free Expo Go app + my dev server, or a free Expo (EAS) test
  build — I'll set that up when you're ready (ACCOUNT_SETUP.md §8).

## Next
1. ✅ Code is on GitHub: `stephsvourenos/G.Fit` (27 Oct 2026).
2. Phase 1: Supabase project (I'll walk you through it), migrations, RLS policies + tests, real sign-in.

## Phase 3 — Website subscriptions (Stripe TEST MODE) — 7 Nov 2026
- Stripe account **G.Fit sandbox** (test mode). Product "Family membership": **A$14.99/month** and **A$149.99/year**,
  GST-inclusive, found by lookup keys `gfit_family_monthly_aud_v1` / `gfit_family_annual_aud_v1` (a price change =
  new Price + new key, so existing members keep their price). Customer Portal configured: update card, invoices,
  switch monthly↔annual (prorated), cancel at period end with a reason
- Secrets only in Supabase: `STRIPE_SECRET_KEY` (sk_test), `STRIPE_WEBHOOK_SECRET`. Server refuses a live key or live
  events unless `APP_ENV=production`
- Edge Functions: `billing-checkout` (hosted Stripe Checkout, allow-listed return addresses, referral code),
  `billing-portal`, `stripe-webhook` (signature check, each event once, always re-reads Stripe's current state so
  late/out-of-order events can't corrupt anything), `billing-reconcile` (nightly at 02:41 + "Check with Stripe now"
  on the admin page; repairs anything a missed webhook left behind)
- Database: `billing_customers`, `billing_invoices` (amount, GST = 1/11, plan, period — the input to royalties),
  `billing_refunds`, `referral_attributions` (first paid invoice decides the creator, once), `entitlements.cancel_at_period_end`.
  Families read only their own; only the server writes
- Website: account page **Join** (monthly/annual, optional creator code, prefilled from `?ref=CODE` links for 30 days),
  **Manage membership** (Stripe portal), clear past-due and "cancelled — access until…" messages. Admin
  **Subscribers & entitlements** shows real data
- Tested live against Stripe test mode (real webhooks): join with referral → active + invoice A$14.99 (GST A$1.36) +
  referral to PIP; upgrade to annual → A$135.00 prorated; cancel at period end → access kept, flag shown; resume;
  refund A$135.00 recorded; cancel immediately → access ends now; declined card → refused; card failing on charge →
  incomplete, no access; failed payment → past due with 3 days' grace; forged webhook → 401; nightly check repaired
  earlier records; families can't read others' billing, insert invoices, grant themselves access or run test tools
- Bugs found and fixed in testing: (1) past-due grace was counted from the end of the *new* period (up to a year of free
  access) — now 3 days from the failed payment; (2) immediate cancellation kept access to period end; (3) upgrade
  invoices were labelled with the old plan; (4) test-grant tool silently did nothing after a cancelled subscription
- Test-only tool (admin, test key, non-production only): `billing-reconcile` `{test:{…}}` drives Stripe test cards
- Not yet: Stripe Tax (paid add-on — decide with your accountant before launch); trial/promo codes (Checkout accepts
  promotion codes once you create them); phone app stays sign-in only

### Free trial (7 Nov 2026) — your decision: trial, kept compliant
- **7 days free, card required, one per family and per card** (Stripe card fingerprint — never the card number). Checkout
  is cards only (incl. Apple Pay / Google Pay) so the per-card rule can't be bypassed via buy-now-pay-later
- **Disclosure:** account page and Stripe's checkout both state "Free for 7 days. Then A$14.99 per month (GST included),
  first charged on <date>… cancel before <date> and you won't be charged. One free trial per family."
- **Cancel during trial:** online via Manage membership; access continues to trial end; no charge
- **Reminder:** queued in `member_notices` once a trial is within 3 days of ending (from Stripe's `trial_will_end`
  event, any subscription update, and the nightly check — never twice). **Sending the email needs the email service
  (Phase 6) and must be live before launch** — the law's reminder rules start 1 July 2027
- **Royalties:** each viewing records whether the family was paying, trialling or on a test grant; Phase 4 counts paid only
- Tested live: eligible/not-eligible check; disclosure on Stripe's page; trial start (A$0); same card on another family
  → trial refused and A$14.99 charged; cancel during trial; reminder queued with date/price; trial viewing labelled;
  trial end → first annual charge A$149.99 → active
- Fixed during this work: "Manage membership" opened another family's billing for admin accounts; Stripe's default
  "change quantity" switched off in the portal

## Phase 4 — Creator economics on real data (7 Nov 2026)
- **Automatic deploys:** GitHub Actions deploys every Supabase function from the repository on push
  (`.github/workflows/deploy-functions.yml`, secret `SUPABASE_ACCESS_TOKEN`, project-scoped token). Deployed code now
  always equals the repository
- **Shared rules on the server:** `packages/domain` is bundled to `supabase/functions/_shared/domain.js`; a unit test
  fails if the bundle is stale
- **Month-end** (`month-end` function): *preview* (re-runnable; also automatic on the 1st–5th), *finalise* (one
  transaction: run + ledger entries + statements; permanent; months in order; only after the month ends), *verify*
  (re-runs and compares the fingerprint). Only **paid** viewing counts (trials and test grants excluded). Net receipts =
  paid − GST − Stripe fee (fee now recorded per invoice)
- **Contracts:** versioned, append-only; admin "New version" form (licence end, pause, referral %/months, pause new
  referrals, minimum payout). Payee/ABN/GST fields on creators (guardian payee for under-18s)
- **Referrals:** terms frozen at attribution; refused for self-referral or creators not accepting referrals; link visits
  counted (anonymous, once per browser per day); funnel on admin Referrals and in the creator portal
- **Payouts:** due-today list (final months only; below minimum → carried forward), batch creation, maker/checker approval,
  export, confirmation that requires a bank reference and the exact total, cancel/fail releases entries. The database
  makes paying any entry twice impossible. (Bank file = Phase 5)
- **Creator portal:** statements, printable statement (Print → Save as PDF), referral link with copy, funnel, minutes
  watched by paying families, earnings detail
- **Operator guide:** `docs/MONTHLY_CLOSE.md`
- **Acceptance tests (DoD) — all pass against the database:**
  - **7 (payouts)** — `select tests.run_finance_checks()` → 28/28 (in a rolled-back transaction): carry-forward below
    minimum, no double payout, amount must match entries, maker ≠ checker, confirm needs reference + exact total, paid
    batch can't be cancelled, cancelled entries re-payable, final runs/ledger/statements immutable, months in order,
    creators see only their own, families see nothing
  - **3, 4, 5** — real November test data (2 paying test families, real Stripe test invoices incl. an annual plan and a
    refund, real paid viewing, 6 contracts incl. paused (Kit) and ended (Rosa), guardian-managed (Bee), Pip referral
    10% × 120 months): `scripts/verify-month-end.py 2026-11` independently recomputes from raw tables → **ALL MATCH**
    to the cent (pool A$28.68: Ava 14.33, Bee 9.92, Theo 4.43; Pip referral 5.72; refund reversals −3.92); preview
    re-runs give the same fingerprint
  - October 2026 finalised for real (empty month): verify → reproduces; second finalise refused
  - Security suites still pass: RLS 32/32, journey 19/19
- **Still open:** acceptance test 2 (founder A$9.99 grandfathered, A$4.99 × 3 promo) needs those prices/coupons created
  in Stripe — the price-versioning mechanism exists; to do with your pricing decision. GST/withholding treatment of
  creator payments awaits your accountant
