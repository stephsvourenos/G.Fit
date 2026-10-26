# ACCOUNT_SETUP — every third-party account, and exactly when you need it

**Golden rules**
- I'll tell you at the moment an account is needed — never earlier.
- **Never paste passwords, secret keys, signing keys or bank details into the chat.** Secret values go into a file
  called `.env.local` on your computer, or into the hosting provider's "Environment variables" screen. Public
  values (like a project URL) are fine to share.
- Test/sandbox modes first. No live charges, payouts or deployments without your written OK.

Statuses: `NOT NEEDED YET` · `ACTION REQUIRED` · `CONNECTED TEST` · `READY FOR PRODUCTION` · `BLOCKED`

| # | Provider | Why | When | Cost to start | Status |
|---|---|---|---|---|---|
| 1 | GitHub | Permanent, private home for the code + history; later auto-deploys the website | **Now (before Phase 1)** | Free | `ACTION REQUIRED` |
| 2 | Supabase | Database, household sign-in, privacy rules | Phase 1 | Free tier | `NOT NEEDED YET` |
| 3 | Mux | Video upload, encoding, signed streaming | Phase 2 | Free plan (10 videos, 100k delivered min/month) | `NOT NEEDED YET` |
| 4 | Stripe | Website subscriptions (test mode first) | Phase 3 | Free to open; fees per live charge only | `NOT NEEDED YET` |
| 5 | Business bank (existing) | Payout file format + confirmation files | Phase 5 | — | `NOT NEEDED YET` |
| 6 | Xero (optional) | Accounting export | Phase 5, only if you approve | Your existing plan | `NOT NEEDED YET` |
| 7 | Vercel | Hosts the website/admin | Phase 6 | Commercial use needs a paid plan (verify at sign-up) | `NOT NEEDED YET` |
| 8 | Expo (EAS) | Cloud builds of the iOS/Android apps (no Mac needed) | Phase 6 (optional earlier for phone testing) | Free tier | `NOT NEEDED YET` |
| 9 | Apple Developer Program | Publish to the App Store | Phase 6 | US$99/yr (billed in AUD) | `NOT NEEDED YET` |
| 10 | Google Play Console | Publish to Google Play | Phase 6 | US$25 one-off | `NOT NEEDED YET` |
| 11 | Domain + DNS | e.g. yourbrand.com.au | Phase 6 (or as soon as the brand is chosen) | ~A$20–40/yr | `NOT NEEDED YET` |
| 12 | Transactional email (e.g. Resend or Postmark) | Verification, receipts, PIN reset emails at scale | Phase 6 | Free/low tiers | `NOT NEEDED YET` |
| 13 | Error monitoring (e.g. Sentry) | Crash and error alerts | Phase 6 | Free developer tier | `NOT NEEDED YET` |

Prices change — I'll re-check each provider's pricing page on the day you sign up.

---

## 1. GitHub — `ACTION REQUIRED` (free, ~5 minutes)

**(a) Provider:** GitHub · **(b) Why:** your code currently lives in my secure cloud workspace and as a zip
download. GitHub gives you a private, backed-up copy with full history that you own, and later lets the website
deploy automatically. **(d) Cost:** free.

**(c, e) Steps — one at a time:**
1. Go to **https://github.com/signup** and create an account with your business email. Turn on two-factor
   authentication when prompted (Settings → Password and authentication).
2. Click **+** (top right) → **New repository**.
3. Name: `project-name-platform` (you can rename later). Choose **Private**. Leave "Add a README" **unticked**.
   Click **Create repository**.
4. Tell me the repository name in the chat (e.g. `your-username/project-name-platform`). That's not a secret.

**(f) What the code needs:** nothing secret. **(g) Secrets:** none — when I connect, GitHub will show you a
permission prompt you approve in your browser; no tokens are pasted into chat.
**(h) Verify:** after I push, you'll see the folders `apps`, `packages`, `docs` in your repository on github.com.

---

## 2. Supabase — `NOT NEEDED YET` (Phase 1)
Free tier: 2 projects, 500 MB database, 50k monthly active users; free projects pause after a week of inactivity
(fine for development). Pro is US$25/month when you launch (no pausing, more storage, better backups).
When we start Phase 1 I'll walk you through: sign up at https://supabase.com/dashboard/sign-up → New project →
region **Sydney (ap-southeast-2)** → generate a strong database password (store it in your password manager) →
copy the **Project URL** and **anon (public) key** into `.env.local` → the **service_role key is secret**: it goes
only in `.env.local` and later in Vercel's encrypted settings, never in the mobile app and never in chat.
Verify with `pnpm check:env` (shows `Supabase: test`).

## 3. Mux — `NOT NEEDED YET` (Phase 2)
https://dashboard.mux.com/signup → create a **Development** environment → Settings → Access Tokens (Video
read/write) → Signing Keys (for signed playback) → Webhooks (URL I'll give you). Values go in `.env.local`:
`MUX_TOKEN_ID`, `MUX_TOKEN_SECRET`, `MUX_SIGNING_KEY_ID`, `MUX_SIGNING_PRIVATE_KEY`, `MUX_WEBHOOK_SECRET`.
Use licensed test footage only — no real children's videos until the legal gates are cleared.

## 4. Stripe — `NOT NEEDED YET` (Phase 3)
https://dashboard.stripe.com/register → stay in **Test mode** (toggle top right) → Developers → API keys
(`pk_test_…` public, `sk_test_…` secret) → Webhooks (signing secret `whsec_…`) → Settings → Tax (GST) →
Customer portal settings. Test cards only (e.g. 4242 4242 4242 4242). Live keys are only created at launch with
your approval; the app refuses to run a live key outside production.

## 5–13
I'll give the same step-by-step treatment (provider, why, link, cost, buttons, credentials, where they go, how to
verify) when each phase begins.

---

## Account setup update — end of Phase 0
- Accounts required to see what's built: **none**.
- Next account: **GitHub** (free) — steps above.
- After that: **Supabase** at the start of Phase 1.
