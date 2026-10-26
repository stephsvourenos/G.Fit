# Phased implementation plan

Each phase ends with: tests passing, BUILD_STATUS.md updated, an account-setup update, and a short demo of what
changed. "Definition of done" (DoD) items are the sign-off checklist.

## Phase 0 — Foundations & clickable prototype ✅ (this delivery)
Accounts needed: none.
- [x] Brief review with risks and fixes (`docs/BRIEF_REVIEW.md`)
- [x] Architecture, plan, ACCOUNT_SETUP, DECISIONS_REQUIRED, BUILD_STATUS
- [x] pnpm monorepo: `apps/web`, `apps/mobile`, `packages/domain`, `packages/mock-data`, `packages/config`
- [x] Domain engine with tests: money, entitlement/playback gate, qualified playback, net receipts & annual
      recognition, household-balanced royalty pool, referrals, append-only ledger, payouts, statements, webhook
      idempotency
- [x] Web prototype: landing, referral landing, join + simulated checkout, profile picker + PIN, personalised home,
      search & filters, workout detail, simulated player with live qualified-minute tracking, progress & badges,
      profile management, family account
- [x] Admin prototype: overview, content workflow with publish gate, creators & contracts, pricing, subscribers,
      referrals, playback alerts, royalty runs, ledger, payout batches, audit, configuration
- [x] Creator portal prototype (aggregated data only)
- [x] Mobile prototype (sign-in only): profile picker + PIN, home rows, workout detail, player with heartbeats
- [x] `.env.example`, `.gitignore`, environment validation that refuses live Stripe keys outside production

**DoD:** all tests green; web builds; mobile type-checks and bundles; prototype viewable via a link. ✅

## Phase 1 — Accounts, data & permissions (Supabase)
Accounts: **GitHub** (code home, free) then **Supabase** (free tier is enough).
- Database migrations for households, profiles, catalogue, content workflow, contracts, ledger, audit log
- Row-Level Security policies + automated tests that prove: a child profile can't read adult data; a creator can't
  read another creator's rows or any household data; non-admins can't write content
- Household sign-up with email verification; profile CRUD; parent PIN stored as salted hash, rate-limited, reset by
  email; switching to an adult profile requires PIN
- Data export + account/profile deletion flows
- Seed script that loads the mock catalogue into the dev database
- Privacy impact assessment draft (minimal child data, retention schedule)

**DoD:** acceptance tests 1 (minus payment) and 8 pass against a real Supabase dev project; the web app runs on
real accounts; mock mode still works with no keys.

## Phase 2 — Video (Mux)
Accounts: **Mux** (free plan to start).
- Admin direct upload to Mux (browser → Mux, signed one-time URL); webhook updates asset status
- Signed playback tokens minted only after `decidePlayback` passes; short expiry
- Real player on web and mobile (Mux Player / native player), **AirPlay + Chromecast**, captions
- Heartbeat endpoint with server-side validation feeding `evaluateSessions`; nightly aggregation; 90-day purge
- Playback & fraud alerts screen on real data

**DoD:** acceptance test 9 and the playback scenarios pass end-to-end with test assets; casting works on a real
TV; no unsigned playback possible.

## Phase 3 — Billing (Stripe, TEST MODE ONLY)
Accounts: **Stripe** (test mode; no live charges).
- Products/Prices (monthly, annual, founder), promotion codes, GST settings, hosted Checkout, Customer Portal
- Signed webhook handler (idempotent, fetch-current-object), reconciliation job, invoice/refund snapshots
- Referral capture carried through Checkout metadata → attribution on first paid invoice
- Subscribers & entitlements admin on real Stripe test data; price changes via new Prices (grandfathering)

**DoD:** acceptance tests 1, 2 and 6 pass end-to-end with Stripe test cards; replayed and out-of-order webhooks
are proven safe.

## Phase 4 — Creator economics on real data
Accounts: none new.
- Versioned contracts UI (create new version, effective dates, guardian-managed payees)
- Scheduled month-end runs (provisional → final), immutable snapshots, statement PDFs, annual summaries
- GST / withholding fields on creator statements (after accountant guidance)
- Creator portal on real auth with RLS; referral funnel tracking (clicks, sign-ups)
- Operator documentation for the monthly close

**DoD:** acceptance tests 3, 4, 5 and 7 pass against the database, cent-exact and reproducible.

## Phase 5 — Payouts & reporting
Accounts: none by default (Xero only if you approve).
- Bank file export built to your bank's actual specification (ABA or CSV) — sample only until verified
- Maker/checker with a separate finance-approver role; import bank confirmation file; reconciliation
- Finance dashboard KPIs, cohort retention and contribution margin reports

**DoD:** a dry-run payout file validated by your bank's test/upload checker; no batch can be paid twice.

## Phase 6 — Production readiness & app stores
Accounts: Apple Developer, Google Play Console, domain/DNS, email sending, error monitoring, Vercel, Expo EAS.
- App-store billing decision (`APP_STORE_BILLING_DECISION.md`) with current official sources; IAP adapter if needed
- Legal reviews: privacy policy, terms, creator contracts, Children's Online Privacy Code, consumer law, NSW
  child-employment rules; external exercise-safety review of child workouts
- Security review / penetration test, backup-restore drill, monitoring, runbooks, launch checklist

**DoD:** all 10 acceptance tests pass in staging; reviews signed off; you approve go-live in writing.
