# G.Fit public website: audit and integration plan

_22 Nov 2026. Source: the ChatGPT prototype (`gfit-complete-website-preview.html`) and its brief (`CLAUDE_CODE_HANDOFF.md`). Repo checked at commit `f531542` (13 Nov)._

## Progress
- **22 Nov:** stages 1–4 are done and live on the test site. The public catalogue migration was applied and passes
  11/11 checks. Next.js was upgraded to 16.4.6 and the server bundle redeployed.

## 1. What exists today (audit)
| Area | Current state | Effect on the new website |
|---|---|---|
| Framework | Next.js 16 app in `apps/web`. The website, member app, admin and creator portal are one deployable, and Vercel auto-deploys `main`. | The prototype's hash router (`#/workouts`) is replaced by real URLs. Public pages live in the `(site)` route group, which shares one header and footer. |
| Sign-in | Supabase Auth: `/account/sign-in`, `sign-up`, `forgot`, `reset` | Unchanged. Only the sign-up wording now puts individuals first. |
| Signed-in app | `/watch/*`: profiles, PIN, home, search, workout, instructor, play, account | Playback, PIN and age checks are untouched. The first-run box now says "Create your profile". `/watch/home` restyle is stage 7. |
| Billing | Stripe test mode with hosted Checkout and Portal. Monthly **A$14.99**, annual **A$149.99**, 7-day trial with card required, FOUNDER and LAUNCH codes | Same terms as the prototype. Website prices come from one file (`packages/config/src/plans.ts`) that mirrors Stripe. Checkout always charges what Stripe says. |
| Stripe Connect | **Not used.** Creators are paid by ANZ ABA file with maker/checker approval. | Nothing to connect. |
| Royalties and referrals | Paid-viewing minutes, append-only ledger, month-end runs, `/r/[code]` links | Unchanged |
| Catalogue | `workouts` (category, duration, intensity, equipment, age bands, captions, publish gate) and `instructors` | Today only signed-in users can read it. The new migration adds read-only public views of published metadata. |
| Categories | soccer, pilates, move-and-play, dance, strength, mobility, challenges | Yoga and cardio aren't categories yet. Add them when real content needs them. Kids and teens are age filters, not categories. |
| Programmes | Don't exist | Stage 5 (included only) |
| Child safety | Age bands, intensity caps, parent PIN, signed playback | Unchanged. Public pages never name junior coaches or show anything about members. |
| Indexing | None | `robots.txt`, `sitemap.xml`, canonical URLs, unique metadata and JSON-LD added. **The test site stays noindex.** |
| Analytics | None | Stage 6: a first-party events table in Supabase, so no paid service |
| Email/contact | No email provider (waits for the domain, D6) | The contact page says the inbox opens at launch. No dead form. |

## 2. Prototype page → real route
| Prototype | Real route | Data |
|---|---|---|
| Home | `/` | Live workouts and instructors, plus prices from `plans.ts` |
| Workouts | `/workouts` | Public view. Every card is in the page HTML, and filters run in the browser |
| Workout detail | `/workouts/[slug]` | Public view. No public video previews (there's no preview-rights flag yet) |
| Instructors | `/instructors`, `/instructors/[slug]` | Adult instructors with published work. Consented portrait or an illustration |
| Programmes | `/programmes` ("coming soon"), later `/programmes/[slug]` | Stage 5 |
| Pricing | `/pricing` | Prices plus the full trial and renewal disclosure |
| Individuals & families | `/everyone` | Static |
| Join | `/join` → `/account/sign-up` → create profile → Stripe Checkout | The plan chosen on `/join` carries through to checkout |
| My fit (demo) | `/watch/home` | Existing member app |
| Help, About, Teach, Contact | `/support`, `/about`, `/teach`, `/contact` | Static, accurate to what's built |
| Privacy, Terms | `/legal/privacy`, `/legal/terms` | Marked "draft under legal review" until the lawyer's text is in |

## 3. New pieces that need approval
1. **Public catalogue views** (migration `20261122090000_public_catalogue.sql`, written, not applied). It adds instructor slugs plus `public_workouts` and `public_instructors`: published AU workouts only, adult coaches only, and no playback IDs, rights or payee data. Includes `tests.run_public_catalogue_checks()`.
2. **Programmes** (migration plus admin screen). A programme is an ordered list of workouts. **Every programme is included in the membership.**
3. **One-time programme purchases: never** (owner, 22 Nov). Nothing on G.Fit is sold separately.
4. **First-party analytics** (migration). Category view, instructor view, sign-up started/completed, trial started, paid activation, first completed workout and referral conversion. It stores no names or emails, and nothing from child profiles beyond an age band.

## 4. Changes from the prototype (decided 22 Nov)
- **Look:** the prototype's layout with the owner's fonts (Bricolage Grotesque, Atkinson Hyperlegible) and colours.
- **Comparison prices** (A$19.99 one instructor, A$19 one programme): **kept, by the owner's choice**. They're labelled "Illustrative example price, not a quote from any instructor". **Ask the lawyer to check this under Australian Consumer Law.**
- **No stock photos** (the prototype used Unsplash, including children). The site uses workout artwork, consented coach photos and our own illustrations.
- **No "demo"/"illustrative" labels** on real content. Honest empty states are shown where there's nothing yet.
- **Positioning:** individual-first, with household optional. This replaces the 7 Nov "whole households, like Netflix" line.
- **Junior coaches** are never named or given pages publicly. Their workouts show "G.Fit junior coach".
- **FAQs** match what's built: no add-ons, casting works, phone apps aren't public yet, the real cancellation steps.

## 5. Build stages
1. ✅ Look and frame: header, footer, real URLs, metadata, robots/sitemap (noindex on test).
2. ✅ Public catalogue: pages built and migration applied (22 Nov).
3. ✅ Home, pricing, individuals & families, individual-first join and sign-up.
4. ✅ Support/FAQ, about, teach, contact, legal (marked draft).
5. ◐ Programmes: admin screen and pages built; migration `20261122100000_programmes.sql` waiting for approval.
6. Analytics events and an Admin → Reports panel.
7. Signed-in discovery home restyle, then a full mobile and desktop test pass and the written report.

## 6. What the owner needs to provide, and when
- **Stage 5/6:** the same approval for the programmes and analytics migrations.
- **At launch:** set `NEXT_PUBLIC_SITE_URL` and `NEXT_PUBLIC_SITE_INDEXABLE=1` on the production Vercel project only.
- **Before launch:** a support email (after the domain and Resend, D6), the lawyer-reviewed legal text (including the comparison prices), real instructors and workouts (D5), and the production go-ahead.
