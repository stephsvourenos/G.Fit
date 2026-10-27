# BUILD_STATUS

_Last updated: 26 Oct 2026 — end of Phase 0_

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

## Blockers
- Phase 1 needs the Supabase account (ACCOUNT_SETUP.md §2).

## Next
1. ✅ Code is on GitHub: `stephsvourenos/G.Fit` (27 Oct 2026).
2. Phase 1: Supabase project (I'll walk you through it), migrations, RLS policies + tests, real sign-in.
