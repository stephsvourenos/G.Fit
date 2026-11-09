// Bank payment files (ABA / direct entry) and reconciliation for creator payouts.
//   check      — are your business's direct-entry details complete? which payees lack bank details?
//   sample     — a TEST file (two made-up payees, $1.00 each) to run through your bank's file checker
//   generate   — build the real file for an APPROVED batch, store it + its SHA-256, mark the batch exported
//   download   — the stored file for a batch (exactly what was generated)
//   reconcile  — upload your bank statement CSV; payments are matched by reference + amount
// Nothing here moves money: you upload the file to your bank yourself.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { asServer, cors, json, staffRoles, SUPABASE_URL, ANON_KEY, serverError } from "../_shared/http.ts";
import { generateAba, parseAba, parseBankCsv, reconcileBatch, validateAbaRemitter } from "../_shared/domain.js";

const TZ = "Australia/Sydney";
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());
const RECENT_CHANGE_DAYS = 7;

async function sha256(text: string) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

const batchRef = (id: string) => `GF${id.replace(/-/g, "").slice(0, 6).toUpperCase()}`;
const lodgementRef = (id: string) => `${batchRef(id)} ROYALTY`; // 16 chars (max 18)

function remitterFrom(s: any) {
  return {
    bankCode: s?.bank_code ?? "",
    userName: s?.de_user_name ?? "",
    userId: s?.de_user_id ?? "",
    bsb: s?.bsb ?? "",
    accountNumber: s?.account_number ?? "",
    accountTitle: s?.account_title ?? "",
    remitterName: s?.remitter_name ?? "",
    selfBalancing: !!s?.self_balancing,
    balancingDebitCode: s?.balancing_debit_code ?? "13",
  };
}

async function loadBatch(id: string) {
  const b = await asServer(`payout_batches?id=eq.${id}&select=*,payout_items(creator_id,amount_minor)`);
  const batch = b.data?.[0];
  if (!batch) return null;
  const ids = batch.payout_items.map((i: any) => i.creator_id);
  const [banks, creators] = ids.length
    ? await Promise.all([
        asServer(`creator_bank_accounts?creator_id=in.(${ids.join(",")})&select=*`),
        asServer(`creators?id=in.(${ids.join(",")})&select=id,display_name`),
      ])
    : [{ data: [] }, { data: [] }];
  const bank = new Map((banks.data ?? []).map((x: any) => [x.creator_id, x]));
  const name = new Map((creators.data ?? []).map((x: any) => [x.id, x.display_name]));
  const cutoff = Date.now() - RECENT_CHANGE_DAYS * 86400_000;
  const items = batch.payout_items.map((i: any) => {
    const acct: any = bank.get(i.creator_id);
    return {
      creator_id: i.creator_id,
      creator: name.get(i.creator_id) ?? i.creator_id,
      amount_minor: i.amount_minor,
      bank: acct ? { account_name: acct.account_name, bsb: acct.bsb, account_masked: `****${acct.account_number.slice(-3)}`, updated_at: acct.updated_at } : null,
      recently_changed: acct ? new Date(acct.updated_at).getTime() > cutoff : false,
      _acct: acct,
    };
  });
  return { batch, items };
}

const publicItems = (items: any[]) => items.map(({ _acct, ...rest }) => rest);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const auth = req.headers.get("Authorization") ?? "";
    const roles = await staffRoles(auth);
    if (!roles.includes("admin") && !roles.includes("finance")) return json({ error: "Finance or admin staff only" }, 403);
    const me = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: ANON_KEY, Authorization: auth } }).then((r) => r.json());
    const body = await req.json().catch(() => ({}));
    const action: string = body.action ?? "check";

    const settings = (await asServer("finance_settings?id=eq.1&select=*")).data?.[0];
    const remitter = remitterFrom(settings);
    const settingsErrors = validateAbaRemitter(remitter);

    if (action === "check") {
      const out: any = { ok: true, settings_complete: settingsErrors.length === 0, settings_errors: settingsErrors };
      if (body.batch_id) {
        const loaded = await loadBatch(body.batch_id);
        if (!loaded) return json({ error: "No such batch" }, 404);
        out.items = publicItems(loaded.items);
        out.missing_bank_details = loaded.items.filter((i: any) => !i.bank).map((i: any) => i.creator);
        out.recently_changed = loaded.items.filter((i: any) => i.recently_changed).map((i: any) => i.creator);
        out.lodgement_reference = lodgementRef(body.batch_id);
      }
      return json(out);
    }

    if (action === "sample") {
      if (settingsErrors.length) return json({ error: "Finish your bank details in Configuration first", settings_errors: settingsErrors }, 400);
      const file = generateAba({
        remitter,
        processingDate: today(),
        description: "TEST FILE",
        payments: [
          { bsb: "062-000", accountNumber: "12345678", accountTitle: "TEST PAYEE ONE", amountMinor: 100, lodgementReference: "GFTEST ROYALTY" },
          { bsb: "083-004", accountNumber: "987654321", accountTitle: "TEST PAYEE TWO", amountMinor: 100, lodgementReference: "GFTEST ROYALTY" },
        ],
      });
      return json({ ok: true, filename: `gfit-TEST-${today()}.aba`, text: file.text, check: parseAba(file.text) });
    }

    if (!body.batch_id || !/^[0-9a-f-]{36}$/.test(body.batch_id)) return json({ error: "batch_id is required" }, 400);
    const loaded = await loadBatch(body.batch_id);
    if (!loaded) return json({ error: "No such batch" }, 404);
    const { batch, items } = loaded;

    if (action === "generate") {
      if (batch.status !== "approved") return json({ error: `Only an approved batch can have a bank file made (this one is ${batch.status})` }, 409);
      if (settingsErrors.length) return json({ error: "Finish your bank details in Configuration first", settings_errors: settingsErrors }, 400);
      const missing = items.filter((i: any) => !i._acct).map((i: any) => i.creator);
      if (missing.length) return json({ error: `No bank details yet for: ${missing.join(", ")}`, missing_bank_details: missing }, 409);
      const recent = items.filter((i: any) => i.recently_changed).map((i: any) => i.creator);
      if (recent.length && body.confirm_recent_changes !== true) {
        return json({
          error: `Bank details changed in the last ${RECENT_CHANGE_DAYS} days for: ${recent.join(", ")}. ` +
            "Confirm the change with the creator by phone (not by replying to an email) before paying.",
          recently_changed: recent, needs_confirmation: true,
        }, 409);
      }
      const processingDate: string = /^\d{4}-\d{2}-\d{2}$/.test(body.processing_date ?? "") ? body.processing_date : today();
      if (processingDate < today()) return json({ error: "The processing date cannot be in the past" }, 400);
      const file = generateAba({
        remitter,
        processingDate,
        description: "CREATOR PAY",
        payments: items.map((i: any) => ({
          bsb: i._acct.bsb, accountNumber: i._acct.account_number, accountTitle: i._acct.account_name,
          amountMinor: Number(i.amount_minor), lodgementReference: lodgementRef(batch.id),
        })),
      });
      // Double-check what we built before anyone uploads it.
      const parsed = parseAba(file.text);
      if (!parsed.lineLengthsOk || parsed.totals.credit !== Number(batch.total_minor)) {
        return json({ error: "Internal check failed: file total does not equal batch total" }, 500);
      }
      const hash = await sha256(file.text);
      const r = await asServer("rpc/payout_record_export", {
        method: "POST",
        body: JSON.stringify({ p_batch: batch.id, p_aba: file.text, p_sha256: hash, p_processing_date: processingDate, p_by: me?.id }),
      });
      if (!r.ok) return json({ error: r.data?.message ?? "Could not record the file" }, 409);
      return json({ ok: true, filename: `gfit-payout-${batchRef(batch.id)}-${processingDate}.aba`, text: file.text, sha256: hash, check: parsed });
    }

    if (action === "download") {
      if (!batch.aba_text) return json({ error: "No bank file has been made for this batch yet" }, 404);
      const hash = await sha256(batch.aba_text);
      return json({
        ok: true, filename: `gfit-payout-${batchRef(batch.id)}-${batch.processing_date}.aba`, text: batch.aba_text,
        sha256: hash, unchanged: hash === batch.aba_sha256,
      });
    }

    if (action === "reconcile") {
      if (batch.status !== "exported") return json({ error: "Reconcile after the bank file has been made and before confirming payment" }, 409);
      const csv = String(body.csv ?? "");
      if (!csv.trim() || csv.length > 2_000_000) return json({ error: "Paste or upload your bank statement CSV" }, 400);
      const lines = parseBankCsv(csv);
      const rec = reconcileBatch(
        items.map((i: any) => ({ key: i.creator_id, amountMinor: Number(i.amount_minor), lodgementReference: lodgementRef(batch.id) })),
        lines,
        batchRef(batch.id),
      );
      const reconciliation = {
        all_matched: rec.allMatched, mode: rec.mode, matched_total_minor: rec.matchedTotalMinor, total_minor: rec.totalMinor,
        lines_read: lines.length, at: new Date().toISOString(), by: me?.email,
        results: rec.results.map((x: any) => ({
          creator_id: x.key, amount_minor: x.amountMinor, matched: x.matched,
          bank_line: x.line ? { date: x.line.date, amount_minor: x.line.amountMinor, description: String(x.line.description).slice(0, 120) } : null,
        })),
      };
      await asServer(`payout_batches?id=eq.${batch.id}`, { method: "PATCH", body: JSON.stringify({ reconciliation }) });
      await asServer("audit_log", {
        method: "POST",
        body: JSON.stringify({ actor_user_id: me?.id, actor_label: me?.email, area: "finance", action: "Reconciled payout batch with bank statement",
          detail: { batch: batch.id, all_matched: rec.allMatched, mode: rec.mode } }),
      });
      return json({ ok: true, reconciliation });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    return serverError("payout-file", e);
  }
});
