// Stripe → our server. Signature checked first; each event handled once; we
// re-read Stripe's current object instead of trusting the event (events can
// arrive late, twice, or out of order). A failure returns 500 so Stripe retries.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { asServer, json } from "../_shared/http.ts";
import { isProduction, queueTrialEndingNotice, syncCharge, syncInvoice, syncSubscription, verifyStripeSignature } from "../_shared/stripe.ts";

const SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? "";

Deno.serve(async (req) => {
  const payload = await req.text();
  if (!(await verifyStripeSignature(payload, req.headers.get("stripe-signature"), SECRET))) {
    return json({ error: "bad signature" }, 401);
  }
  const event = JSON.parse(payload);
  if (event.livemode && !isProduction) return json({ error: "live event refused outside production" }, 400);

  const seen = await asServer(`billing_events?event_id=eq.${encodeURIComponent(event.id)}&select=event_id`);
  if (seen.data?.length) return json({ ok: true, duplicate: true });

  const obj = event.data?.object ?? {};
  const type: string = event.type;
  let outcome = "ignored";
  try {
    if (type === "checkout.session.completed" && obj.subscription) outcome = await syncSubscription(obj.subscription);
    else if (type === "customer.subscription.trial_will_end") {
      outcome = (await syncSubscription(obj.id)) + " " + (await queueTrialEndingNotice(obj.id));
    } else if (type.startsWith("customer.subscription.")) outcome = await syncSubscription(obj.id);
    else if (type.startsWith("invoice.")) outcome = await syncInvoice(obj.id);
    else if (type === "charge.refunded") outcome = await syncCharge(obj.id);
    else if ((type.startsWith("refund.") || type === "charge.refund.updated") && obj.charge) outcome = await syncCharge(obj.charge);
  } catch (e) {
    console.error(type, e);
    return json({ error: "processing failed; Stripe will retry" }, 500);
  }

  await asServer("billing_events", {
    method: "POST",
    headers: { Prefer: "return=minimal,resolution=ignore-duplicates" },
    body: JSON.stringify({ event_id: event.id, provider: "stripe", type, object_id: obj.id ?? null, outcome }),
  });
  return json({ ok: true, outcome });
});
