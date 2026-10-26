# App-store billing decision — OPEN GATE (resolve before any mobile paywall or purchase link)

**Status:** not decided. Mobile apps are **sign-in only**: no prices, no "subscribe" buttons, no links or wording
directing people to buy on the website. This is enforced in the mobile prototype.

## Why it's a gate
Apple (App Review Guideline 3.1) and Google Play (Payments policy) generally require their own in-app purchase for
digital subscriptions bought inside an app, with exceptions (e.g. Apple "reader" apps, external-link entitlements in
some regions) whose eligibility depends on the app's features and storefront. This product mixes on-demand video
(reader-like) with workout tracking, programs and badges, which may not qualify. Rules have been changing through
court cases (US 2025 injunction on link-outs; Australian Federal Court Epic judgment Aug 2025 — remedies to check).
None of this may be treated as settled for Australia.

## What will go in this document at Phase 6
1. Current text of Apple Guideline 3.1.x and any Australian-storefront entitlement, with links and dates checked.
2. Current Google Play Payments policy and any user-choice/alternative billing programs for Australia.
3. Eligibility analysis for this app, risks, and a recommendation.
4. Fallback: native IAP (StoreKit / Play Billing, optionally via RevenueCat) plugged into the existing
   `BillingProvider` abstraction; `platformFeeMinor` already flows into creator net receipts.
5. Pricing impact model (web-only vs. IAP vs. mixed).

Reader-app or external-link approval must never be represented as guaranteed.
