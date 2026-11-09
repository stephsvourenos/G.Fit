import { describe, expect, it } from "vitest";
import { renderNotice } from "../src/emails";

const ctx = { brandName: "Brand", siteUrl: "https://example.test/" };

describe("member emails", () => {
  it("trial ending states date, amount, and how to cancel (compliance)", () => {
    const e = renderNotice("trial_ending", { trial_end: "2026-11-14T02:00:00Z", amount_minor: 1499, interval: "month" }, ctx);
    expect(e.subject).toContain("free trial ends");
    expect(e.text).toContain("14 November 2026");
    expect(e.text).toContain("A$14.99 a month");
    expect(e.text).toContain("GST included");
    expect(e.text).toMatch(/cancel/i);
    expect(e.text).toContain("https://example.test/watch/account/");
  });
  it("shows the promo price and what it becomes", () => {
    const e = renderNotice("trial_started", { trial_end: "2026-11-14T02:00:00Z", amount_minor: 499, then_minor: 1499, discount_ends_at: "2027-05-07T02:00:00Z", interval: "month" }, ctx);
    expect(e.text).toContain("A$4.99 a month until");
    expect(e.text).toContain("7 May 2027, then A$14.99 a month");
  });
  it("already-cancelled trial says no charge", () => {
    const e = renderNotice("trial_ending", { trial_end: "2026-11-14T02:00:00Z", amount_minor: 1499, cancel_at_period_end: true }, ctx);
    expect(e.text).toContain("won’t be charged");
    expect(e.text).not.toContain("we’ll charge");
  });
  it("escapes HTML and renders every kind", () => {
    for (const k of ["trial_started", "trial_ending", "membership_started", "payment_failed", "cancellation_confirmed", "membership_ended"]) {
      const e = renderNotice(k, { amount_minor: 1499 }, { ...ctx, brandName: "<b>X</b>" });
      expect(e.html).toContain("&lt;b&gt;X&lt;/b&gt;");
      expect(e.html).not.toContain("<b>X</b>");
      expect(e.subject.length).toBeGreaterThan(5);
    }
  });
  it("refuses unknown kinds", () => {
    expect(() => renderNotice("marketing_blast", {}, ctx)).toThrow();
  });
});

describe("email layout", () => {
  it("has no runs of blank lines and links the welcome button to workouts", () => {
    const e = renderNotice("membership_started", { amount_minor: 499 }, ctx);
    expect(e.text).not.toMatch(/\n\n\n/);
    expect(e.text).toContain("Start a workout: https://example.test/watch/");
  });
});
