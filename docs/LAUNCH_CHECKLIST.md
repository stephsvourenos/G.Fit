# Launch checklist (go / no-go)

Tick every line before real families can pay. ✋ = you, 🤖 = me (the build agent), ⚖️ = your lawyer or accountant.

## A. Business and legal
- [ ] ✋ Final brand name, trademark check and domain (D6)
- [ ] ⚖️ Privacy policy reviewed: Australian Privacy Principles, children's data, overseas disclosure (US-hosted
      services)
- [ ] ⚖️ Membership terms reviewed: Australian Consumer Law, the free-trial and auto-renewal wording, promo terms,
      refunds
- [ ] ⚖️ Creator agreement reviewed: royalty pool, referral commission, guardian-managed child creators and
      child-employment permits per state, music rights, clause 10 (coach photo as a profile picture)
- [ ] ⚖️ Accountant: GST registration and treatment, creator withholding and ABNs, how creator payments appear in
      the books
- [ ] ✋ Business insurance (public liability / professional indemnity for fitness content)
- [ ] 🤖 Publish the final policies on the site and link them from sign-up and checkout

## B. Content
- [ ] ✋ Real workouts uploaded, approved and published (rights checklist complete for each)
- [ ] ✋ Creator contracts signed in the system, with bank details entered by creators
- [ ] ✋ Coach photos added only for coaches who signed clause 10 (Admin → Creators)
- [ ] ✋ Paid Mux plan before uploading more than 10 videos
- [ ] ✋ Safety notes reviewed by a qualified person

## C. Money
- [ ] ✋ Stripe live activated, ABN on receipts, statement descriptor set
- [ ] 🤖 Live prices, founder price and promo codes created; webhook live; portal configured
- [ ] ✋ One real A$14.99 sign-up on your own card, then refunded. Check it appears in Finance reports and the
      refund reverses correctly.
- [ ] ✋ ANZ direct entry set up; test ABA file accepted by ANZ's file checker (Phase 5 sign-off)
- [ ] ✋ Founder offer settings decided (closing date, maximum number) and whether the homepage advertises it

## D. Technology
- [ ] ✋/🤖 Production Supabase (Pro), rebuilt from the repository, all test suites passing
- [ ] 🤖 Functions deployed to production through the approval-gated workflow
- [ ] ✋ Email domain verified; 🤖 real trial-ending reminder received in your inbox (test system, allow-listed)
- [ ] ✋ `ALERT_EMAIL` set; 🤖 test alert received
- [ ] ✋ Backups: GitHub secrets added; 🤖 first backup decrypted and restored into a temporary project
- [ ] ✋ GitHub repository made private
- [ ] ✋ Leaked-password protection and staff multi-factor sign-in turned on
- [ ] 🤖 Security review re-run (docs/SECURITY_REVIEW.md); optional external penetration test
- [ ] ✋ Website on the real domain; development banner off in production
- [ ] ✋ Video plays on phone, tablet, laptop and TV (AirPlay/Chromecast) in production

## E. Apps (can follow the website launch)
- [ ] ✋ App-store billing decision made
- [ ] ✋ Apple and Google developer accounts
- [ ] 🤖 Production builds, store listings, privacy labels ("data not linked to children")

## F. Launch day
- [ ] Admin → System health shows no open problems
- [ ] Finance reports open; month-end preview scheduled
- [ ] A support email address is monitored
- [ ] Go / no-go decision recorded in BUILD_STATUS
