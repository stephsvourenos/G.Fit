# PROJECT_NAME — family fitness streaming platform

Curated, Netflix-style on-demand workouts for whole households: website + member app + admin + creator portal
(Next.js) and iPhone/Android apps (Expo), sharing one tested business-rules engine.

> **Status: Phase 0 prototype.** Everything runs on sample data. No real accounts, payments or videos are
> connected. See `BUILD_STATUS.md`.

## Look around
Screenshots of every key screen are in the latest delivery. To click through it yourself, run it locally (below)
— about 10 minutes the first time. Demo parent PIN: **1234**. A hosted preview link arrives in Phase 1 once the
code is on GitHub and connected to a free Vercel preview.

## Run it on your Windows PC (optional)
1. Install **Node.js LTS** from https://nodejs.org (accept the defaults).
2. Open **PowerShell** and run once: `npm install -g pnpm`
3. Unzip this project into e.g. `Documents\project-name-platform`, then in PowerShell:
   ```powershell
   cd $HOME\Documents\project-name-platform
   pnpm install
   pnpm dev
   ```
4. Open **http://localhost:3000** in your browser.
5. Phone app: install **Expo Go** from the App Store / Google Play, run `pnpm dev:mobile` in a second PowerShell
   window, and scan the QR code (phone and PC on the same Wi-Fi).

Stop a running command with **Ctrl + C**.

## Where things are
| Path | What |
|---|---|
| `apps/web` | Website, member app (`/watch`), admin (`/admin`), creator portal (`/creator`) |
| `apps/mobile` | iOS/Android app (sign-in only — see `docs/APP_STORE_BILLING_DECISION.md`) |
| `packages/domain` | Business rules: money, playback qualification, royalties, referrals, ledger, payouts — with tests |
| `packages/mock-data` | Sample catalogue, households, invoices and a 5-month finance simulation |
| `packages/config` | Branding (`PROJECT_NAME` placeholder) and environment validation |
| `docs/` | Brief review, architecture, phased plan, billing gate, security |
| `ACCOUNT_SETUP.md` · `DECISIONS_REQUIRED.md` · `BUILD_STATUS.md` | Your checklists |

## Commands
`pnpm test` · `pnpm dev` · `pnpm dev:mobile` · `pnpm check:env` · `pnpm --filter web build`
