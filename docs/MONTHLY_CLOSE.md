# Monthly close — creator royalties, referrals and payouts

Who: someone with the **finance** (or admin) role. Payout approval needs a **second** finance person.
Where: Admin → **Royalties** (month-end), **Payouts**, **Creators & contracts**, **Referrals**.
All amounts are A$ cents in the system; statements show dollars.

## 1. Before the close (first week of the month)
- The system previews the previous month automatically on the 1st–5th. You can preview again any time.
- Admin → Subscribers → **Check with Stripe now** (makes sure every payment, refund and fee is recorded).
- Admin → Playback → **Score now** (scores any viewing still waiting).
- Contracts: if a creator's terms changed, create a **new version** (Creators & contracts) *before* finalising.

## 2. Preview and check
Admin → Royalties → choose the month → **Preview**. Check:
- **Net receipts** ≈ Stripe's net volume for the month (excl. GST and fees; annual plans count 1/12 per month).
- **Royalty pool** = 30% of net receipts; **Allocated + Kept = Pool**.
- Creators with a **paused** or **ended** licence earn no royalty that month.
- **Refund adjustments** appear in the month the refund happened (earlier months are never rewritten).
- Optional independent check (technical): `python3 scripts/verify-month-end.py YYYY-MM` must print **ALL MATCH**.

## 3. Finalise (permanent)
Type **FINALISE** and press **Finalise month**. This writes the ledger entries and each creator's statement in one step.
- Months must be finalised **in order**, and only after the month has ended.
- Final months can't be edited or deleted. Mistakes are fixed with an adjustment in a later month.
- Press **Verify it reproduces** — it re-runs the month and must say it reproduces exactly.

## 4. Pay (on or after the pay date — the 15th, three months after the earning month)
Admin → Payouts:
1. **Due today** lists each creator: *Payable now*, or *carried forward* (below their minimum, or not yet due).
2. **Create payout batch** (maker).
3. A **different** finance person presses **Approve** (checker).
4. Pay through the bank (Phase 5 adds the bank file); press **Mark exported**.
5. When the bank confirms, press **Confirm paid…** and enter the **bank reference** and the **exact total**. The system
   refuses a missing reference or a different amount.
6. If a payment fails or must be stopped before confirmation: **Cancel** with a reason — those earnings become payable
   again next time. A confirmed batch can't be cancelled, and no earning can ever be paid twice.

## 5. Statements
Creators see each month's statement in their portal (View / print → Save as PDF). Guardian-managed creators' statements
name the parent/guardian as payee. GST / withholding wording is pending accountant advice (DECISIONS_REQUIRED.md).

## If something looks wrong
Don't finalise. Re-run **Check with Stripe now** and **Score now**, preview again, and compare with Stripe's dashboard.
If a final month is wrong, record a correcting adjustment next month (ask the developer) — never edit the database.
