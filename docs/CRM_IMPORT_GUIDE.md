# Importing creator research into the CRM

_For the owner. Last updated 26 Nov 2026._

> **Real prospect data waits for the live database.** The CRM is on the test system for now. Use the test system with
> a small fictional file to get comfortable, then import real research once the production database (Supabase Pro) is
> set up.

## 1. Ask ChatGPT Work for the right file

Download the blank template first: **Admin → Creator Acquisition → Import prospects → “Download the blank template”**.
Give it to ChatGPT Work with this request (copy and adjust):

> Research fitness creators for G.Fit and give me a **CSV file (UTF-8)** using **exactly the column headings in the
> attached template**, one row per creator. Rules:
> - If you don't know something, **leave the cell empty**. Don't write 0, "no" or a guess.
> - Profile columns (`instagram_url`, `tiktok_url`, `youtube_url`, `facebook_url`, `linkedin_url`, `website_url`) are
>   full links starting with https://. A YouTube link should be the channel page.
> - `public_business_email` only if the creator publishes it for business enquiries. Put the page where you found it
>   in `contact_source_url`.
> - Dates as YYYY-MM-DD. Set `research_date` to the day you checked the information.
> - Score each criterion out of its maximum: `existing_content_score` /25, `audience_engagement_score` /20,
>   `monetisation_score` /20, `promotion_potential_score` /20, `qualification_quality_score` /10,
>   `catalogue_gap_score` /5. `confidence_level` is high, medium or low.
> - `primary_category` should be one of: Pilates and barre; Strength and personal training; Dance fitness; Yoga and
>   mobility; HIIT and cardio; Kids and family fitness; Low-impact and over-50s fitness; Prenatal and postnatal fitness;
>   Sport-specific conditioning (or say what it is if none fit).
> - `specific_personalisation_detail` must be a real, checkable detail about their content (it goes into messages).
> - Only adults, and only public business information. No private accounts, personal phone numbers or home addresses.
> - Leave `recruitment_status`, `assigned_to` and `notes` empty unless I ask.

Several files are fine (for example one per category). An Excel workbook with several worksheets works too.

## 2. Import it

1. **Admin → Creator Acquisition → Import prospects → Choose a CSV or Excel file.** For a workbook, tick the worksheets
   you want.
2. **Match columns.** Columns with the template's headings are matched automatically. Check the rest, or set them to
   “Ignore this column”.
3. **Choose what happens to creators already in the CRM:**
   - *Import new records only* skips them.
   - *Fill in fields we don't know yet* (recommended) adds missing facts only.
   - *Update research with newer information* overwrites researched facts, but only when this file's `research_date` is
     the same as or newer than ours.

   Whichever you pick, an import **never** changes a creator's stage, notes, messages, assignment or do-not-contact.
4. **Possible duplicates:** choose *Let me review each one* (recommended). These are rows that share an email, website or
   name with someone already in the CRM but have no matching profile, often a different instructor at the same studio.
   For each one, choose skip, “different person” or “same person — fill blanks”.
5. **Check & review** shows how many rows are new, updated, skipped or can't be imported, plus a preview.
   - Unreadable values (such as “lots” in a follower count) are left as unknown and listed in the report.
   - A row with no name can't be imported.
6. **Import now.** Keep the page open until it finishes, then download the **import report** if anything was skipped or
   failed.
7. Go to **Today's Tasks**. The best new creators to contact are at the top, with the reasons they were picked.

Importing the same file again is safe: everyone already in the CRM is recognised and nothing is duplicated.

## 3. Each morning

**Today's Tasks** lists, in order:
1. replies to answer
2. follow-ups that are due
3. today's best new creators (50 by default; change it on the page or in Settings)
4. overdue tasks

For each creator: **Contact…** → review the message → **Copy message** → **Open Instagram/TikTok** → send it yourself →
**I've sent it**. That logs the message and schedules the follow-up (4 days, then 7). Opening or copying logs nothing.
Keys: `j`/`k` move, `c` contact, `o` open profile, `r` record reply, `f` follow-up, `n` note, `s` snooze.

When someone replies, use **Record reply**:
- **Interested** moves them to Interested and gives you a reply task.
- **Not interested** closes them.
- **Do not contact** removes them from every queue, permanently (only an admin can undo it).

## 4. Before the first real import

- Add your name in **Settings → Founder's name**. Templates sign off with it, and messages can't be copied while it's
  missing.
- Optionally add a founding creator application link in Settings. Until personal links arrive (Phase 2), the
  “interested” and “invitation” templates ask you to fill this in.
- Give anyone helping you the **Recruiter** role. They can research and contact creators but can't export data,
  change settings or see the rest of Admin.

## 5. If something goes wrong

| What you see | What to do |
|---|---|
| “Old .xls files aren't supported” | In Excel: File → Save As → Excel Workbook (.xlsx) or CSV UTF-8 |
| Names with odd characters | Save the file as **CSV UTF-8** and import again |
| Lots of “possible duplicates” | Normal for studios that share one email or website; review them or choose “Skip possible duplicates” |
| Category “doesn't match a founding category” | Fine: they're still imported. Edit the category on their profile, or add the category in Settings |
| “Before emailing, confirm the address is published…” | Check the Contact tab's source link, then tick the box in the message window |
| “Already contacted on … within the last 3 days” | Stops double messages. If you really sent another, confirm again |
