# Secrets, environments & rotation

- **Where secrets live:** `.env.local` (developer machine, git-ignored) and the hosting provider's encrypted
  environment-variable settings. Nowhere else — not in code, chat, email, or the mobile app.
- **Public vs secret:** anything prefixed `NEXT_PUBLIC_` / `EXPO_PUBLIC_` is visible to users by design and must
  never be a secret. Server-only keys: Supabase service role, Stripe secret, Mux secrets, webhook secrets.
- **Validation:** `pnpm check:env` reports each integration as `mock`, `test` or `live`, and fails if a live Stripe
  key is present outside production or a webhook secret is missing.
- **Rotation (do this if a key is ever exposed, and yearly anyway):**
  1. Create a new key in the provider dashboard (Stripe "Roll key", Supabase "Generate new JWT secret"/API keys,
     Mux new token/signing key, new webhook endpoint secret).
  2. Update the hosting environment variables and redeploy.
  3. Revoke the old key. 4. Note the rotation in the audit log.
- **Child data:** never sent to analytics/marketing tools; profile IDs are pseudonymous.
- **Parent PIN:** stored only as a salted, peppered hash (scrypt/argon2) on the server; attempts rate-limited.
