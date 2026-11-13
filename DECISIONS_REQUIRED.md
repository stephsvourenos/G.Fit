# DECISIONS_REQUIRED — only the genuinely blocking ones

Everything else has a sensible default (see `docs/BRIEF_REVIEW.md` §11) and I'll proceed with it unless you object.

| # | Decision | Blocks | My recommendation / default | Status |
|---|---|---|---|---|
| D1 | Create a private GitHub repository for the code | Start of Phase 1 | Yes — free | ✅ Done: `stephsvourenos/G.Fit` |
| D2 | Founder-children as creators: get legal + accounting advice on child-employment obligations, contract structure (guardian as party/payee), earnings held for the child, tax, and related-party disclosure | Filming/contracting with the children (not engineering) | Book the advice before any filming; engineering already supports guardian-managed creators | Open |
| D3 | Who is the second approver ("checker") for creator payouts? | Phase 5 (first live payout) | Your bookkeeper/accountant with a finance-only role | Open |
| D4 | Founding referral terms (10% for 120 paid months) — confirm, cap, or taper? | Signing founding creator contracts | Run the 10-year model at your real price/churn first; consider a lifetime cap or a taper after year 3 | Open |
| D5 | Launch content target | Phase 6 launch date | ≥ 60 workouts, ≥ 10 per age band, all captioned (needs a paid Mux plan past 10 videos) | Open |
| D7 | Show the founder price (A$9.99 locked) on the public homepage, or keep it a code you hand out? | Website pricing section | Your call; homepage currently shows A$14.99 / A$149.99 + "Have an offer code?" | Open (asked 10 Nov) |
| D8 | Founder offer limits: closing date and maximum founders | Launch | Set in Admin → Plans & pricing | Open |
| D6 | Brand name | App-store listings & domain (Phase 6) | Working name **G.Fit** (8 Nov 2026) — confirm final name + trademark check before app-store listings and buying the domain; it's one config value | Working name set |

Defaults I'm using now (no action needed): AUD/Australia first; prices A$14.99 monthly / A$149.99 annual; max 6 profiles; Supabase in Sydney; mobile apps sign-in only until the app-store billing decision;
heartbeat data kept 90 days; captions required at launch; no offline downloads in MVP.

## Decided
| Date | Decision | Detail |
|---|---|---|
| 7 Nov 2026 | **No Stripe Tax** | Prices are set GST-inclusive in Stripe; GST is recorded as 1/11 of each payment for reporting. Revisit only if selling outside Australia. |
| 7 Nov 2026 | **Bank: ANZ** | Creator payouts by ABA direct-entry file, maker/checker approval. |
| 8 Nov 2026 | **Working name G.Fit** | Final name and trademark check still open (D6). |
| 9 Nov 2026 | **Founder price A$9.99/month, locked** | Code FOUNDER, monthly only, kept for as long as the membership continues. |
| 9 Nov 2026 | **Promo codes LAUNCH499 and LAUNCH999** | A$4.99 or A$9.99 a month for 6 months, then A$14.99; monthly, new members only; checked by our server. |
| 10 Nov 2026 | **Colour scheme and profile pictures** | Palette from your reference; 58 original illustrated pictures (no real people). |
| 10 Nov 2026 | **Whole-family positioning** | G.Fit is for the whole household, like Netflix; adults are full members. |
| 11 Nov 2026 | **Coach photos as profile pictures** | Only with the coach's written consent (creator agreement clause 10, optional), adults only, removable at once. |
| 7 Nov 2026 | **Free trial: yes, compliant** | 7 days, card required (cards / Apple Pay / Google Pay only), one per family and per card, both plans. Terms shown before sign-up; cancel online anytime (no charge during trial); reminder queued before the trial ends; trial viewing excluded from royalties. Length is one setting (`TRIAL_DAYS`). |

## New for Phase 4 (7 Nov 2026)
- **Accountant: GST and withholding on creator payments.** Are royalties/referral payments to creators taxable supplies
  (if the creator is GST-registered we may need recipient-created tax invoices)? Any PAYG withholding where a creator has
  no ABN? For under-18 creators paid via a guardian, whose income is it? Statements currently say "being confirmed".
- ✅ **Founder / promo pricing** decided 9 Nov (see Decided) and proven with Stripe test clocks.
- **Real contract terms** for your first creators (rate, paid-month limit, licence length, minimum payout).

## New for Phase 5 (7 Nov 2026)
- ✅ **Bank: ANZ** (7 Nov 2026). ANZ Internet Banking for Business: any 6-digit User ID you choose, no balancing line,
  business name letters only; upload via Payments → Pay employees → Import a payroll file. Enter details in Admin →
  Configuration yourself (not in chat) and run the test file.
- **Video delivery cost** for the margin report (A$ per 1,000 minutes) — I'll fill in an estimate from Mux pricing
  when we're on a paid Mux plan; until then margin shows creator costs only.

## New for Phase 6 (11–13 Nov 2026)
- **Lawyer:** creator agreement clause 10 (coach photo as a profile picture): is unpaid use OK, and should it stay
  adults-only? Also the existing questions in the legal drafts doc.
- See also D7 and D8 above, and `docs/HANDOVER.md` §10 for the full open list.
