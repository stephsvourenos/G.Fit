// Close a family account properly:
//   1. cancel the Stripe subscription straight away (so nobody is charged after closing),
//   2. delete the login and everything personal, keeping anonymous financial and viewing records
//      (tax law; creator royalty statements) — see migration close_account_keeps_records.
// The website asks the parent to confirm first and explains there's no refund for remaining time.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { ANON_KEY, asServer, asUser, cors, json, serverError, SUPABASE_URL } from "../_shared/http.ts";
import { stripe } from "../_shared/stripe.ts";

const LIVE = new Set(["active", "trialing", "past_due", "unpaid", "incomplete", "paused"]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const auth = req.headers.get("Authorization") ?? "";
    const me = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: ANON_KEY, Authorization: auth } }).then((r) => r.json());
    if (!me?.id) return json({ error: "Please sign in first" }, 401);
    const { confirm } = await req.json().catch(() => ({}));
    if (confirm !== "CLOSE") return json({ error: "Confirmation missing" }, 400);

    const hh = (await asUser(auth, `households?owner_user_id=eq.${me.id}&select=id`)).data?.[0]?.id;
    let cancelled: string | null = null;
    if (hh) {
      const ent = (await asServer(`entitlements?household_id=eq.${hh}&select=provider,provider_subscription_id,status`)).data?.[0];
      if (ent?.provider === "stripe" && ent.provider_subscription_id) {
        const sub = await stripe(`/subscriptions/${ent.provider_subscription_id}`).catch(() => null);
        if (sub && LIVE.has(sub.status)) {
          await stripe(`/subscriptions/${sub.id}`, { method: "DELETE", params: { invoice_now: false, prorate: false } });
          cancelled = sub.id;
        }
      } else if (ent && ["apple_iap", "google_play"].includes(ent.provider) && ["active", "trialing", "past_due"].includes(ent.status)) {
        return json({ error: "Your membership is billed by the app store. Cancel it in your phone’s subscription settings first, then close the account." }, 409);
      }
    }
    const r = await asServer("rpc/close_account_for", { method: "POST", body: JSON.stringify({ p_uid: me.id }) });
    if (!r.ok) return json({ error: r.data?.message ?? "Could not close the account" }, 409);
    return json({ ok: true, membership_cancelled: !!cancelled });
  } catch (e) {
    return serverError("close-account", e);
  }
});
