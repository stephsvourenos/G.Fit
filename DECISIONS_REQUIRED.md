# DECISIONS_REQUIRED — only the genuinely blocking ones

Everything else has a sensible default (see `docs/BRIEF_REVIEW.md` §11) and I'll proceed with it unless you object.

| # | Decision | Blocks | My recommendation / default | Status |
|---|---|---|---|---|
| D1 | Create a private GitHub repository for the code | Start of Phase 1 | Yes — free | ✅ Done: `stephsvourenos/G.Fit` |
| D2 | Founder-children as creators: get legal + accounting advice on child-employment obligations, contract structure (guardian as party/payee), earnings held for the child, tax, and related-party disclosure | Filming/contracting with the children (not engineering) | Book the advice before any filming; engineering already supports guardian-managed creators | Open |
| D3 | Who is the second approver ("checker") for creator payouts? | Phase 5 (first live payout) | Your bookkeeper/accountant with a finance-only role | Open |
| D4 | Founding referral terms (10% for 120 paid months) — confirm, cap, or taper? | Signing founding creator contracts | Run the 10-year model at your real price/churn first; consider a lifetime cap or a taper after year 3 | Open |
| D5 | Launch content target | Phase 6 launch date | ≥ 60 workouts, ≥ 10 per age band, all captioned | Open |
| D6 | Brand name | App-store listings & domain (Phase 6) | Keep `PROJECT_NAME` placeholder until then — it's one config value | Open |

Defaults I'm using now (no action needed): AUD/Australia first; prices A$14.99 monthly / A$149.99 annual
(sample); max 6 profiles; Supabase in Sydney; mobile apps sign-in only until the app-store billing decision;
heartbeat data kept 90 days; captions required at launch; no offline downloads in MVP.

## Decided
| Date | Decision | Detail |
|---|---|---|
| 7 Nov 2026 | **No Stripe Tax** | Prices are set GST-inclusive in Stripe; GST is recorded as 1/11 of each payment for reporting. Revisit only if selling outside Australia. |
| 7 Nov 2026 | **Free trial: yes, compliant** | 7 days, card required (cards / Apple Pay / Google Pay only), one per family and per card, both plans. Terms shown before sign-up; cancel online anytime (no charge during trial); reminder queued before the trial ends; trial viewing excluded from royalties. Length is one setting (`TRIAL_DAYS`). |

## New for Phase 4 (7 Nov 2026)
- **Accountant: GST and withholding on creator payments.** Are royalties/referral payments to creators taxable supplies
  (if the creator is GST-registered we may need recipient-created tax invoices)? Any PAYG withholding where a creator has
  no ABN? For under-18 creators paid via a guardian, whose income is it? Statements currently say "being confirmed".
- **Founder / promo pricing (acceptance test 2).** Confirm whether you want a founder price (e.g. A$9.99 locked) and a
  launch promo (e.g. A$4.99 for 3 months) — I'll create them in Stripe test mode and test the transitions.
- **Real contract terms** for your first creators (rate, paid-month limit, licence length, minimum payout).

## New for Phase 5 (7 Nov 2026)
- **Which bank is the business account with?** Bulk payment files differ slightly by bank (e.g. whether a balancing
  line is needed). Once direct entry is switched on, enter the details in Admin → Configuration yourself — not in chat.
- **Video delivery cost** for the margin report (A$ per 1,000 minutes) — I'll fill in an estimate from Mux pricing
  when we're on a paid Mux plan; until then margin shows creator costs only.
