import { describe, expect, it } from "vitest";
import {
  AppendOnlyLedger,
  allocateByWeight,
  applyRate,
  approveBatch,
  attributeConversion,
  buildStatement,
  chargeForCycle,
  commissionForHousehold,
  computePayable,
  confirmPaid,
  createPayoutBatch,
  DEFAULT_NET_RECEIPTS_POLICY as NET,
  invoiceNetMinor,
  markExported,
  payoutDueDate,
  recogniseInvoice,
  royaltyEligibleInMonth,
  runMonthEnd,
  type Attribution,
  type LedgerEntry,
  type PayoutBatch,
  type Price,
} from "../src";
import { contract, invoice, view } from "./fixtures";

const NOW = "2026-12-01T00:00:00Z";

describe("money", () => {
  it("allocation always sums exactly and is deterministic", () => {
    const parts = allocateByWeight(1000, [
      { key: "a", weight: 1 },
      { key: "b", weight: 1 },
      { key: "c", weight: 1 },
    ]);
    expect([...parts.values()].reduce((a, b) => a + b, 0)).toBe(1000);
    expect(parts.get("a")).toBe(334);
    expect(parts.get("b")).toBe(333);
  });

  it("rates round half-up symmetrically for charges and refunds", () => {
    expect(applyRate(1308, 3000)).toBe(392);
    expect(applyRate(-1308, 3000)).toBe(-392);
    expect(applyRate(1305, 1000)).toBe(131);
  });

  it("net receipts exclude GST and fees", () => {
    expect(invoiceNetMinor(invoice("h", "2026-11"), NET)).toBe(1308);
  });

  it("an annual plan is recognised as 12 cent-exact monthly amounts", () => {
    const inv = invoice("h", "2026-11", { grossPaidMinor: 14999, serviceMonths: 12 });
    const months = recogniseInvoice(inv, NET);
    expect(months).toHaveLength(12);
    expect(months.reduce((a, m) => a + m.netMinor, 0)).toBe(invoiceNetMinor(inv, NET));
    expect(months[0]!.serviceMonth).toBe("2026-11");
    expect(months[11]!.serviceMonth).toBe("2027-10");
  });
});

describe("acceptance 2 — grandfathered and promotional pricing", () => {
  const prices: Price[] = [
    { priceId: "price_founder_999", productId: "family", amountMinor: 999, currency: "AUD", interval: "month", active: false, label: "Founder" },
    { priceId: "price_public_1499", productId: "family", amountMinor: 1499, currency: "AUD", interval: "month", active: true, label: "Family monthly" },
  ];
  it("founder keeps A$9.99, new customer pays A$14.99, promo is A$4.99 for 3 months then A$14.99", () => {
    const founder = { subscriptionId: "sub_f", householdId: "hf", priceId: "price_founder_999", startMonth: "2026-01" };
    const newbie = { subscriptionId: "sub_n", householdId: "hn", priceId: "price_public_1499", startMonth: "2026-11" };
    const promo = {
      subscriptionId: "sub_p",
      householdId: "hp",
      priceId: "price_public_1499",
      startMonth: "2026-11",
      coupon: { couponId: "LAUNCH", amountOffMinor: 1000, duration: "repeating" as const, durationInMonths: 3 },
    };
    expect([0, 5, 24].map((c) => chargeForCycle(founder, prices, c))).toEqual([999, 999, 999]);
    expect(chargeForCycle(newbie, prices, 0)).toBe(1499);
    expect([0, 1, 2, 3, 4].map((c) => chargeForCycle(promo, prices, c))).toEqual([499, 499, 499, 1499, 1499]);
  });
});

describe("acceptance 3 — referral and royalty go to different creators", () => {
  it("referrer gets 10% commission, the watched creator gets the royalty", () => {
    const contracts = [contract("referrer", { referral: { rateBps: 1000, maxPaidMonths: 120, acceptNewFromMonth: "2026-01", newReferralsPaused: false, attributionWindowDays: 30 } }), contract("coach")];
    const att = attributeConversion({
      conversion: { householdId: "A", visitorId: "v1", ownerEmailHash: "hashA", convertedAt: "2026-11-02T10:00:00Z" },
      touches: [{ code: "REF1", visitorId: "v1", at: "2026-10-25T10:00:00Z" }],
      codes: [{ code: "REF1", creatorId: "referrer", active: true }],
      contracts,
      existing: [],
      creatorEmailHashes: new Map([["referrer", ["hashR"]]]),
    });
    expect(att.ok).toBe(true);
    if (!att.ok) return;
    const run = runMonthEnd({
      month: "2026-11",
      status: "final",
      invoices: [invoice("A", "2026-11")],
      refunds: [],
      views: [view("A", "coach", "2026-11", 90)],
      contracts,
      attributions: [att.attribution],
      priorEntries: [],
      now: NOW,
    });
    const by = (creator: string, kind: string) =>
      run.entries.filter((e) => e.creatorId === creator && e.kind === kind).reduce((a, e) => a + e.amountMinor, 0);
    expect(by("referrer", "referral")).toBe(131); // 10% of A$13.08 net
    expect(by("referrer", "royalty")).toBe(0);
    expect(by("coach", "royalty")).toBe(392); // 30% of A$13.08 net
    expect(by("coach", "referral")).toBe(0);
  });
});

describe("acceptance 4 — household-balanced royalties and refund reconciliation", () => {
  it("a big, heavy-viewing household cannot swamp the pool", () => {
    const contracts = [contract("X"), contract("Y")];
    const views = [
      view("small", "X", "2026-11", 60),
      ...[1, 2, 3, 4, 5].map((i) => view("big", "Y", "2026-11", 600, `big-p${i}`)),
    ];
    const run = runMonthEnd({
      month: "2026-11",
      status: "final",
      invoices: [invoice("small", "2026-11"), invoice("big", "2026-11")],
      refunds: [],
      views,
      contracts,
      attributions: [],
      priorEntries: [],
      now: NOW,
    });
    expect(run.royalty.byCreator.get("X")).toBe(392);
    expect(run.royalty.byCreator.get("Y")).toBe(392);
  });

  it("a refund next month reverses exactly what was earned from that invoice", () => {
    const contracts = [contract("Y")];
    const nov = runMonthEnd({
      month: "2026-11",
      status: "final",
      invoices: [invoice("big", "2026-11")],
      refunds: [],
      views: [view("big", "Y", "2026-11", 100)],
      contracts,
      attributions: [],
      priorEntries: [],
      now: NOW,
    });
    const dec = runMonthEnd({
      month: "2026-12",
      status: "final",
      invoices: [invoice("big", "2026-11")],
      refunds: [
        { refundId: "re_1", invoiceId: "in_big_2026-11", grossRefundMinor: 1499, taxRefundMinor: 136, processorFeeReturnedMinor: 0, kind: "refund", disputeFeeMinor: 0, createdAt: "2026-12-04T00:00:00Z" },
      ],
      views: [],
      contracts,
      attributions: [],
      priorEntries: nov.entries,
      now: NOW,
    });
    const adj = dec.entries.filter((e) => e.kind === "adjustment");
    expect(adj).toHaveLength(1);
    expect(adj[0]!.amountMinor).toBe(-392);
    expect(adj[0]!.reversesEntryId).toBe(nov.entries[0]!.id);
    // History is untouched: the November entry still shows +392.
    expect(nov.entries[0]!.amountMinor).toBe(392);
  });
});

describe("acceptance 5 — multi-contract month is cent-exact and reproducible", () => {
  const contracts = [
    contract("c1", { referral: { rateBps: 1000, maxPaidMonths: 120, acceptNewFromMonth: "2026-01", newReferralsPaused: false, attributionWindowDays: 30 } }),
    contract("c2", { royaltyPauses: [{ fromMonth: "2026-11", toMonth: "2026-11" }], referral: { rateBps: 1500, maxPaidMonths: 6, acceptNewFromMonth: "2026-01", newReferralsPaused: false, attributionWindowDays: 30 } }),
    contract("c3", { licenceEndMonth: "2026-10", referral: { rateBps: 500, maxPaidMonths: 24, acceptNewFromMonth: "2026-01", newReferralsPaused: false, attributionWindowDays: 30 } }),
  ];
  const attributions: Attribution[] = [
    { householdId: "annual", creatorId: "c3", code: "C3", attributedAt: "2026-06-01T00:00:00Z", contractId: "ct-c3", contractVersion: 1, terms: contracts[2]!.referral, source: "link" },
    { householdId: "m1", creatorId: "c2", code: "C2", attributedAt: "2026-11-01T00:00:00Z", contractId: "ct-c2", contractVersion: 1, terms: contracts[1]!.referral, source: "code" },
  ];
  const invoices = [
    invoice("m1", "2026-11"),
    invoice("m2", "2026-11", { grossPaidMinor: 999 }), // grandfathered founder
    invoice("annual", "2026-06", { grossPaidMinor: 14999, serviceMonths: 12 }),
    // "cancelled" household: paid October only, no November invoice
    invoice("cancelled", "2026-10"),
  ];
  const views = [
    view("m1", "c1", "2026-11", 40),
    view("m1", "c2", "2026-11", 40), // c2 is paused this month
    view("m2", "c3", "2026-11", 30), // c3 licence ended — ineligible
    view("annual", "c1", "2026-11", 20),
    view("annual", "c2", "2026-11", 60),
  ];
  const args = { month: "2026-11", status: "final" as const, invoices, refunds: [], views, contracts, attributions, priorEntries: [], now: NOW };

  it("balances to the cent and reproduces the same fingerprint", () => {
    const a = runMonthEnd(args);
    const b = runMonthEnd(args);
    expect(a.snapshot.fingerprint).toBe(b.snapshot.fingerprint);
    expect(a.royalty.allocatedMinor + a.royalty.retainedMinor).toBe(a.royalty.poolMinor);
    expect(royaltyEligibleInMonth(contracts[1]!, "2026-11")).toBe(false);
    expect(a.royalty.byCreator.get("c2")).toBeUndefined();
    expect(a.royalty.byCreator.get("c3")).toBeUndefined();
    // Every cent of the pool goes to the only eligible creator (c1).
    expect(a.royalty.byCreator.get("c1")).toBe(a.royalty.poolMinor);
    // c3's licence ended but its referral term continues (annual household, paid month 6 of 24).
    const c3ref = a.entries.filter((e) => e.creatorId === "c3" && e.kind === "referral");
    expect(c3ref).toHaveLength(1);
    expect(c3ref[0]!.memo).toContain("paid month 6 of 24");
    // The cancelled household produces nothing in November.
    expect(a.entries.some((e) => e.sourceRefs.includes("invoice:in_cancelled_2026-10"))).toBe(false);
  });
});

describe("referral rules", () => {
  const base = {
    touches: [{ code: "MIA", visitorId: "v", at: "2026-10-01T00:00:00Z" }],
    codes: [{ code: "MIA", creatorId: "mia", active: true }],
    contracts: [contract("mia")],
    existing: [] as Attribution[],
    creatorEmailHashes: new Map([["mia", ["mia-hash"]]]),
  };
  const conv = (over = {}) => ({ householdId: "h", visitorId: "v", ownerEmailHash: "x", convertedAt: "2026-10-20T00:00:00Z", ...over });

  it("attributes within the 30-day window", () => {
    expect(attributeConversion({ ...base, conversion: conv() }).ok).toBe(true);
  });
  it("rejects outside the window", () => {
    expect(attributeConversion({ ...base, conversion: conv({ convertedAt: "2026-11-15T00:00:00Z" }) })).toEqual({ ok: false, reason: "outside-attribution-window" });
  });
  it("blocks self-referral", () => {
    expect(attributeConversion({ ...base, conversion: conv({ ownerEmailHash: "mia-hash" }) })).toEqual({ ok: false, reason: "self-referral" });
  });
  it("attributes a household only once", () => {
    const first = attributeConversion({ ...base, conversion: conv() });
    if (!first.ok) throw new Error();
    expect(attributeConversion({ ...base, existing: [first.attribution], conversion: conv() })).toEqual({ ok: false, reason: "already-attributed" });
  });
  it("paused new referrals stop new attributions only", () => {
    const paused = [contract("mia", { version: 2, referral: { ...base.contracts[0]!.referral, newReferralsPaused: true } })];
    expect(attributeConversion({ ...base, contracts: [...base.contracts, ...paused], conversion: conv() })).toEqual({ ok: false, reason: "creator-not-accepting-referrals" });
  });

  it("counts only paid months — cancelling and returning does not reset or extend the clock", () => {
    const att = attributeConversion({ ...base, conversion: conv() });
    if (!att.ok) throw new Error();
    const months = ["2026-10", "2026-11", "2026-12", /* gap: cancelled */ "2027-04", "2027-05", "2027-06", "2027-07", "2027-08", "2027-09", "2027-10", "2027-11", "2027-12", "2028-01", "2028-02"];
    const receipts = months.flatMap((m) => recogniseInvoice(invoice("h", m), NET));
    const sched = commissionForHousehold(att.attribution, receipts);
    expect(sched.paidMonthsCounted).toBe(12);
    expect(sched.lines.at(-1)!.serviceMonth).toBe("2027-12");
  });

  it("a 120-paid-month founding term runs for 10 years across a price change, then stops", () => {
    const att = attributeConversion({
      ...base,
      contracts: [contract("mia", { referral: { ...base.contracts[0]!.referral, maxPaidMonths: 120 } })],
      conversion: conv(),
    });
    if (!att.ok) throw new Error();
    const receipts = Array.from({ length: 130 }, (_, i) => {
      const y = 2026 + Math.floor((9 + i) / 12);
      const m = ((9 + i) % 12) + 1;
      const month = `${y}-${String(m).padStart(2, "0")}`;
      return recogniseInvoice(invoice("h", month, { grossPaidMinor: i < 36 ? 1499 : 1799 }), NET)[0]!;
    });
    const sched = commissionForHousehold(att.attribution, receipts);
    expect(sched.lines).toHaveLength(120);
    expect(sched.remainingPaidMonths).toBe(0);
    expect(sched.lines[0]!.amountMinor).toBe(131);
    expect(sched.lines[50]!.amountMinor).toBeGreaterThan(131);
  });
});

describe("acceptance 7 — payouts", () => {
  const terms = { minPayoutMinor: 10_000, monthsAfterEarning: 3, payDay: 15 };
  const entry = (id: string, amount: number, month = "2026-11", status: "final" | "provisional" = "final"): LedgerEntry => ({
    id, creatorId: "c1", kind: "royalty", amountMinor: amount, currency: "AUD", earningMonth: month, runId: "r", runStatus: status, sourceRefs: [], contractRef: "ct", memo: "", createdAt: NOW,
  });

  it("pays on the 15th of the third month after earning", () => {
    expect(payoutDueDate("2026-11", terms)).toBe("2027-02-15");
  });

  it("under-minimum balances are carried forward, not paid", () => {
    const s = computePayable({ creatorId: "c1", ledger: [entry("e1", 4_200)], batches: [], terms, asOfDate: "2027-02-15" });
    expect(s.status).toBe("below-minimum-carry-forward");
  });

  it("provisional entries and not-yet-due entries are never paid", () => {
    const s = computePayable({ creatorId: "c1", ledger: [entry("e1", 50_000, "2026-11", "provisional"), entry("e2", 50_000, "2026-12")], batches: [], terms, asOfDate: "2027-02-20" });
    expect(s.status).toBe("nothing-due");
  });

  it("maker/checker, evidence-backed confirmation, and no double payout", () => {
    const ledger = new AppendOnlyLedger();
    ledger.append(entry("e1", 6_000, "2026-10"));
    ledger.append(entry("e2", 6_000, "2026-11"));
    const s = computePayable({ creatorId: "c1", ledger: ledger.all(), batches: [], terms, asOfDate: "2027-02-15" });
    expect(s.dueMinor).toBe(12_000);
    let batch = createPayoutBatch({ id: "b1", summaries: [s], existing: [], createdBy: "alex", now: NOW, currency: "AUD" });
    expect(() => approveBatch(batch, "alex", NOW)).toThrow(/maker\/checker/);
    batch = markExported(approveBatch(batch, "sam", NOW), "sam", NOW);
    expect(() => confirmPaid(batch, { bankReference: "", evidence: "", confirmedBy: "sam", now: NOW })).toThrow();
    batch = confirmPaid(batch, { bankReference: "CBA-123", evidence: "bank-statement-2027-02.pdf", confirmedBy: "sam", now: "2027-02-16T00:00:00Z" });
    const batches: PayoutBatch[] = [batch];
    const again = computePayable({ creatorId: "c1", ledger: ledger.all(), batches, terms, asOfDate: "2027-03-01" });
    expect(again.status).toBe("nothing-due");
    expect(() => ledger.append(entry("e1", 1, "2026-10"))).toThrow(/duplicate/);
    const st = buildStatement({ creatorId: "c1", month: "2027-02", ledger: ledger.all(), batches });
    expect(st.paidOutMinor).toBe(12_000);
    expect(st.closingBalanceMinor).toBe(0);
  });
});
