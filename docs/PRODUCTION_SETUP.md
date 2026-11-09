# Setting up the live (production) environment

**Nothing here has been done yet.** Each step costs money, takes real payments or puts something in public, so each
needs your go-ahead first. The order matters. ✋ marks a step only you can do (sign-ups, payments, bank or identity
details). I do the rest once you've done yours.

## Why a separate environment
The test system (`gfit-dev-sydney`, Stripe test mode, Expo "preview") stays exactly as it is for trying things
out. Live families, real money and real creator payouts live in a completely separate copy. A mistake in testing then
can never touch a real family.

## 1. Database and server — Supabase
- ✋ Create the project **gfit-prod** in Sydney. **Recommendation: the Pro plan (≈US$25/month).** It includes daily
  backups, it never auto-pauses (free projects pause after a week without visitors), and it has more capacity.
  Point-in-time recovery is an optional extra.
- I rebuild it from the repository, the same steps rehearsed on 9 Nov (see RESTORE.md):
  - set `private.app_config.functions_url`;
  - deploy the functions;
  - run the three test suites.
- ✋ Turn on leaked-password protection and multi-factor sign-in for staff (Auth settings).
- The GitHub deploy workflow gets a separate "production" path. It deploys only when you approve each release
  (GitHub "environment" with a required reviewer), using its own access token secret.

## 2. Payments — Stripe live mode
- ✋ Activate the Stripe account for live payments. Stripe asks for business details, ABN, a bank account for payouts,
  and identity checks. Set the statement descriptor (what appears on card statements), e.g. "G.FIT".
- I recreate everything in live mode exactly as in test mode:
  - product and prices: A$14.99, A$149.99 and founder A$9.99;
  - the promo codes;
  - the customer portal settings;
  - the webhook endpoint pointing at production.
- ✋ Add the live secret key and live webhook secret to the production Supabase function secrets yourself, never in
  chat. Also set `APP_ENV=production` there; live keys are refused without it.
- ✋ Stripe → Settings → Customer emails: turn on **successful payment receipts**. These are the GST tax invoices, and
  need your ABN on them. Turn on refund emails too.
- **First real charge:** one real A$14.99 sign-up on your own card, refunded afterwards, before announcing.

## 3. Video — Mux
- ✋ A production Mux environment, on a paid plan once real viewing starts. Set its signing key and webhook secret
  as production function secrets.

## 4. Email
- ✋ Buy the domain once the name is final (decision D6).
- ✋ Create a free **Resend** account (3,000 emails a month free) and add the DNS records it shows (SPF, DKIM).
  I add DMARC guidance.
- Production secrets:
  - `RESEND_API_KEY` ✋ (you add it);
  - `EMAIL_FROM` (e.g. `G.Fit <hello@yourdomain>`);
  - `SUPPORT_EMAIL`;
  - `ALERT_EMAIL` (where problem alerts go);
  - `SITE_URL`;
  - `BRAND_NAME`.
- In the test system, add the same key plus `EMAIL_TEST_ALLOWLIST=<your email>`, so you receive real test emails
  and test families never do.

## 5. Website — Vercel
- ✋ Connect the domain in Vercel.
- Production environment variables point at gfit-prod: the Supabase URL and publishable key, and
  `NEXT_PUBLIC_BRAND_NAME`. Preview deployments keep pointing at the test system.
- Remove the yellow "Development version" banner from production. It is driven by the environment, not a code change.

## 6. Mobile apps
- Expo gets a "production" channel and builds. The preview channel stays for testing.
- ✋ Apple Developer Program (US$99/year) and Google Play Console (US$25 once), when ready to submit.
- **Gate:** the app-store billing decision (docs/APP_STORE_BILLING_DECISION.md) must be settled before any purchase
  wording appears in the apps. Until then the apps stay sign-in only.

## 7. Backups and monitoring
- Supabase daily backups (Pro).
- Our nightly encrypted copy: ✋ add `SUPABASE_DB_URL` (production) and `BACKUP_PASSPHRASE` as GitHub secrets.
- `ALERT_EMAIL` set; Admin → System health checked weekly; a restore rehearsed every 3 months.

## Rough running costs at launch (check current prices)
| Item | Cost |
|---|---|
| Supabase Pro | ≈ US$25 / month |
| Vercel | Hobby is free, but **not for commercial use** — Pro ≈ US$20 / user / month |
| Mux | pay-as-you-go by minutes delivered (set in Configuration for the margin report) |
| Resend | free up to 3,000 emails / month |
| Stripe | per transaction (card fees), no monthly fee |
| Domain | ≈ A$20–40 / year |
| Apple / Google | US$99 / year, US$25 once |
| Expo | free tier is enough for previews; production builds may need a paid plan at volume |
