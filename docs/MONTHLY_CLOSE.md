# Monthly close — creator royalties, referrals and payouts

Who: someone with the **finance** (or admin) role. Payout approval needs a **second** finance person.
Where: Admin → **Royalties** (month-end), **Payouts**, **Creators & contracts**, **Referrals**, **Finance reports**.
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
4. **Make bank file…** — the screen checks every creator has bank details and warns if any were **changed in the last
   7 days**. If so, phone that creator on a number you already have (never one from an email) before continuing.
   Choose the processing date, then **Make & download file** — an `.aba` file. Upload it in your bank's bulk / direct
   entry payments area and authorise it there. (The system never moves money itself.)
   **Download .aba** gets the exact same file again later; it's fingerprinted, so any change is detected.
5. When the money has gone out: export your business account's transactions as CSV from online banking and use
   **Reconcile…**. It matches each payment by reference (`GFxxxxxx ROYALTY`) and amount — or the single bulk debit if
   your bank shows the file as one line. Then **Confirm paid…** (amount is pre-filled) and enter the **bank
   reference**. The system refuses a missing reference or a different amount.
6. If a payment fails or must be stopped before confirmation: **Cancel** with a reason — those earnings become payable
   again next time. A confirmed batch can't be cancelled, and no earning can ever be paid twice.

## 5. Statements
Creators see each month's statement in their portal (View / print → Save as PDF). Guardian-managed creators' statements
name the parent/guardian as payee. GST / withholding wording is pending accountant advice (DECISIONS_REQUIRED.md).

## If something looks wrong
Don't finalise. Re-run **Check with Stripe now** and **Score now**, preview again, and compare with Stripe's dashboard.
If a final month is wrong, record a correcting adjustment next month (ask the developer) — never edit the database.

## Monthly numbers
Admin → **Finance reports**: paying families, trials and trial conversion, monthly recurring revenue, cash in, GST,
card fees, refunds, creator costs, video delivery cost and **contribution margin**, plus how each month's new families
stay. Contribution uses the month-end figures, so it shows **preview** until the month is finalised.

## One-off setup (before the first real payout)
1. Ask your bank to switch on **direct entry / bulk payments (ABA file upload)** for the business account. They give
   you a 6-digit **Direct Entry User ID** and the exact user name.
2. Admin → **Configuration** → *Bank payment file*: enter those plus the paying account's BSB, number and name.
3. Press **Download test file** and run it through your bank's file checker (most business banking sites have one).
   Don't submit it for payment — it pays two made-up accounts $1.00 each.
4. Creators enter their own bank details in the creator portal (*Where we pay you*); you'll see them masked.
