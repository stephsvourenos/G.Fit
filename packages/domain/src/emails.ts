/**
 * Member emails — the words families receive about their membership. Pure functions (no sending),
 * so every template is unit-tested and the server uses exactly this code.
 *
 * These are transactional messages about an existing membership (no marketing), so they carry no
 * unsubscribe link, but every one says who sent it and how to manage or cancel.
 */

export type NoticeKind =
  | "trial_started"
  | "trial_ending"
  | "membership_started"
  | "payment_failed"
  | "cancellation_confirmed"
  | "membership_ended";

export interface EmailContext {
  brandName: string;
  siteUrl: string;
  supportEmail?: string;
}

export interface RenderedEmail {
  subject: string;
  text: string;
  html: string;
}

const TZ = "Australia/Sydney";
const day = (iso?: unknown) =>
  typeof iso === "string" && iso
    ? new Date(iso).toLocaleDateString("en-AU", { timeZone: TZ, weekday: "long", day: "numeric", month: "long", year: "numeric" })
    : "the end of your current period";
const aud = (m?: unknown) => (typeof m === "number" ? `A$${(m / 100).toFixed(2)}` : "your plan’s price");
const per = (i?: unknown) => (i === "year" ? "year" : "month");
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** "A$4.99 a month until 7 May 2027, then A$14.99 a month" — or just "A$14.99 a month". */
function pricePhrase(d: Record<string, unknown>) {
  const p = per(d.interval);
  const now = aud(d.amount_minor);
  if (typeof d.then_minor === "number" && typeof d.amount_minor === "number" && d.then_minor !== d.amount_minor) {
    const until = typeof d.discount_ends_at === "string" ? ` until ${day(d.discount_ends_at)}` : "";
    return `${now} a ${p}${until}, then ${aud(d.then_minor)} a ${p}`;
  }
  return `${now} a ${p}`;
}

interface Part { p?: string; button?: [string, string] }

function build(subject: string, parts: Part[], ctx: EmailContext): RenderedEmail {
  const account = `${ctx.siteUrl.replace(/\/$/, "")}/watch/account/`;
  const footer = `You’re receiving this because you have a ${ctx.brandName} family membership. Manage or cancel anytime: ${account}` +
    (ctx.supportEmail ? ` · Questions? ${ctx.supportEmail}` : "");
  const text = [
    ...parts.map((x) => (x.p ? x.p : x.button ? `${x.button[0]}: ${x.button[1]}` : "")),
    "",
    "—",
    footer,
  ].join("\n\n");
  const html =
    `<!doctype html><html><body style="margin:0;background:#f4f5f7;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#0e1116">` +
    `<div style="max-width:560px;margin:0 auto;padding:24px"><div style="background:#fff;border-radius:16px;padding:28px">` +
    `<div style="font-weight:700;font-size:18px;margin-bottom:16px">${esc(ctx.brandName)}</div>` +
    parts
      .map((x) =>
        x.p
          ? `<p style="font-size:16px;line-height:1.5;margin:0 0 14px">${esc(x.p)}</p>`
          : x.button
            ? `<p style="margin:20px 0"><a href="${esc(x.button[1])}" style="background:#0e1116;color:#fff;text-decoration:none;padding:12px 20px;border-radius:999px;font-weight:600;display:inline-block">${esc(x.button[0])}</a></p>`
            : "",
      )
      .join("") +
    `</div><p style="font-size:12px;color:#6b7280;line-height:1.5;padding:12px 8px">${esc(footer)}</p></div></body></html>`;
  return { subject, text, html };
}

export function renderNotice(kind: string, detail: Record<string, unknown>, ctx: EmailContext): RenderedEmail {
  const account = `${ctx.siteUrl.replace(/\/$/, "")}/watch/account/`;
  const b = ctx.brandName;
  switch (kind as NoticeKind) {
    case "trial_started":
      return build(`Your ${b} free trial has started`, [
        { p: "Hi there," },
        { p: `Your free trial has started — every workout is unlocked for your whole family until ${day(detail.trial_end)}.` },
        { p: `After that, your membership costs ${pricePhrase(detail)} (GST included), charged to the card you added, and renews until you cancel.` },
        { p: `Not for you? Cancel before ${day(detail.trial_end)} in your family account and you won’t be charged anything. We’ll also remind you a few days before the trial ends.` },
        { button: ["Manage membership", account] },
      ], ctx);
    case "trial_ending":
      return build(`Reminder: your ${b} free trial ends ${day(detail.trial_end)}`, [
        { p: "Hi there," },
        { p: `Your free trial ends on ${day(detail.trial_end)}.` },
        detail.cancel_at_period_end
          ? { p: "You’ve already cancelled, so you won’t be charged. Videos keep working until the trial ends." }
          : { p: `Unless you cancel before then, your membership will start and we’ll charge ${pricePhrase(detail)} (GST included) to the card you added. It renews until you cancel.` },
        detail.cancel_at_period_end
          ? { p: "Changed your mind? You can restart your membership from your family account." }
          : { p: "To cancel, open your family account and choose “Manage membership” — it takes a minute and costs nothing during the trial." },
        { button: ["Manage membership", account] },
      ], ctx);
    case "membership_started":
      return build(`Welcome to ${b} — your membership is active`, [
        { p: "Hi there," },
        { p: `Thanks for joining! We’ve received your payment of ${aud(detail.amount_minor)} (GST included) and your family membership is active.` },
        { p: `It renews every ${per(detail.interval)}${detail.period_end ? ` (next on ${day(detail.period_end)})` : ""} until you cancel. Your tax invoice is available in your family account under “Manage membership”.` },
        { button: ["Start a workout", account] },
      ], ctx);
    case "payment_failed":
      return build(`Action needed: your ${b} payment didn’t go through`, [
        { p: "Hi there," },
        { p: `We couldn’t take your payment of ${aud(detail.amount_minor)}. This usually means the card has expired or the bank declined it.` },
        { p: `Videos keep working for a few days while you sort it out.${detail.next_attempt ? ` We’ll try again on ${day(detail.next_attempt)}.` : ""} Please update your card in your family account.` },
        { button: ["Update card", account] },
      ], ctx);
    case "cancellation_confirmed":
      return build(`Your ${b} membership has been cancelled`, [
        { p: "Hi there," },
        { p: detail.trialing
          ? `Your free trial has been cancelled and you won’t be charged. Videos keep working until ${day(detail.access_until)}.`
          : `Your membership has been cancelled and won’t renew. Videos keep working until ${day(detail.access_until)}, and you won’t be charged again.` },
        { p: "Changed your mind? You can undo this in your family account before then." },
        { button: ["Manage membership", account] },
      ], ctx);
    case "membership_ended":
      return build(`Your ${b} membership has ended`, [
        { p: "Hi there," },
        { p: `Your family membership ended on ${day(detail.ended_at)} and videos are now paused. Your family’s profiles are kept, so you can pick up where you left off.` },
        { button: ["Rejoin", account] },
      ], ctx);
    default:
      throw new Error(`No email template for "${kind}"`);
  }
}
