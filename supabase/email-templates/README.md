# Account email templates

Paste these into **Supabase → gfit-dev-sydney → Authentication → Emails → Templates** (one-off; repeat for the
production project at launch).

| Template in Supabase | Subject line | Body (paste the whole file, in the Source/HTML view) |
|---|---|---|
| Confirm signup | `Confirm your email for G.Fit` | `confirm-signup.html` |
| Reset password | `Reset your G.Fit password` | `reset-password.html` |
| Change email address | `Confirm your new email for G.Fit` | `change-email.html` |

"G.Fit" is the working name. When the brand is final, find-and-replace it in these files and re-paste.
Keep `{{ .ConfirmationURL }}` and `{{ .NewEmail }}` exactly as written — Supabase fills them in.

On the free plan Supabase only emails members of your Supabase team, a few per hour. A transactional email
provider (Phase 6) removes that limit and lets emails come from your own domain.
