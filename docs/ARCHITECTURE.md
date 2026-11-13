# Architecture & deployment (one page)

```mermaid
flowchart LR
  subgraph Users
    P[Families<br/>iPhone / Android app]
    W[Families on the website]
    A[Staff / admin]
    C[Creators & coaches]
  end

  subgraph Apps["Our code (one TypeScript monorepo, GitHub)"]
    M[apps/mobile<br/>Expo + Expo Router<br/>sign-in only · Expo Go preview]
    N[apps/web — Next.js on Vercel<br/>website · /watch · /admin · /creator]
    D[(packages/domain<br/>money · royalties · referrals<br/>playback rules · emails · ABA)]
  end

  subgraph Supabase["Supabase (Sydney region)"]
    AUTH[Auth<br/>household sign-in]
    DB[(Postgres + Row-Level Security<br/>households · profiles · catalogue<br/>billing · ledger · payouts · audit)]
    FN[Edge Functions<br/>checkout · webhooks · playback tokens<br/>month-end · payout file · emails]
    CRON[pg_cron jobs<br/>playback · reconcile · emails · health]
    ST[Storage<br/>coach photos]
  end

  subgraph Providers
    MUX[Mux<br/>upload · signed playback · captions]
    STRIPE[Stripe<br/>Checkout · Billing · Portal]
    MAIL[Resend email<br/>not connected yet]
    BANK[ANZ<br/>ABA file upload by a person]
  end

  P --> M
  W --> N
  A --> N
  C --> N
  M & N --> AUTH
  M & N -- "public key only; RLS decides" --> DB
  M & N -- "anything needing a secret" --> FN
  CRON --> FN
  FN --> DB
  M & N -. "signed, short-lived video token<br/>(after entitlement + age + PIN check)" .-> MUX
  N -- "hosted checkout redirect" --> STRIPE
  STRIPE -- "signed webhooks" --> FN
  MUX -- "signed webhooks" --> FN
  FN --> MAIL
  FN -- "ABA file (maker + checker)" --> BANK
  D --- M & N & FN
```

## How money and minutes flow
1. A parent buys on the **website** → Stripe Checkout → Stripe sends a **signed webhook** → we fetch the
   subscription from Stripe and switch the household on. (We never trust the browser's "success" page.)
2. A profile presses play → our server checks **entitlement + age band + PIN** → mints a **signed Mux token**
   valid for minutes, not days.
3. The player sends a **heartbeat** every ~12 s → the server rebuilds which parts were genuinely played →
   aggregated **qualified minutes** (raw heartbeats deleted after 90 days).
4. Month end: Stripe invoice snapshots → **net receipts** (minus GST, fees, refunds) recognised per service month →
   **royalty pool** (household-balanced) + **referral commission** → **append-only ledger** + frozen snapshot.
5. On the due date → **payout batch** (maker creates, checker approves) → bank file → confirmation imported → paid.

## Key decisions
| Decision | Choice | Why |
|---|---|---|
| Repo | pnpm monorepo, TypeScript everywhere | One set of rules shared by web, mobile and server — the royalty maths can't drift between apps |
| Shared logic | `packages/domain` (pure functions, no I/O) | Fully unit-testable; same code runs in browser, phone and server |
| Money | Integer cents, BigInt for multiplication, largest-remainder splitting | Cent-exact, reproducible, no rounding residue |
| Web | Next.js 16 (App Router) | Website, member app, admin and creator portal in one deployable |
| Mobile | Expo SDK 58 + Expo Router | One codebase for iOS/Android; cloud builds via EAS (no Mac needed) |
| Data/auth | Supabase Postgres + RLS | Database-enforced privacy: a creator physically cannot query another creator's rows |
| Billing | Stripe (web) behind a `BillingProvider` abstraction | Apple/Google IAP can be added without touching royalties |
| Video | Mux with signed playback | Pay-as-you-go, no servers to run, signed URLs stop link sharing |
| Integrations | Mock adapters until keys exist | The whole product runs locally with zero accounts |
| Deploys | Vercel (web), GitHub Actions (functions), EAS workflow (phone preview) — all from `main` | What's running always equals the repository |
| Scheduled jobs | pg_cron → `private.call_function()` using `private.app_config.functions_url` | A production copy can never call the test system |
| Emails | Words in `packages/domain/src/emails.ts`, queued in `member_notices`, sent by `send-emails` | Unit-tested wording; nothing lost before an email service exists |
| Profile pictures | Original SVG library in `packages/domain/src/avatars.ts`; coach photos only with written consent | No likeness rights problems |

## Environments
`local` (mock adapters) → `test` (Supabase `gfit-dev-sydney` + Stripe test mode + Mux `gfit-dev` + Expo preview) →
`production` (not created yet; plan in `docs/PRODUCTION_SETUP.md`).
Secrets live only in Supabase Edge Function secrets (and `.env.local` on a developer machine); clients use only the
public URL and publishable key.
`pnpm check:env` refuses a live Stripe key outside production.

## Backups & rollback
Nightly encrypted backup workflow (needs two GitHub secrets) + `docs/RESTORE.md` (rebuild rehearsed 9 Nov);
Supabase daily backups on Pro (point-in-time recovery optional); database changes only via versioned migrations;
web deploys are immutable and can be rolled back instantly on Vercel; mobile uses staged store releases + EAS
Update for quick fixes.


Data model, server API and current state: `docs/HANDOVER.md` §5–7.
