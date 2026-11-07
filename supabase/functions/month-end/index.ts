// Month-end for creator royalties and referral commission.
//   preview  — runs the rules on real data and stores a replaceable preview (provisional)
//   final    — runs again and writes the permanent ledger + statements in ONE transaction
//   verify   — re-runs a finalised month and checks the result is identical (fingerprint)
// The rules are the SAME code as the app and unit tests (packages/domain → _shared/domain.js).
// Only paid viewing counts (trials and test memberships are excluded).
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { asServer, cors, json, staffRoles, SUPABASE_URL, ANON_KEY } from "../_shared/http.ts";
import {
  buildStatement,
  computePayable,
  DEFAULT_PAYOUT_TERMS,
  payoutDueDate,
  runMonthEnd,
} from "../_shared/domain.js";

const TZ = "Australia/Sydney";
const sydneyMonth = (iso: string) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit" }).format(new Date(iso)).slice(0, 7);

async function fetchAll(path: string): Promise<any[]> {
  const out: any[] = [];
  for (let from = 0; ; from += 1000) {
    const r = await asServer(path, { headers: { Range: `${from}-${from + 999}`, "Range-Unit": "items" } });
    if (!r.ok) throw new Error(`fetch ${path.split("?")[0]}: ${JSON.stringify(r.data)}`);
    out.push(...r.data);
    if (r.data.length < 1000) return out;
  }
}

async function caller(req: Request): Promise<{ ok: boolean; cron: boolean; email?: string; id?: string }> {
  const nonce = req.headers.get("x-cron-nonce");
  if (nonce) {
    const r = await asServer("rpc/consume_cron_nonce", { method: "POST", body: JSON.stringify({ n: nonce }) });
    return { ok: r.data === true, cron: true, email: "scheduler" };
  }
  const auth = req.headers.get("Authorization") ?? "";
  const roles = await staffRoles(auth);
  if (!roles.includes("admin") && !roles.includes("finance")) return { ok: false, cron: false };
  const u = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: ANON_KEY, Authorization: auth } }).then((r) => r.json());
  return { ok: true, cron: false, email: u?.email, id: u?.id };
}

/** Everything the rules need, read from the database. */
async function loadInputs(month: string) {
  const [invRows, refundRows, viewRows, contractRows, attrRows, priorRows, batchRows] = await Promise.all([
    fetchAll("billing_invoices?status=eq.paid&amount_paid_minor=gt.0&select=*&order=id"),
    fetchAll("billing_refunds?status=eq.succeeded&select=*&order=id"),
    // Paid viewing only: the household was a paying Stripe member when the video was played.
    fetchAll(
      `qualified_views?month=eq.${month}&select=*,playback_sessions!inner(membership_provider,membership_status)` +
        `&playback_sessions.membership_provider=eq.stripe&playback_sessions.membership_status=in.(active,past_due)&order=session_id`,
    ),
    fetchAll("creator_contracts?select=*&order=creator_id,version"),
    fetchAll("referral_attributions?terms=not.is.null&select=*&order=household_id"),
    fetchAll(`ledger_entries?run_status=eq.final&earning_month=lt.${month}&select=*&order=id`),
    fetchAll("payout_batches?select=*,payout_items(creator_id,amount_minor)&order=created_at"),
  ]);
  const entryRows = batchRows.length ? await fetchAll("payout_item_entries?select=*") : [];

  const invoices = invRows
    .filter((i) => i.period_start)
    .map((i) => ({
      invoiceId: i.id,
      householdId: i.household_id,
      provider: "stripe",
      currency: String(i.currency).toUpperCase(),
      grossPaidMinor: i.amount_paid_minor,
      taxMinor: i.gst_minor,
      processorFeeMinor: i.processor_fee_minor ?? 0,
      platformFeeMinor: 0,
      serviceStartMonth: sydneyMonth(i.period_start),
      serviceMonths: i.billing_interval === "year" ? 12 : 1,
      paidAt: i.paid_at ?? i.updated_at,
    }));
  const refunds = refundRows
    .filter((r) => r.invoice_id)
    .map((r) => ({
      refundId: r.id,
      invoiceId: r.invoice_id,
      grossRefundMinor: r.amount_minor,
      taxRefundMinor: Math.round(r.amount_minor / 11),
      processorFeeReturnedMinor: 0,
      kind: "refund",
      disputeFeeMinor: 0,
      createdAt: new Date(r.created_at).toISOString(),
    }));
  const views = viewRows.map((v) => ({
    householdId: v.household_id,
    profileId: v.profile_id,
    workoutId: v.workout_id,
    creatorId: v.creator_id,
    day: v.day,
    month: v.month,
    creditedSec: v.credited_sec,
    sessionId: v.session_id,
  }));
  const contracts = contractRows.map((c) => ({ ...c.terms, contractId: c.contract_id, version: c.version, creatorId: c.creator_id }));
  const attributions = attrRows.map((a) => ({
    householdId: a.household_id,
    creatorId: a.creator_id,
    code: a.referral_code,
    attributedAt: new Date(a.attributed_at).toISOString(),
    contractId: a.contract_id,
    contractVersion: a.contract_version,
    terms: a.terms,
    source: a.source,
  }));
  const toEntry = (e: any) => ({
    id: e.id,
    creatorId: e.creator_id,
    kind: e.kind,
    amountMinor: Number(e.amount_minor),
    currency: e.currency,
    earningMonth: e.earning_month,
    runId: e.run_id,
    runStatus: e.run_status,
    sourceRefs: e.source_refs ?? [],
    contractRef: e.contract_ref,
    memo: e.memo,
    reversesEntryId: e.reverses_entry_id ?? undefined,
    createdAt: e.created_at,
  });
  const priorEntries = priorRows.map(toEntry);
  const batches = batchRows.map((b) => ({
    id: b.id,
    status: b.status,
    createdBy: b.created_by,
    items: (b.payout_items ?? []).map((it: any) => ({
      creatorId: it.creator_id,
      amountMinor: Number(it.amount_minor),
      currency: b.currency,
      entryIds: entryRows.filter((x) => x.batch_id === b.id && x.creator_id === it.creator_id).map((x) => x.entry_id),
    })),
    confirmation: b.confirmation && b.confirmed_at
      ? { bankReference: b.confirmation.bank_reference, confirmedBy: b.confirmed_by, confirmedAt: b.confirmed_at, evidence: "bank reference" }
      : undefined,
    audit: [],
  }));
  return { invoices, refunds, views, contracts, attributions, priorEntries, batches };
}

function run(month: string, status: "provisional" | "final", inp: Awaited<ReturnType<typeof loadInputs>>, now: string) {
  const result = runMonthEnd({
    month,
    status,
    invoices: inp.invoices,
    refunds: inp.refunds,
    views: inp.views,
    contracts: inp.contracts,
    attributions: inp.attributions,
    priorEntries: inp.priorEntries,
    now,
  });
  // One statement per creator who has a contract or any ledger activity.
  const allEntries = [...inp.priorEntries, ...result.entries.map((e: any) => ({ ...e, runStatus: "final" }))];
  const creatorIds = [...new Set([...inp.contracts.map((c: any) => c.creatorId), ...allEntries.map((e: any) => e.creatorId)])].sort();
  const statements = creatorIds.map((creatorId) => {
    const terms = inp.contracts.filter((c: any) => c.creatorId === creatorId).sort((a: any, b: any) => b.version - a.version)[0]?.payout ??
      DEFAULT_PAYOUT_TERMS;
    const st = buildStatement({ creatorId, month, ledger: allEntries, batches: inp.batches });
    const nextPay = payoutDueDate(month, terms);
    const payable = computePayable({ creatorId, ledger: allEntries, batches: inp.batches, terms, asOfDate: nextPay });
    const payableMinor = payable.status === "payable" ? payable.dueMinor : 0;
    return {
      creator_id: creatorId,
      opening_balance_minor: st.openingBalanceMinor,
      royalties_minor: st.royaltiesMinor,
      referrals_minor: st.referralsMinor,
      adjustments_minor: st.adjustmentsMinor,
      paid_out_minor: st.paidOutMinor,
      closing_balance_minor: st.closingBalanceMinor,
      payable_minor: payableMinor,
      carried_forward_minor: st.closingBalanceMinor - payableMinor,
      next_pay_date: nextPay,
      payable_status: payable.status,
    };
  });
  return { result, statements };
}

const entryRow = (e: any) => ({
  id: e.id,
  creator_id: e.creatorId,
  kind: e.kind,
  amount_minor: e.amountMinor,
  currency: e.currency,
  earning_month: e.earningMonth,
  source_refs: e.sourceRefs,
  contract_ref: e.contractRef,
  memo: e.memo,
  reverses_entry_id: e.reversesEntryId ?? null,
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const who = await caller(req);
    if (!who.ok) return json({ error: "Finance or admin staff only" }, 403);
    const body = await req.json().catch(() => ({}));
    const action: string = body.action ?? "preview";
    // Default month: the previous calendar month in Sydney.
    const d = new Date();
    const prev = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 15)).toISOString();
    const month: string = body.month ?? sydneyMonth(prev);
    if (!/^\d{4}-\d{2}$/.test(month)) return json({ error: "month must look like 2026-11" }, 400);
    if (who.cron && action !== "preview") return json({ error: "The scheduler may only preview" }, 403);
    if (action === "final" && month >= sydneyMonth(new Date().toISOString())) {
      return json({ error: "A month can only be finalised after it has ended" }, 400);
    }

    // ---------- payouts (final ledger only) ----------
    if (action === "payables" || action === "create-payout-batch") {
      if (who.cron) return json({ error: "Not available to the scheduler" }, 403);
      const asOf: string = /^\d{4}-\d{2}-\d{2}$/.test(body.asOf ?? "") ? body.asOf
        : new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());
      const inp = await loadInputs("9999-12"); // every final entry
      const payables = [...new Set(inp.priorEntries.map((e: any) => e.creatorId))].sort().map((creatorId) => {
        const terms = inp.contracts.filter((c: any) => c.creatorId === creatorId).sort((a: any, b: any) => b.version - a.version)[0]?.payout ??
          DEFAULT_PAYOUT_TERMS;
        const p = computePayable({ creatorId, ledger: inp.priorEntries, batches: inp.batches, terms, asOfDate: asOf });
        return { creator_id: creatorId, status: p.status, due_minor: p.dueMinor, min_payout_minor: terms.minPayoutMinor, entry_ids: p.dueEntries.map((e: any) => e.id) };
      });
      if (action === "payables") return json({ ok: true, asOf, payables });
      const items = payables.filter((p) => p.status === "payable").map((p) => ({ creator_id: p.creator_id, amount_minor: p.due_minor, entry_ids: p.entry_ids }));
      if (!items.length) return json({ error: "Nothing is payable yet (balances below minimum or not yet due are carried forward)" }, 409);
      const r = await asServer("rpc/create_payout_batch", {
        method: "POST",
        body: JSON.stringify({ p_items: items, p_created_by: who.id, p_note: `Payout run as of ${asOf}` }),
      });
      if (!r.ok) return json({ error: r.data?.message ?? "Could not create batch" }, 409);
      return json({ ok: true, batch_id: r.data, items });
    }

    const now = new Date().toISOString();
    const inputs = await loadInputs(month);
    const status = action === "final" ? "final" : "provisional";
    const { result, statements } = run(month, status, inputs, now);
    const s = result.snapshot;
    const input_counts = {
      invoices: inputs.invoices.length,
      refunds: inputs.refunds.length,
      paid_views: inputs.views.length,
      contracts: inputs.contracts.length,
      attributions: inputs.attributions.length,
    };
    const runRow = {
      run_id: status === "final" ? `run-${month}-final` : `run-${month}-provisional`,
      month,
      policy_versions: s.policyVersions,
      net_receipts_minor: s.netReceiptsMinor,
      royalty_pool_minor: s.royaltyPoolMinor,
      royalty_allocated_minor: s.royaltyAllocatedMinor,
      royalty_retained_minor: s.royaltyRetainedMinor,
      referral_minor: s.referralMinor,
      adjustments_minor: s.adjustmentsMinor,
      entry_count: s.entryCount,
      fingerprint: s.fingerprint,
      input_counts,
      created_by: who.email ?? "unknown",
      created_by_id: who.id ?? "",
    };
    const summary = { month, status, ...runRow, statements };

    if (action === "verify") {
      const fin = (await asServer(`month_end_runs?month=eq.${month}&status=eq.final&select=fingerprint,entry_count`)).data?.[0];
      if (!fin) return json({ error: `${month} has not been finalised` }, 404);
      return json({ ok: true, month, matches: fin.fingerprint === s.fingerprint, final: fin.fingerprint, recomputed: s.fingerprint });
    }

    if (action === "final") {
      const r = await asServer("rpc/finalise_month_end", {
        method: "POST",
        body: JSON.stringify({ p_run: runRow, p_entries: result.entries.map(entryRow), p_statements: statements }),
      });
      if (!r.ok) return json({ error: r.data?.message ?? "Could not finalise" }, 409);
      return json({ ok: true, ...summary });
    }

    // Preview: replace this month's provisional row (final rows are protected by the database).
    const { created_by_id: _omit, ...previewRow } = runRow;
    await asServer(`month_end_runs?month=eq.${month}&status=eq.provisional`, { method: "DELETE" });
    const ins = await asServer("month_end_runs", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ ...previewRow, status: "provisional", preview: { entries: result.entries.map(entryRow), statements } }),
    });
    if (!ins.ok) return json({ error: "Could not save preview", detail: ins.data }, 500);
    return json({ ok: true, ...summary });
  } catch (e) {
    console.error(e);
    return json({ error: (e as Error).message }, 500);
  }
});
