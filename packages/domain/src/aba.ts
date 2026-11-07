/**
 * ABA ("Cemtex" / BECS direct entry) bulk payment file — the standard Australian format
 * accepted by the major banks for paying many accounts at once.
 *
 * Every line is exactly 120 characters, ASCII, ending CRLF:
 *   0  descriptive record (who is paying, which bank, processing date)
 *   1  one detail record per payment (credit, transaction code 50)
 *   [1 optional balancing debit from the paying account — some banks require it]
 *   7  file total record (net / credit / debit totals and the count of detail records)
 *
 * IMPORTANT: always run a generated file through YOUR bank's file checker before the first real
 * payment run — banks differ on small points (balancing record, debit code, allowed characters).
 */

export interface AbaRemitter {
  /** 3-letter bank code in the header, e.g. CBA, NAB, WBC, ANZ, BQL, BEN. */
  bankCode: string;
  /** Name registered with the bank for direct entry (max 26). */
  userName: string;
  /** 6-digit Direct Entry User ID (APCA number) issued by the bank. */
  userId: string;
  /** Your account the money comes from — also used as the trace account for returns. */
  bsb: string;
  accountNumber: string;
  accountTitle: string;
  /** Shown on the payee's statement as who paid them (max 16). */
  remitterName: string;
  /** Add a debit line from your own account so the file nets to zero (bank-specific). */
  selfBalancing: boolean;
  /** Transaction code for the balancing debit (13 is the usual BECS code). */
  balancingDebitCode?: string;
}

export interface AbaPayment {
  bsb: string;
  accountNumber: string;
  accountTitle: string;
  amountMinor: number;
  /** Shown on the payee's statement (max 18), e.g. "GFIT 2026-11 ROY". */
  lodgementReference: string;
}

export interface AbaFile {
  text: string;
  creditTotalMinor: number;
  debitTotalMinor: number;
  detailCount: number;
}

const BSB = /^\d{3}-?\d{3}$/;
const ACCOUNT = /^[0-9A-Za-z-]{1,9}$/;

/** Upper-case, ASCII letters/digits and a few safe punctuation marks; everything else becomes a space. */
export function abaText(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9 &'()*+,\-./:;?@]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const left = (s: string, n: number) => abaText(s).slice(0, n).padEnd(n, " ");
const right = (s: string, n: number) => s.slice(-n).padStart(n, " ");
const zeros = (v: number, n: number) => {
  const s = String(v);
  if (s.length > n) throw new Error(`Amount ${v} does not fit in ${n} digits`);
  return s.padStart(n, "0");
};
const bsb = (s: string) => {
  if (!BSB.test(s)) throw new Error(`Invalid BSB "${s}" (expected 6 digits, e.g. 062-000)`);
  const d = s.replace("-", "");
  return `${d.slice(0, 3)}-${d.slice(3)}`;
};
const account = (s: string) => {
  const a = s.replace(/[\s]/g, "");
  if (!ACCOUNT.test(a)) throw new Error(`Invalid account number "${s}" (1–9 digits)`);
  return right(a, 9);
};

export function validateAbaRemitter(r: AbaRemitter): string[] {
  const errs: string[] = [];
  if (!/^[A-Z]{3}$/.test(r.bankCode)) errs.push("Bank code must be 3 letters (e.g. CBA, NAB, WBC, ANZ)");
  if (!/^\d{6}$/.test(r.userId)) errs.push("Direct Entry User ID must be 6 digits (from your bank)");
  if (!abaText(r.userName)) errs.push("Direct entry user name is required");
  if (!BSB.test(r.bsb)) errs.push("Your BSB must be 6 digits");
  if (!ACCOUNT.test(r.accountNumber.replace(/\s/g, ""))) errs.push("Your account number must be 1–9 digits");
  if (!abaText(r.accountTitle)) errs.push("Your account name is required");
  if (!abaText(r.remitterName)) errs.push("Remitter name is required");
  return errs;
}

function detail(p: { bsb: string; account: string; title: string; code: string; amount: number; reference: string }, r: AbaRemitter) {
  const line =
    "1" +
    bsb(p.bsb) +
    account(p.account) +
    " " +
    p.code +
    zeros(p.amount, 10) +
    left(p.title, 32) +
    left(p.reference, 18) +
    bsb(r.bsb) +
    account(r.accountNumber) +
    left(r.remitterName, 16) +
    "00000000";
  return line;
}

/** "DDMMYY" for a "YYYY-MM-DD" date. */
const ddmmyy = (iso: string) => `${iso.slice(8, 10)}${iso.slice(5, 7)}${iso.slice(2, 4)}`;

export function generateAba(args: { remitter: AbaRemitter; payments: AbaPayment[]; processingDate: string; description: string }): AbaFile {
  const { remitter: r, payments, processingDate } = args;
  const errs = validateAbaRemitter(r);
  if (errs.length) throw new Error(errs.join("; "));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(processingDate)) throw new Error("Processing date must be YYYY-MM-DD");
  if (payments.length === 0) throw new Error("No payments");

  const lines: string[] = [];
  lines.push(
    "0" + " ".repeat(17) + "01" + r.bankCode + " ".repeat(7) + left(r.userName, 26) + zeros(Number(r.userId), 6) +
      left(args.description, 12) + ddmmyy(processingDate) + " ".repeat(40),
  );

  let credit = 0;
  for (const p of payments) {
    if (!Number.isSafeInteger(p.amountMinor) || p.amountMinor <= 0) throw new Error(`Payment to ${p.accountTitle} must be a positive whole number of cents`);
    if (!abaText(p.accountTitle)) throw new Error("Every payee needs an account name");
    lines.push(detail({ bsb: p.bsb, account: p.accountNumber, title: p.accountTitle, code: "50", amount: p.amountMinor, reference: p.lodgementReference }, r));
    credit += p.amountMinor;
  }
  let debit = 0;
  if (r.selfBalancing) {
    lines.push(detail({ bsb: r.bsb, account: r.accountNumber, title: r.accountTitle, code: r.balancingDebitCode ?? "13", amount: credit, reference: args.description }, r));
    debit = credit;
  }
  const count = lines.length - 1;
  lines.push(
    "7" + "999-999" + " ".repeat(12) + zeros(Math.abs(credit - debit), 10) + zeros(credit, 10) + zeros(debit, 10) +
      " ".repeat(24) + zeros(count, 6) + " ".repeat(40),
  );
  for (const l of lines) if (l.length !== 120) throw new Error(`Internal error: line length ${l.length}`);
  return { text: lines.join("\r\n") + "\r\n", creditTotalMinor: credit, debitTotalMinor: debit, detailCount: count };
}

/** Parse an ABA file back (used to double-check what we generated before it goes to the bank). */
export function parseAba(text: string) {
  const lines = text.split(/\r\n/).filter((l) => l.length > 0);
  const details = lines
    .filter((l) => l[0] === "1")
    .map((l) => ({
      bsb: l.slice(1, 8),
      accountNumber: l.slice(8, 17).trim(),
      transactionCode: l.slice(18, 20),
      amountMinor: Number(l.slice(20, 30)),
      accountTitle: l.slice(30, 62).trim(),
      lodgementReference: l.slice(62, 80).trim(),
    }));
  const t = lines.find((l) => l[0] === "7") ?? "";
  return {
    lineLengthsOk: lines.every((l) => l.length === 120),
    header: { bankCode: lines[0]?.slice(20, 23), userName: lines[0]?.slice(30, 56).trim(), userId: lines[0]?.slice(56, 62), date: lines[0]?.slice(74, 80) },
    details,
    totals: { net: Number(t.slice(20, 30)), credit: Number(t.slice(30, 40)), debit: Number(t.slice(40, 50)), count: Number(t.slice(74, 80)) },
  };
}

/** A bank-statement line for reconciliation (from a CSV export). */
export interface BankLine {
  date: string;
  amountMinor: number;
  description: string;
}

/**
 * Match exported payments to bank statement lines by lodgement reference + amount.
 * Each bank line can match at most one payment.
 */
export function reconcilePayments(payments: { key: string; amountMinor: number; lodgementReference: string }[], lines: BankLine[]) {
  const used = new Set<number>();
  const results = payments.map((p) => {
    const ref = abaText(p.lodgementReference);
    const idx = lines.findIndex(
      (l, i) => !used.has(i) && Math.abs(l.amountMinor) === p.amountMinor && abaText(l.description).includes(ref),
    );
    if (idx >= 0) used.add(idx);
    return { key: p.key, amountMinor: p.amountMinor, matched: idx >= 0, line: idx >= 0 ? lines[idx] : undefined };
  });
  return { results, allMatched: results.every((r) => r.matched), matchedTotalMinor: results.filter((r) => r.matched).reduce((a, r) => a + r.amountMinor, 0) };
}

/** Very small CSV reader for bank exports: needs columns for date, amount and description/reference. */
export function parseBankCsv(csv: string): BankLine[] {
  const rows = csv.split(/\r?\n/).filter((r) => r.trim()).map((r) => {
    const out: string[] = [];
    let cur = "", q = false;
    for (const ch of r) {
      if (ch === '"') q = !q;
      else if (ch === "," && !q) { out.push(cur); cur = ""; }
      else cur += ch;
    }
    out.push(cur);
    return out.map((c) => c.trim());
  });
  if (rows.length === 0) return [];
  const head = rows[0]!.map((h) => h.toLowerCase());
  const hasHeader = head.some((h) => /date|amount|desc|narr|ref|debit|credit/.test(h));
  const col = (re: RegExp, fallback: number) => (hasHeader ? head.findIndex((h) => re.test(h)) : fallback);
  const iDate = col(/date/, 0), iAmt = col(/amount|debit/, 1), iDesc = col(/desc|narr|ref|detail/, 2);
  return rows.slice(hasHeader ? 1 : 0).flatMap((r) => {
    const raw = (r[iAmt] ?? "").replace(/[$,\s]/g, "");
    const amt = Math.round(Math.abs(Number(raw)) * 100);
    if (!Number.isFinite(amt) || amt === 0) return [];
    return [{ date: r[iDate] ?? "", amountMinor: amt, description: r[iDesc] ?? r.join(" ") }];
  });
}

/**
 * Reconcile a whole payout batch against your bank statement.
 * Banks show a bulk file either as one line per payee, or as ONE lump-sum debit for the whole file —
 * both are accepted. Returns per-payment results and how the batch was matched.
 */
export function reconcileBatch(
  payments: { key: string; amountMinor: number; lodgementReference: string }[],
  lines: BankLine[],
  batchRef: string,
) {
  const total = payments.reduce((a, p) => a + p.amountMinor, 0);
  const each = reconcilePayments(payments, lines);
  if (each.allMatched) return { ...each, mode: "per-payment" as const, totalMinor: total };
  const ref = abaText(batchRef);
  const lump = lines.find((l) => Math.abs(l.amountMinor) === total && (!ref || abaText(l.description).includes(ref)))
    ?? lines.find((l) => Math.abs(l.amountMinor) === total);
  if (lump) {
    return {
      results: payments.map((p) => ({ key: p.key, amountMinor: p.amountMinor, matched: true, line: lump })),
      allMatched: true, matchedTotalMinor: total, mode: "lump-sum" as const, totalMinor: total,
    };
  }
  return { ...each, mode: "unmatched" as const, totalMinor: total };
}
