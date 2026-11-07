import { describe, expect, it } from "vitest";
import { generateAba, parseAba, parseBankCsv, reconcileBatch, reconcilePayments, validateAbaRemitter, type AbaRemitter } from "../src/aba";

const remitter: AbaRemitter = {
  bankCode: "CBA",
  userName: "Example Fitness Pty Ltd",
  userId: "301500",
  bsb: "062-000",
  accountNumber: "12345678",
  accountTitle: "Example Fitness Pty Ltd",
  remitterName: "EXAMPLE FITNESS",
  selfBalancing: false,
};
const payments = [
  { bsb: "082-001", accountNumber: "987654321", accountTitle: "Coach Ava", amountMinor: 12_345, lodgementReference: "GFIT 2026-11 ROY" },
  { bsb: "033000", accountNumber: "1234", accountTitle: "Zoë O’Brien-Smith (guardian)", amountMinor: 10_000, lodgementReference: "GFIT 2026-11 ROY" },
];

describe("ABA bank file", () => {
  const f = generateAba({ remitter, payments, processingDate: "2027-02-15", description: "CREATOR PAY" });
  const lines = f.text.split("\r\n").filter(Boolean);

  it("every line is exactly 120 characters and ends with CRLF", () => {
    expect(lines).toHaveLength(4);
    expect(lines.every((l) => l.length === 120)).toBe(true);
    expect(f.text.endsWith("\r\n")).toBe(true);
  });

  it("descriptive record has the bank, user, ID, description and date in the right columns", () => {
    const h = lines[0]!;
    expect(h[0]).toBe("0");
    expect(h.slice(18, 20)).toBe("01");
    expect(h.slice(20, 23)).toBe("CBA");
    expect(h.slice(30, 56)).toBe("EXAMPLE FITNESS PTY LTD   ");
    expect(h.slice(56, 62)).toBe("301500");
    expect(h.slice(62, 74)).toBe("CREATOR PAY ");
    expect(h.slice(74, 80)).toBe("150227");
  });

  it("detail records: BSB with hyphen, right-justified account, code 50, cents, trace account", () => {
    const d = lines[1]!;
    expect(d.slice(1, 8)).toBe("082-001");
    expect(d.slice(8, 17)).toBe("987654321");
    expect(d.slice(18, 20)).toBe("50");
    expect(d.slice(20, 30)).toBe("0000012345");
    expect(d.slice(30, 62).trim()).toBe("COACH AVA");
    expect(d.slice(62, 80).trim()).toBe("GFIT 2026-11 ROY");
    expect(d.slice(80, 87)).toBe("062-000");
    expect(d.slice(87, 96)).toBe(" 12345678");
    expect(d.slice(96, 112).trim()).toBe("EXAMPLE FITNESS");
    expect(d.slice(112, 120)).toBe("00000000");
    // 6-digit BSB without hyphen is normalised; short account right-justified; accents/curly quotes cleaned
    expect(lines[2]!.slice(1, 17)).toBe("033-000     1234");
    expect(lines[2]!.slice(30, 62).trim()).toBe("ZOE O BRIEN-SMITH (GUARDIAN)");
  });

  it("file total record balances to the cent and counts detail records", () => {
    const t = lines[3]!;
    expect(t.slice(0, 8)).toBe("7999-999");
    expect(t.slice(20, 30)).toBe("0000022345");
    expect(t.slice(30, 40)).toBe("0000022345");
    expect(t.slice(40, 50)).toBe("0000000000");
    expect(t.slice(74, 80)).toBe("000002");
    const p = parseAba(f.text);
    expect(p.lineLengthsOk).toBe(true);
    expect(p.details.reduce((a, d) => a + d.amountMinor, 0)).toBe(p.totals.credit);
  });

  it("self-balancing adds one debit from the paying account so the file nets to zero", () => {
    const b = generateAba({ remitter: { ...remitter, selfBalancing: true }, payments, processingDate: "2027-02-15", description: "CREATOR PAY" });
    const p = parseAba(b.text);
    expect(p.details).toHaveLength(3);
    expect(p.details[2]).toMatchObject({ bsb: "062-000", accountNumber: "12345678", transactionCode: "13", amountMinor: 22_345 });
    expect(p.totals).toMatchObject({ net: 0, credit: 22_345, debit: 22_345, count: 3 });
  });

  it("refuses bad bank details, zero amounts and an empty file", () => {
    expect(validateAbaRemitter({ ...remitter, userId: "12", bankCode: "cb" })).toHaveLength(2);
    expect(() => generateAba({ remitter, payments: [{ ...payments[0]!, bsb: "12-34" }], processingDate: "2027-02-15", description: "X" })).toThrow(/BSB/);
    expect(() => generateAba({ remitter, payments: [{ ...payments[0]!, accountNumber: "1234567890" }], processingDate: "2027-02-15", description: "X" })).toThrow(/account/);
    expect(() => generateAba({ remitter, payments: [{ ...payments[0]!, amountMinor: 0 }], processingDate: "2027-02-15", description: "X" })).toThrow();
    expect(() => generateAba({ remitter, payments: [], processingDate: "2027-02-15", description: "X" })).toThrow(/No payments/);
  });
});

describe("bank confirmation reconciliation", () => {
  it("matches each payment to one statement line by reference and amount", () => {
    const csv = 'Date,Amount,Description\n15/02/2027,"-123.45",DE PAYMENT GFIT 2026-11 ROY COACH AVA\n15/02/2027,-100.00,DE PAYMENT GFIT 2026-11 ROY\n16/02/2027,-5.00,BANK FEE\n';
    const lines = parseBankCsv(csv);
    expect(lines).toHaveLength(3);
    const r = reconcilePayments(
      [
        { key: "ava", amountMinor: 12_345, lodgementReference: "GFIT 2026-11 ROY" },
        { key: "zoe", amountMinor: 10_000, lodgementReference: "GFIT 2026-11 ROY" },
      ],
      lines,
    );
    expect(r.allMatched).toBe(true);
    expect(r.matchedTotalMinor).toBe(22_345);
  });

  it("reports a missing payment (e.g. one rejected by the bank)", () => {
    const r = reconcilePayments(
      [
        { key: "ava", amountMinor: 12_345, lodgementReference: "GFIT 2026-11 ROY" },
        { key: "zoe", amountMinor: 10_000, lodgementReference: "GFIT 2026-11 ROY" },
      ],
      parseBankCsv("15/02/2027,-123.45,GFIT 2026-11 ROY\n"),
    );
    expect(r.allMatched).toBe(false);
    expect(r.results.find((x) => x.key === "zoe")?.matched).toBe(false);
  });
});

describe("reconcileBatch", () => {
  const pays = [
    { key: "a", amountMinor: 5000, lodgementReference: "GF1234AB ROYALTY" },
    { key: "b", amountMinor: 2500, lodgementReference: "GF1234AB ROYALTY" },
  ];
  it("matches one line per payee", () => {
    const r = reconcileBatch(pays, [
      { date: "1", amountMinor: 5000, description: "GF1234AB ROYALTY PIP" },
      { date: "1", amountMinor: 2500, description: "gf1234ab royalty ava" },
    ], "GF1234AB");
    expect(r.mode).toBe("per-payment");
    expect(r.allMatched).toBe(true);
  });
  it("accepts a single lump-sum debit for the whole file", () => {
    const r = reconcileBatch(pays, [{ date: "1", amountMinor: 7500, description: "DE BATCH GF1234AB" }], "GF1234AB");
    expect(r.mode).toBe("lump-sum");
    expect(r.matchedTotalMinor).toBe(7500);
  });
  it("reports unmatched when amounts differ", () => {
    const r = reconcileBatch(pays, [{ date: "1", amountMinor: 7400, description: "GF1234AB" }], "GF1234AB");
    expect(r.mode).toBe("unmatched");
    expect(r.allMatched).toBe(false);
  });
});
