import { describe, expect, it } from "vitest";
import { demoFinance, households, invoices } from "./index";
import { formatMoney } from "@app/domain";

describe("demo finance simulation", () => {
  it("builds balanced, reproducible month-end runs", () => {
    const f = demoFinance();
    for (const s of f.snapshots) {
      expect(s.royaltyAllocatedMinor + s.royaltyRetainedMinor).toBe(s.royaltyPoolMinor);
      console.log(s.month, s.status, formatMoney(s.netReceiptsMinor), "pool", formatMoney(s.royaltyPoolMinor), "ref", formatMoney(s.referralMinor), "adj", formatMoney(s.adjustmentsMinor), s.fingerprint);
    }
    console.log(households.length, "households", invoices.length, "invoices", f.ledger.length, "ledger entries");
    for (const b of f.batches) console.log(b.id, b.status, b.items.map((i) => `${i.creatorId}:${formatMoney(i.amountMinor)}`).join(" "));
    expect(f.batches).toHaveLength(2);
  });
});
