# Review of the master brief — gaps, risks and fixes

**Overall verdict:** the brief is unusually strong and the core theory is sound. A curated, parent-led, no-social
family service with a household-balanced creator pool is a defensible model. The issues below are mostly *missing
decisions* and *commercial/legal exposure*, not flaws in the concept. Each has a recommended solution; where the
solution is code, it's already built into Phase 0 or scheduled in the plan.

Severity: 🔴 could sink economics or launch · 🟠 must be resolved before a specific phase · 🟡 worth deciding early.

---

## 1. 🔴 App-store fees can silently eat the creator model
**Issue.** If Apple/Google require in-app purchase for mobile sign-ups, they take a 15–30% commission. The brief
treats this as a compliance gate, but it is equally an *economics* gate: royalties and referrals are calculated on
net receipts, so every IAP sale shrinks creator pay and your margin. The legal landscape is moving (a 2025 US court
order forced Apple to allow commission-free web-payment links for the US storefront; an Australian Federal Court
judgment in the Epic case in Aug 2025 went against Apple and Google, but Australian remedies were still unsettled
when last checked). None of this can be assumed for Australia.

**Solution (built + planned).**
- Billing is provider-agnostic (`BillingProvider`: stripe / apple_iap / google_play / manual_grant). Profiles,
  entitlements and creator accounting don't care where the money came from.
- `platformFeeMinor` is already deducted in the versioned net-receipts policy, so IAP sales are paid out correctly.
- Launch **web-first for purchase**; mobile apps are **sign-in only** (the mobile prototype has no price, paywall or
  link to checkout). `docs/APP_STORE_BILLING_DECISION.md` is opened as a Phase 6 gate with current official sources.
- Model both scenarios (web-only vs. IAP) in the pricing decision before launch.

## 2. 🔴 The creator payout stack needs a unit-economics check
**Issue.** Per A$14.99 monthly member (sample): A$1.36 GST + ~A$0.55 card fees ⇒ **A$13.08 net**. 30% pool =
A$3.92; a 10% referral = A$1.31. That leaves ~A$7.85 for video delivery, hosting, support, marketing, content
production and profit — workable, but founding creators on **10% for 120 paid months** compound into a large
long-term liability, and an IAP sale (−15–30%) would reduce what's left sharply.

**Solution.**
- All rates/terms are data-driven per contract version (built) — nothing is hard-coded.
- Before signing founding contracts, run the 10-year simulation (already in tests) against your real price and
  churn assumptions; consider a lifetime cap per creator, or tapering rates after year 3.
- Contracts must allow **negative balances to be offset** against future earnings when a refund lands after a
  payout (the ledger already carries negative balances forward and never "pays" a negative amount).

## 3. 🔴 Founder-children as paid creators need legal, tax and child-employment structure
**Issue.** Contracts with minors are generally voidable, NSW child-employment rules apply to children in
entertainment/content work (the Children's Guardian Act's Part 6 now expressly covers entertainment and exhibition
work for under-16s), and paying the founder's own children from a shared royalty pool is a related-party
arrangement other creators may scrutinise.

**Solution (partly built).**
- Creator records support `guardianManaged`: the parent/guardian signs and is the payee; statements and payouts go
  to them, never to the child (built in contracts, admin and creator portal).
- Publishing is blocked for any workout with a minor instructor until guardian consent / child-employment
  requirements are ticked off (built into the publish gate and tested).
- Get advice before filming: employer authority / code of practice obligations, a trust or savings arrangement
  for the child's earnings, tax treatment, and a written related-party disclosure in the creator terms.

## 4. 🟠 Australia's Children's Online Privacy Code lands in weeks
**Issue.** The OAIC must register the Code by **10 December 2026**. It applies to online services *likely to be
accessed by children* — this service plainly is. Final obligations aren't known yet, but the exposure draft points
to tougher defaults (data minimisation, high-privacy defaults, limits on profiling children).

**Solution.** The design already collects the minimum for children (nickname, emoji avatar, age band, interests —
no DOB, email, photo or payment details), keeps recommendations simple and non-commercial, and keeps child
identifiers out of analytics/marketing. Phase 1 adds a privacy impact assessment; re-check against the final Code
when registered (a Phase 6 launch gate).

## 5. 🟠 "Household-balanced" needed a precise definition — now defined
**Issue.** The brief asked for a household-balanced pool but didn't define it, and the definition drives every
creator payment.

**Solution (built, tested).** "User-centric" allocation: each household's royalty share (30% of *its own* net
receipts that month) is split only among the creators *that household* watched, in proportion to its qualified
minutes. Defined policies for: households that watched nothing (redistribute pro-rata, or retain), paused/ended
licences (share goes to the other creators that household watched), rounding (largest-remainder, zero residue),
refunds (reversing entries). A 5-profile heavy household and a 1-profile light household paying the same price
generate the same royalty pool — proven in the tests.

**A useful consequence:** under this model, fake viewing can only redirect the faker's *own* subscription money.
Paying A$14.99 to steer at most ~A$3.92 is unprofitable, so the anti-fraud engine can stay lightweight (it's built,
but needn't grow into heavy surveillance — good for privacy too).

## 6. 🟠 Families exercise in the living room, not on a phone
**Issue.** The brief covers phone, tablet and web but not the TV. For family workouts, casting is close to essential.

**Solution.** Add AirPlay and Chromecast support to the Phase 2 player definition-of-done (Mux supports both).
Dedicated TV apps can wait until after launch.

## 7. 🟠 A Netflix-style UI needs a minimum library
**Issue.** Row-based browsing looks empty with 20 videos spread across six age bands.

**Solution.** Rows hide automatically when empty (built). Set a launch content target (suggest ≥ 60 workouts with
≥ 10 per age band) and a production schedule in the content plan — this is a business decision, listed in
DECISIONS_REQUIRED.

## 8. 🟠 Maker/checker payouts need two people
**Issue.** The brief wants one non-technical operator *and* maker/checker payouts — those conflict.

**Solution.** A limited "finance approver" role for your bookkeeper/accountant (approve batches only, no content or
customer access). Decision required by Phase 5.

## 9. 🟠 Australian tax on creator payments
**Issue.** Not in the brief: GST on royalties paid to GST-registered creators (often via recipient-created tax
invoices), and no-ABN withholding rules for suppliers who don't quote an ABN.

**Solution.** The ledger and statements will carry GST and withholding fields in Phase 4; confirm treatment with
your accountant before the first live payout (Phase 5 gate).

## 10. 🟡 Where the code lives
**Issue.** The brief assumes Claude Code running on your PC. This build runs in a secure cloud workspace, so the
code needs a permanent home you own.

**Solution.** A free private **GitHub** repository (next action — see ACCOUNT_SETUP.md). It's also how the website
will later deploy. Until then you receive the code as a downloadable zip plus a live preview link.

## 11. 🟡 Smaller items to decide (defaults proposed)
| Topic | Default I'll use unless you say otherwise |
|---|---|
| Offline downloads | Not in MVP (adds DRM and licensing complexity) |
| Captions | Required for every published workout at launch |
| Accessibility target | WCAG 2.2 AA on web; platform accessibility APIs on mobile |
| Max profiles per household | 6 |
| Payout currency | AUD only at launch; FX built later |
| Raw heartbeat retention | 90 days, then delete; keep only aggregated qualified minutes |
| Insurance | Public/product liability + professional indemnity before launch (operational) |
| Exercise disclaimers | Shown on each workout + in Terms (legal review) |
| Hosting | Vercel (web), Supabase Sydney region (data), Expo EAS (mobile builds) |

---

### What I'd keep exactly as written
Curated-only content, no social features, parent PIN, Stripe as billing source of truth, append-only ledger with
versioned contracts, signed video playback, mock-first development, and the phased account onboarding. These are
the right calls.
