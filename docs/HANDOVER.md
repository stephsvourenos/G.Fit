# G.Fit — master handover

_Last updated: 13 Nov 2026. Read this first in a new chat. It supersedes older status notes where they disagree.
Detail lives in the repo docs named below; this file is the map._

## 1. What this is
G.Fit (working name) is a curated, on-demand fitness streaming service for **whole households, like Netflix**.
Adults are full members with their own workouts, and kids have their own age-appropriate profiles in the same
membership. **Don't describe it as a kids' service.**

It is Australia-first and priced in AUD, GST included. The owner is not a developer. Claude leads the build and gives
plain-English, one-step-at-a-time instructions for anything only she can do.

The build follows the master brief (`/home/claude/CLAUDE_CODE_FITNESS_PLATFORM_MASTER_BRIEF.md` in the original
workspace; brief review in `docs/BRIEF_REVIEW.md`). Phases 0–5 are done. **Phase 6 (launch readiness) is in progress.**

## 2. Rules that always apply (from the brief and the owner)
- No live payments, live payouts or production deployments without the owner's explicit approval. Stripe stays in
  **test mode**.
- Never ask the owner to paste secrets, passwords, bank credentials, signing keys or API tokens into chat, and never
  commit them to Git. She enters secrets herself in the provider's settings screen.
- Don't push her to sign up for paid services early. Ask when a phase needs one.
- No real children's names or photos in seed or test data. **No real people's likenesses** in profile pictures
  unless they've given written consent (see coach photos).
- Database changes only through versioned migrations in `supabase/migrations/`.
- Keep `BUILD_STATUS.md` current and test everything. Every suite must pass before saying "done".
- Plain words with the owner: "linked", "the test system", "Admin → Creators" rather than tool or table names.

## 3. Where everything lives
| Thing | Where |
|---|---|
| Code | GitHub `stephsvourenos/G.Fit` (**public — must be made private before launch**), branch `main` |
| Local clone (agent workspace) | `/home/claude/fitness-platform` (pnpm monorepo) |
| Test website | https://g-fit-liard.vercel.app (Vercel, auto-deploys `main`, Vercel Authentication on) |
| Test database/server | Supabase project **gfit-dev-sydney**, id `iwwnexttdqksrwqafazi`, org `wwtjzuhhictcxkhuuqvp`, Sydney. Publishable key `sb_publishable_wk7bojwHFpsZlOBqOcCFPA_os_1w4z6` (public) |
| Other Supabase projects | `gfit-restore-drill` (`zmqfntozzwbbvlyokzwj`, paused, rebuild rehearsal); old `gfit-dev` (`agvlggflnxmytollvsjj`, inactive, can be deleted) |
| Payments | Stripe account `acct_1UWCOnAYkYpkZaSV` "G.Fit sandbox", **test mode** |
| Video | Mux, environment `gfit-dev`, free plan (10-asset limit; 6 used) |
| Phone app | Expo project `gfit` (id `5dcb1501-dddc-406a-8bc9-e88f78b69bfc`, owner `stephanies88s-team`), opens in Expo Go: `exp://u.expo.dev/5dcb1501-dddc-406a-8bc9-e88f78b69bfc?runtime-version=exposdk%3A58.0.0&channel-name=preview` |
| Legal drafts (for lawyer) | Claude Docs "G.Fit legal drafts for lawyer review": https://claude.ai/artifact/B1PtW4nRvWLp9JMjx3q4b5 (tabs: Overview & questions, Privacy policy, Membership terms, Creator agreement) |
| Project docs (claude.ai Project "Fitness App") | `claude/*.md` copies of the repo docs below + this file |

Repo docs: `BUILD_STATUS.md` (log), `DECISIONS_REQUIRED.md`, `ACCOUNT_SETUP.md`, and in `docs/`:
- `ARCHITECTURE.md`
- `IMPLEMENTATION_PLAN.md`
- `BRIEF_REVIEW.md`
- `APP_STORE_BILLING_DECISION.md`
- `MONTHLY_CLOSE.md` (operator guide)
- `PRODUCTION_SETUP.md`
- `LAUNCH_CHECKLIST.md`
- `RESTORE.md`
- `SECURITY_REVIEW.md`
- `SECURITY_AND_SECRETS.md`

## 4. Decisions made, and why
| Date | Decision | Why |
|---|---|---|
| Oct 2026 | pnpm TypeScript monorepo; shared rules in `packages/domain` (pure functions) | One copy of the money/royalty/playback rules for web, phone and server. They can't drift and are fully unit-tested. |
| Oct 2026 | Next.js 16 web (website + member app + admin + creator portal in one), Expo SDK 58 phone app | One deployable for the web; one codebase for iOS and Android with no Mac needed |
| Oct 2026 | Supabase Postgres + Row-Level Security, Sydney region | The database itself enforces privacy (a creator can't query another creator's rows); data stays in Australia |
| Oct 2026 | Mux with signed-only playback | Pay-as-you-go; a stream refuses to play without a short-lived token issued after the entitlement, age and PIN checks |
| Oct 2026 | Stripe hosted Checkout, Billing and Portal for **website** purchases; Stripe is the financial source of truth | No competing payment system; we store synced IDs and snapshots only |
| Oct 2026 | Phone app is **sign-in only** (no purchase screens) | App-store billing rules are an open decision (`docs/APP_STORE_BILLING_DECISION.md`) |
| 27 Oct | Code on GitHub (not GitLab) | Owner's choice |
| 7 Nov | **No Stripe Tax** | Prices are GST-inclusive; GST is recorded as 1/11 per payment. Revisit only if selling outside Australia. |
| 7 Nov | **7-day free trial**, card required, one per family and per card (card fingerprint), cards / Apple Pay / Google Pay only | Owner preferred a trial to free sample workouts; built to follow Australian subscription-trap rules (disclosure, online cancel, reminder before the trial ends; reminder rules start 1 Jul 2027) |
| 7 Nov | Royalties count **paid** viewing only (not trials or test grants) | Creators are paid from real net receipts |
| 7 Nov | Bank: **ANZ**; creator payouts by ABA direct-entry file, maker/checker approval | Owner's bank; two-person control on money out |
| 8 Nov | Working name **G.Fit** (one config value: `packages/config/src/brand.ts`) | Final name and trademark check still open (D6) |
| 9 Nov | **Founder price A$9.99/month**, locked for as long as the membership continues; code `FOUNDER`, monthly only | Owner's decision |
| 9 Nov | **Promo codes LAUNCH499** (A$4.99/month × 6) and **LAUNCH999** (A$9.99/month × 6), then A$14.99; monthly, new members only; validated by our server (Stripe's code box is off) | Owner asked for both options; server-side checks stop a monthly promo being used on annual |
| 9 Nov | Scheduled jobs read their target URL from `private.app_config` | So a production copy can never call the test system |
| 10 Nov | Closing an account cancels Stripe first and keeps anonymised financial and viewing records | Fixes a bug found in the security review: tax records must be kept 7 years, royalty inputs must not change, and it blocks repeat trials |
| 10 Nov | Publishing needs: rights checklist, video ready, captions ready | Captions are required at launch; Mux makes English captions automatically |
| 10 Nov | Price changes need ≥ 30 days' notice; founders are excluded | Consumer-law notice; the founder price is a promise |
| 10 Nov | Colour scheme from the owner's reference: ink #15131C, gum pink #E0177A (actions), sky #4CC9F0, sun #FFB703, mint #3FD08F; fonts Bricolage Grotesque (headings) + Atkinson Hyperlegible (body) | Owner's choice of palette; the body font is chosen for easy reading |
| 10 Nov | Profile pictures are **original illustrations** (58: Movers, Animal athletes, Gear, animated), with emoji kept as "Classic"; no real people | Using real athletes or influencers needs their consent and usually a paid licence |
| 11 Nov | **Coach photos as profile pictures** only with the coach's written consent (creator agreement clause 10, optional), adults only, removable at once | The legitimate way to offer "real people" pictures |
| 10 Nov | Public website: interactive "Who's moving today?" hero showing each family member's age-appropriate shelf | Shows the core offer (one membership, everyone sees what suits them) without explaining it |

## 5. Architecture
```
Families (web)  ─┐                      ┌─ Supabase Auth (household login, email confirm)
Families (phone)─┤  apps/web (Next.js)  ├─ Postgres + RLS (all data; rules enforced in the database)
Staff (/admin)  ─┤  apps/mobile (Expo)  ├─ Edge Functions (Deno) — anything needing a secret
Creators        ─┘                      └─ pg_cron jobs → private.call_function() → Edge Functions
                 Stripe (Checkout/Portal/webhooks)   Mux (upload, signed playback, captions, webhooks)
                 Resend (email — not connected yet)  ANZ (ABA file upload by a person)
```
- **Clients talk straight to Supabase** using only the public URL and publishable key. Everything that needs a secret
  (Stripe, Mux, email, payouts) is an Edge Function. The phone app calls the same functions; it doesn't go through the
  website.
- **Shared rules:** `packages/domain` is bundled for Deno into `supabase/functions/_shared/domain.js` with `pnpm -s
  bundle:deno` (run inside `packages/domain`). A unit test fails if the bundle is stale.
- **Deploys:**
  - Website: Vercel builds `main`.
  - Functions: GitHub Actions `.github/workflows/deploy-functions.yml` deploys on push to `main` when
    `supabase/functions/**`, `config.toml` or `packages/domain/src/**` change (secret `SUPABASE_ACCESS_TOKEN`).
  - Phone: `apps/mobile/.eas/workflows/preview.yml` publishes an update to channel `preview` on every push. GitHub
    commit statuses "Vercel" and "Phone preview …" show the result.
- **Database migrations are applied by Claude** through the Supabase connector (`apply_migration`). Each needs the
  owner to approve a prompt that **expires after ~2 minutes**. Ask her to reply "ready" first. If it expires, stop and
  ask again; don't route around the approval.
- **Backups:** `.github/workflows/backup-database.yml` (nightly encrypted `pg_dump` to the repo). It needs the GitHub
  secrets `SUPABASE_DB_URL` and `BACKUP_PASSPHRASE`, which are **not yet added**. Restore steps are in `docs/RESTORE.md`.
  A rebuild from the repo was rehearsed on 9 Nov.
- **Environments:** local mock mode (no keys) → test (gfit-dev-sydney + Stripe test + Mux + Expo preview) →
  production (**not created**; plan in `docs/PRODUCTION_SETUP.md`). The server refuses live Stripe keys unless
  `APP_ENV=production`.
- **Secrets** (names only; set in Supabase Edge Function secrets by the owner):
  - Stripe: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
  - Mux: `MUX_TOKEN_ID`, `MUX_TOKEN_SECRET`, `MUX_SIGNING_KEY_ID`, `MUX_SIGNING_PRIVATE_KEY`, `MUX_WEBHOOK_SECRET`
  - Email (not set yet): `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_TEST_ALLOWLIST`, `ALERT_EMAIL`
  - Other: `APP_ENV`, `SITE_URL`, `SITE_ORIGINS`, `SUPPORT_EMAIL`, `BRAND_NAME`

### Code map
| Path | Contents |
|---|---|
| `packages/domain/src` | Pure business rules + tests (`packages/domain/test`). |
| `packages/config` | `brand.ts` (name, colours), env validation |
| `packages/mock-data` | Sample catalogue/households for mock mode and the website demo |
| `apps/web/src/app` | `/` website, `/join`, `/legal/*`, `/support`, `/r/[code]` referral landing, `/account/*` sign-in, `/watch/*` member app, `/admin/*`, `/creator/*` |
| `apps/mobile/src/app` | `index` (sign-in + profile chooser + PIN), `home`, `workout/[id]`, `play/[id]` |
| `supabase/functions` | Edge Functions (§7), `_shared/` (http, stripe, mux, playback, origins, domain bundle) |
| `supabase/migrations` | 31 migrations (core schema 27 Oct → coach portraits 11 Nov) |
| `e2e/` | Headless browser journeys (live, staff, video, mobile) |
| `scripts/verify-month-end.py` | Independent recompute of a month's royalties from raw tables |

`packages/domain/src` modules:
- money
- entitlement / playback gate
- playback (qualified minutes)
- receipts
- royalty
- referral
- ledger
- contracts
- statements
- monthEnd
- billing
- aba (bank file + reconciliation)
- emails (all member email wording)
- catalog (labels, `suitabilityLabel`, publish rules)
- home (rows)
- avatars (profile picture library)

## 6. Data model (public schema unless noted; RLS on every table)
- **Households and people:**
  - `households`: one login owner. `closed_at` is set when an account is closed, and the owner then becomes null.
  - `profiles`: nickname, `age_band`, `avatar_emoji` (≤ 8 chars: an emoji or a library id like `@run1`),
    `avatar_colour`, `avatar_instructor_id` (optional consented coach photo; the emoji stays as the fallback),
    `max_intensity`. Maximum 6 per household.
  - `household_pins`: salted hash, locks after 5 wrong tries, no client access.
- **Viewing:** `watch_progress`, `favourites`, `completions`.
- **Catalogue:**
  - `creators` (payee, ABN, GST, guardian-managed, referral code) and `creator_users` (portal logins).
  - `instructors`: coach profiles; `is_minor`; `portrait_path`, `portrait_consent_at`, `portrait_consent_ref`.
  - `workouts`: state draft → review → published → archived; rights checklist; Mux ids; `caption_status`.
  - View `coach_pictures`: consenting adult coaches with a photo.
- **Video:** `mux_events` (webhook log).
- **Playback and royalties input:**
  - `playback_sessions`, `playback_heartbeats` (purged after 90 days).
  - `qualified_views`: credited minutes, labelled paid / trial / grant.
  - `playback_anomalies`: fraud queue.
- **Billing:**
  - `billing_customers`, `billing_events` (webhook idempotency).
  - `billing_invoices`: amount, GST 1/11, fee, plan, period; the input to royalties.
  - `billing_refunds`.
  - `entitlements`: status, plan, `cancel_at_period_end`, price and discount snapshot.
  - `trial_claims` (per family and per card fingerprint), `pricing_settings` (founder code, open/close, cap).
  - `price_changes`, `member_notices`: queued emails with a dedupe key and status (logged, sent, failed).
- **Referrals:**
  - `referral_attributions`: the first paid invoice decides the creator; terms are frozen at that point.
  - `referral_clicks`.
- **Creator economics:**
  - `creator_contracts`: versioned, append-only.
  - `month_end_runs`: preview or final, with a fingerprint.
  - `ledger_entries`: append-only.
  - `creator_statements`.
- **Payouts:**
  - `payout_batches`, `payout_items` and `payout_item_entries`: maker ≠ checker, and an entry can never be paid twice.
  - `creator_bank_accounts`: masked; changes audited.
  - `finance_settings`: ANZ details, video cost.
- **Operations:**
  - `staff_members`: roles admin, content_editor, finance, finance_approver.
  - `audit_log`: append-only, written by triggers.
  - `system_events`: crash and health problems.
  - `private.app_config`: `functions_url`.
  - `private.cron_nonces`: single-use job authentication.
- **Storage:** bucket `coach-portraits` (public read; staff-only write/list/delete).
- **Key database functions:**
  - PIN: `set_household_pin`, `verify_household_pin`, `household_pin_is_set`, `lock_household_pin`.
  - Account: `export_my_household`, `delete_my_account` (refuses while a membership is active), `close_account_for`.
  - Admin: `admin_grant_membership`, `admin_link_creator_login`, `admin_announce_price_change`.
  - Money: `create_payout_batch`, `payout_batch_action`, `payout_record_export`, `finalise_month_end`,
    `finance_report`, `my_creator_minutes`.
  - Other: `record_referral_click`, `report_client_error`, `record_system_event`, `run_health_check`, `log_audit`.
- **Test suites** (each runs in a transaction that always rolls back, so the "error" text is the result):
  - `select tests.run_rls_checks();` → 33
  - `select tests.run_app_journey();` → 19
  - `select tests.run_finance_checks();` → 38
  - `select tests.run_account_closing_checks();` → 8
  - `select tests.run_coach_portrait_checks();` → 9

  All passed on 11 Nov.

## 7. Server API (Edge Functions; callers send the user's access token)
| Function | Who | Actions / purpose |
|---|---|---|
| `billing-checkout` | family | Start Stripe Checkout (plan, `offerCode`, referral); `check_offer` mode validates FOUNDER/promo codes server-side |
| `billing-portal` | family | Stripe Customer Portal link for the caller's own household |
| `stripe-webhook` | Stripe (signed) | Each event once; re-reads Stripe; updates entitlements/invoices/refunds; queues notices |
| `billing-reconcile` | cron 02:41 UTC + admin | Repairs drift from missed webhooks; test-only `{test:{…}}` tools (test key, non-production) |
| `close-account` | family | Cancels Stripe subscription immediately, then `close_account_for` |
| `playback-token` | family | Checks profile, membership, age band, intensity, PIN (adult) → signed Mux tokens + session |
| `heartbeat` | family | Records playback heartbeats for the caller's own sessions |
| `aggregate-playback` | cron every 15 min | Scores quiet sessions → `qualified_views` / `playback_anomalies` |
| `video-admin` | content staff | `create-upload`, `use-sample`, `refresh`, `generate-captions` |
| `mux-webhook` | Mux (signed) | Asset/caption status |
| `mux-health` | staff | Diagnostics |
| `month-end` | finance + cron (1st–5th, 04:13 UTC) | preview, `final`, `verify`, `payables`, `create-payout-batch` |
| `payout-file` | finance | `check`, `sample`, `generate` (ABA), `download`, `reconcile` (bank CSV) |
| `pricing-admin` | admin | `list`, `create`, `set_active` promo codes; founder stats |
| `send-emails` | cron every 10 min + admin | Renders `member_notices` via domain `renderNotice`; sends with Resend if configured, else marks "logged"; `retry`, `status`; system-problem alerts to `ALERT_EMAIL` |

Other scheduled jobs (pg_cron, UTC):
- `health-check` at :07 every hour
- `promo-ending-notices` daily at 22:23
- `purge-old-heartbeats` daily at 03:17

## 8. Finished
- **Phase 0:** brief review, architecture, plan, domain engine, full clickable prototype.
- **Phase 1:**
  - Supabase schema and RLS.
  - Real household accounts: sign-up, email confirm, password reset.
  - Parent PIN, profiles, export, close account.
  - Staff and creator logins, audit log.
- **Phase 2:**
  - Mux upload and signed playback on web and phone.
  - Server heartbeats and qualified minutes, the fraud queue.
  - AirPlay/Chromecast credited (casting confirmed on a real TV).
- **Phase 3:**
  - Stripe test-mode memberships (monthly A$14.99, annual A$149.99), Checkout, Portal, webhooks, reconcile.
  - Compliant 7-day trial, referrals.
- **Phase 4:**
  - Versioned contracts, month-end preview / finalise / verify.
  - Append-only ledger, statements, creator portal.
  - Cent-exact verification for Nov 2026 test data.
- **Phase 5:**
  - ABA payout file and bank-CSV reconciliation, creator bank details.
  - Finance reports: MRR, cash, margin, cohorts.
- **Phase 6 so far:**
  - Founder and promo pricing, proven with 8-month Stripe test clocks.
  - All member emails written and queued, but not sent; there is no email provider yet.
  - Price-change and offer-ending notices.
  - Phone preview via Expo Go.
  - Restore drill, backup workflow, system health and alerts, security headers.
  - Security review, with fixes including account closing.
  - Production setup plan and launch checklist.
  - Legal drafts.
  - Content pipeline: new or edit workout, automatic captions, publish gate.
  - New colour scheme.
  - 58-picture profile library, plus changing a profile's picture.
  - Public website redesign.
  - Coach photos as profile pictures, and the consent clause in the creator agreement.

## 9. In progress / partly done
- **Phase 6 launch readiness.** Engineering items are done. The rest waits on the owner's accounts, decisions and
  professional reviews (§10, `docs/LAUNCH_CHECKLIST.md`).
- **Emails:** templates and queue are live; sending waits for a domain and a Resend account.
- **Backups:** the workflow exists; GitHub secrets aren't added yet.
- **Phone app:** a preview only. No store builds, and no purchase screens until the app-store billing decision.

## 10. Open questions for the owner
1. **Founder price on the homepage?** The website shows A$14.99 / A$149.99 with an "offer code" note. Should the
   A$9.99 founder offer be advertised publicly, or stay a code she hands out? (Asked 10 Nov, unanswered.)
2. **Founder offer limits:** closing date and maximum number of founders (Admin → Plans & pricing).
3. **D2:** legal and accounting advice before filming or contracting under-18 coaches (child employment by state,
   guardian payee, money held for the child).
4. **D3:** who is the second approver (checker) for payouts.
5. **D4:** founding referral terms (10% for 120 paid months). Confirm, cap or taper.
6. **D5:** launch content target (default ≥ 60 workouts, ≥ 10 per age band, all captioned). This also needs a
   **paid Mux plan** before uploading the full library.
7. **D6:** final brand name, trademark check, domain.
8. **Accountant:** GST and withholding on creator payments; who earns a child creator's income.
9. **Lawyer:** review the legal drafts, including new creator agreement clause 10 (unpaid photo use OK? confirm the
   adults-only rule).
10. **App-store billing** decision (`docs/APP_STORE_BILLING_DECISION.md`) and Apple/Google developer accounts.
11. **Production go-ahead:** Supabase Pro (~US$25/month), Stripe live activation, Vercel production domain.

## 11. Known bugs, quirks and loose ends
- **Repo is public.** Nothing secret is in it, but it must go private before launch (Settings → General).
- **Coach-portrait migration drift:** the live test database got two follow-up changes via SQL rather than
  `apply_migration`: the staff storage *select* policy and the corrected consent test. Both are in the migration file
  `20261111090000_coach_portraits.sql`, so a rebuild is correct, but the live migration record holds the first
  version.
- **Stale remote branches** `phase6-pricing-emails`, `fix-close-account`, `coach-portraits`: the agent can't delete
  remote branches (403). The owner can delete them on GitHub; nothing is lost.
- **The website hero demo** uses sample workouts from `packages/mock-data`, not the live catalogue (intentional for
  now; switch once real content exists).
- **Phone app:** profiles and pictures can only be created or changed on the website. The phone shows animated
  pictures as stills.
- **Mock mode** has no coach photos (they come from the database).
- **The Deno domain bundle** includes the avatar SVG library (unused server-side; harmless, a little larger).
- **Test data left on the test system** (by design or harmless):
  - creator "TEST · bank file check" with a cancelled A$123.45 batch (payout records are permanent);
  - archived workout "TEST Captions check";
  - three "Testy" profiles on e2e-newfamily2;
  - e2e-newfamily (closed and anonymised);
  - promo TESTONLY799 (off);
  - two coach-portrait audit entries for "Coach Ava".
- **Dependency advisories:** 16 (7 high), all inside Expo's build-time CLI, not shipped. Re-check monthly with
  `pnpm audit --prod`.
- **Supabase advisor notes** (accepted): `SECURITY DEFINER` functions check roles inside; 4 server-only tables have
  no policies; `pg_net` is in the public schema.
- **Tooling:**
  - Headless Chromium here can't open a second browser context. Two logins in one browser share a session, so test
    different users in separate runs.
  - The shell can't reach Supabase with Node `fetch` (no proxy). Use `curl` (helpers in the agent scratchpad
    `fn.sh`).
  - Sleep chaining is blocked; use until-loops.

## 12. Exact next steps
In order. Owner steps are marked ✋; ask before anything that costs money or goes live.
1. ✋ Get answers to §10 items 1–2 (founder on homepage; founder limits). If yes to item 1, add a "Founding families
   A$9.99 a month, locked in" panel to the pricing section of `apps/web/src/app/page.tsx`, and set the limits in
   Admin → Plans & pricing.
2. ✋ Owner adds GitHub secrets `SUPABASE_DB_URL` and `BACKUP_PASSPHRASE`. Then Claude runs the backup workflow once
   and does a decrypt-and-restore test into `gfit-restore-drill` (`docs/RESTORE.md`).
3. ✋ Owner makes the GitHub repo private and deletes the three stale branches. Then check Vercel, the Expo preview and
   the deploy workflow still run.
4. ✋ Owner sends the legal drafts doc to a lawyer and the accountant questions to an accountant. Fold the answers
   back into the drafts, then publish them at `/legal/*`.
5. ✋ Final name and domain (D6). Then:
   - Resend account, domain verified;
   - owner sets `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_TEST_ALLOWLIST`, `ALERT_EMAIL`;
   - Claude sends a real trial-ending reminder to an allow-listed inbox and a test alert.
6. ✋ Upload real content: creators via Admin → Creators → New creator; workouts via Content → New workout. Collect
   signed contracts, including clause 10 consent where given, and coach photos. This needs a paid Mux plan before
   going past 10 videos.
7. ✋ Production go-ahead, then follow `docs/PRODUCTION_SETUP.md`:
   - create `gfit-prod` (Pro) and rebuild from migrations;
   - set `private.app_config.functions_url`;
   - add an approval-gated production deploy;
   - Stripe live: products, prices, promos, webhook, portal;
   - a real A$14.99 sign-up then refund;
   - Vercel on the real domain.
8. ✋ ANZ direct entry; run the test ABA file through ANZ's checker (`docs/MONTHLY_CLOSE.md`).
9. Re-run the security review (`docs/SECURITY_REVIEW.md` steps). Owner turns on leaked-password protection and staff
   MFA in production.
10. App stores (after the billing decision): EAS production builds, store listings, privacy labels.
11. Launch day checks (`docs/LAUNCH_CHECKLIST.md` §F); record go / no-go in `BUILD_STATUS.md`.

## 13. How to verify after any change
- `pnpm -s test` in `packages/domain` (83 tests). If `packages/domain/src` changed, run `pnpm -s bundle:deno` there
  first.
- In `apps/web`: `npx tsc --noEmit && npx eslint src --quiet && npx next build`.
- In `apps/mobile`: `npx tsc --noEmit`.
- After database or function changes: the five SQL suites (§6).
- Browser checks: `next start -p 3100` plus the headless scripts in `e2e/`.
- Test logins on the test system:
  - e2e-parent@gfit.test
  - e2e-admin@gfit.test (admin + content editor)
  - e2e-creator@gfit.test (guardian of "Junior Coach Pip")
  - e2e-newfamily2@gfit.test (PIN 4826, no membership)

  The shared test password is never written in docs; the owner holds it. The agent kept a copy in its scratchpad
  only.
- After pushing to `main`, check the GitHub commit statuses "Vercel" and "Phone preview" are green.
