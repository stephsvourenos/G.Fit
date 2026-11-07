"use client";

import { useEffect, useState, type ReactNode } from "react";
import { formatMoney } from "@app/domain";
import { Badge, Table } from "@/components/AdminShell";
import { creatorNames, downloadText, monthEnd, payoutFile } from "@/lib/finance";
import { friendlyError, supabase, supabaseConfigured } from "@/lib/supabase";

interface Payable { creator_id: string; status: string; due_minor: number; min_payout_minor: number; entry_ids: string[] }
interface Batch {
  id: string; status: string; total_minor: number; created_by: string; approved_by: string | null; created_at: string;
  confirmation: { bank_reference?: string; reconciled?: boolean } | null; note: string | null;
  processing_date: string | null; aba_sha256: string | null;
  reconciliation: { all_matched: boolean; mode: string; matched_total_minor: number; total_minor: number; lines_read: number } | null;
  payout_items: { creator_id: string; amount_minor: number }[];
}
interface FileCheck {
  settings_complete: boolean; settings_errors: string[]; missing_bank_details: string[]; recently_changed: string[]; lodgement_reference: string;
  items: { creator_id: string; creator: string; amount_minor: number; bank: { account_name: string; bsb: string; account_masked: string } | null }[];
}
const STATUS_TONE: Record<string, "green" | "amber" | "grey" | "red"> = { confirmed: "green", draft: "amber", approved: "amber", exported: "amber", cancelled: "grey", failed: "red" };
const PAYABLE_LABEL: Record<string, string> = {
  payable: "Payable now",
  "below-minimum-carry-forward": "Below minimum — carried forward",
  "negative-carry-forward": "Negative balance — carried forward",
  "nothing-due": "Nothing due yet",
};
const fetchBatches = () =>
  supabase().from("payout_batches").select("id, status, total_minor, created_by, approved_by, created_at, confirmation, note, processing_date, aba_sha256, reconciliation, payout_items(creator_id, amount_minor)").order("created_at", { ascending: false });

/**
 * Payouts: what is due today (final ledger only), batch creation, maker/checker approval,
 * the bank payment file (ABA), reconciliation against the bank statement, and confirmation that
 * requires a bank reference and the exact total.
 */
export function LivePayouts({ demo }: { demo: ReactNode }) {
  const [names, setNames] = useState<Record<string, string>>({});
  const [payables, setPayables] = useState<Payable[]>();
  const [batches, setBatches] = useState<Batch[]>();
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string }>();
  const [busy, setBusy] = useState(false);
  const [confirmFor, setConfirmFor] = useState<string>();
  const [ref, setRef] = useState("");
  const [amount, setAmount] = useState("");
  const [fileFor, setFileFor] = useState<string>();
  const [fileCheck, setFileCheck] = useState<FileCheck>();
  const [procDate, setProcDate] = useState("");
  const [recFor, setRecFor] = useState<string>();
  const [csv, setCsv] = useState("");

  const reload = async () => {
    const [p, b] = await Promise.all([monthEnd<{ payables: Payable[] }>({ action: "payables" }), fetchBatches()]);
    if (p.error) setMsg({ tone: "err", text: p.error });
    else setPayables(p.payables);
    if (b.error) setMsg({ tone: "err", text: friendlyError(b.error) });
    else setBatches((b.data ?? []) as Batch[]);
  };
  useEffect(() => {
    if (!supabaseConfigured) return;
    creatorNames().then(setNames);
    Promise.all([monthEnd<{ payables: Payable[] }>({ action: "payables" }), fetchBatches()]).then(([p, b]) => {
      if (!p.error) setPayables(p.payables);
      setBatches((b.data ?? []) as Batch[]);
    });
  }, []);
  if (!supabaseConfigured) return <>{demo}</>;

  const createBatch = async () => {
    setBusy(true);
    const r = await monthEnd<{ batch_id?: string }>({ action: "create-payout-batch" });
    setBusy(false);
    setMsg(r.error ? { tone: "err", text: r.error } : { tone: "ok", text: "Draft batch created. A different finance person must approve it." });
    reload();
  };
  const action = async (id: string, act: string, extra: Record<string, unknown> = {}) => {
    setBusy(true);
    const { error } = await supabase().rpc("payout_batch_action", { p_batch: id, p_action: act, ...extra });
    setBusy(false);
    setMsg(error ? { tone: "err", text: error.message } : { tone: "ok", text: `Batch ${act === "export" ? "marked exported" : act + "d"}.` });
    setConfirmFor(undefined);
    reload();
  };
  const openFile = async (id: string) => {
    setFileFor(id); setFileCheck(undefined); setRecFor(undefined); setConfirmFor(undefined);
    setProcDate(new Intl.DateTimeFormat("en-CA", { timeZone: "Australia/Sydney" }).format(new Date()));
    const r = await payoutFile<FileCheck>({ action: "check", batch_id: id });
    if (r.error) setMsg({ tone: "err", text: r.error });
    else setFileCheck(r);
  };
  const makeFile = async (id: string) => {
    setBusy(true);
    const r = await payoutFile<{ filename: string; text: string; sha256: string }>({
      action: "generate", batch_id: id, processing_date: procDate, confirm_recent_changes: (fileCheck?.recently_changed.length ?? 0) > 0,
    });
    setBusy(false);
    if (r.error) return setMsg({ tone: "err", text: r.error });
    downloadText(r.filename, r.text);
    setMsg({ tone: "ok", text: `Bank file ${r.filename} downloaded. Upload it in your bank’s bulk payments area, then reconcile here once it has gone through.` });
    setFileFor(undefined);
    reload();
  };
  const download = async (id: string) => {
    const r = await payoutFile<{ filename: string; text: string; unchanged: boolean }>({ action: "download", batch_id: id });
    if (r.error) return setMsg({ tone: "err", text: r.error });
    if (!r.unchanged) return setMsg({ tone: "err", text: "The stored file no longer matches its fingerprint — do not upload it. Contact support." });
    downloadText(r.filename, r.text);
  };
  const reconcile = async (id: string) => {
    setBusy(true);
    const r = await payoutFile<{ reconciliation: NonNullable<Batch["reconciliation"]> }>({ action: "reconcile", batch_id: id, csv });
    setBusy(false);
    if (r.error) return setMsg({ tone: "err", text: r.error });
    const x = r.reconciliation;
    setMsg(x.all_matched
      ? { tone: "ok", text: `Matched ${formatMoney(x.matched_total_minor)} on your bank statement (${x.mode === "lump-sum" ? "one bulk debit" : "one line per creator"}). You can now confirm it as paid.` }
      : { tone: "err", text: `Only ${formatMoney(x.matched_total_minor)} of ${formatMoney(x.total_minor)} found in ${x.lines_read} statement lines. Check the payment has gone through and the right date range is exported.` });
    setRecFor(undefined); setCsv("");
    reload();
  };
  const payableNow = payables?.filter((p) => p.status === "payable") ?? [];

  return (
    <>
      {msg && <p role="alert" className={`mb-4 rounded-xl px-4 py-2.5 text-sm ${msg.tone === "ok" ? "bg-mint/15 text-[#0f6a4a]" : "bg-coral/10 text-[#b8361a]"}`}>{msg.text}</p>}
      <h2 className="mb-3 font-semibold">Due today (final months only)</h2>
      {!payables ? (
        <p className="text-ink/60">Loading…</p>
      ) : payables.length === 0 ? (
        <p className="mb-6 rounded-xl bg-white p-5 text-ink/60 ring-1 ring-ink/5">No finalised earnings yet. Finalise a month on the Royalties page first.</p>
      ) : (
        <div className="mb-4">
          <Table head={["Creator", "Due", "Minimum", "Status"]}>
            {payables.map((p) => (
              <tr key={p.creator_id}>
                <td className="px-4 py-3 font-semibold">{names[p.creator_id] ?? p.creator_id.slice(0, 8)}</td>
                <td className="px-4 py-3">{formatMoney(p.due_minor)}</td>
                <td className="px-4 py-3 text-xs">{formatMoney(p.min_payout_minor)}</td>
                <td className="px-4 py-3"><Badge tone={p.status === "payable" ? "green" : "grey"}>{PAYABLE_LABEL[p.status] ?? p.status}</Badge></td>
              </tr>
            ))}
          </Table>
        </div>
      )}
      <button onClick={createBatch} disabled={busy || payableNow.length === 0} className="mb-8 rounded-full bg-ink px-4 py-2 text-sm font-semibold text-paper disabled:opacity-40">
        Create payout batch ({payableNow.length} creator{payableNow.length === 1 ? "" : "s"})
      </button>

      <h2 className="mb-3 font-semibold">Batches</h2>
      {!batches?.length ? (
        <p className="rounded-xl bg-white p-5 text-ink/60 ring-1 ring-ink/5">No payout batches yet.</p>
      ) : (
        <Table head={["Created", "Status", "Creators", "Total", "Bank reference", "Actions"]}>
          {batches.map((b) => (
            <tr key={b.id}>
              <td className="px-4 py-3 text-xs">{new Date(b.created_at).toLocaleDateString("en-AU")}</td>
              <td className="px-4 py-3"><Badge tone={STATUS_TONE[b.status] ?? "grey"}>{b.status}</Badge></td>
              <td className="px-4 py-3 text-xs">{b.payout_items.map((i) => `${names[i.creator_id] ?? "?"} ${formatMoney(i.amount_minor)}`).join(", ")}</td>
              <td className="px-4 py-3 font-semibold">{formatMoney(b.total_minor)}</td>
              <td className="px-4 py-3 text-xs">
                <span className="font-mono">{b.confirmation?.bank_reference ?? "—"}</span>
                {b.processing_date && <div className="text-ink/50">File date {b.processing_date}</div>}
                {b.reconciliation && (
                  <div className="mt-1"><Badge tone={b.reconciliation.all_matched ? "green" : "red"}>{b.reconciliation.all_matched ? "Bank statement matched" : "Not matched yet"}</Badge></div>
                )}
              </td>
              <td className="px-4 py-3 text-xs">
                <div className="flex flex-wrap gap-2">
                  {b.status === "draft" && <button disabled={busy} onClick={() => action(b.id, "approve")} className="rounded-full px-3 py-1 font-semibold ring-1 ring-ink/20">Approve</button>}
                  {b.status === "approved" && <button disabled={busy} onClick={() => openFile(b.id)} className="rounded-full bg-ink px-3 py-1 font-semibold text-paper">Make bank file…</button>}
                  {b.aba_sha256 && <button disabled={busy} onClick={() => download(b.id)} className="rounded-full px-3 py-1 font-semibold ring-1 ring-ink/20">Download .aba</button>}
                  {b.status === "exported" && <button disabled={busy} onClick={() => { setRecFor(b.id); setConfirmFor(undefined); setFileFor(undefined); }} className="rounded-full px-3 py-1 font-semibold ring-1 ring-ink/20">Reconcile…</button>}
                  {b.status === "exported" && <button disabled={busy} onClick={() => { setConfirmFor(b.id); setRecFor(undefined); setRef(""); setAmount((b.total_minor / 100).toFixed(2)); }} className="rounded-full bg-ink px-3 py-1 font-semibold text-paper">Confirm paid…</button>}
                  {["draft", "approved", "exported"].includes(b.status) && (
                    <button disabled={busy} onClick={() => { const reason = window.prompt("Reason for cancelling this batch?"); if (reason) action(b.id, "cancel", { p_reason: reason }); }} className="rounded-full px-3 py-1 text-[#b8361a] ring-1 ring-coral/40">Cancel</button>
                  )}
                </div>
                {fileFor === b.id && (
                  <div className="mt-3 max-w-md rounded-lg bg-ink/[0.03] p-3">
                    {!fileCheck ? <p>Checking bank details…</p> : (
                      <>
                        {!fileCheck.settings_complete && (
                          <p className="mb-2 text-[#b8361a]">Your business’s bank details aren’t complete: {fileCheck.settings_errors.join("; ")}. Fill them in under <a className="underline" href="/admin/settings/">Configuration</a>.</p>
                        )}
                        {fileCheck.missing_bank_details.length > 0 && (
                          <p className="mb-2 text-[#b8361a]">No bank details yet for {fileCheck.missing_bank_details.join(", ")}. They add them in their creator portal (or an admin can).</p>
                        )}
                        {fileCheck.recently_changed.length > 0 && (
                          <p className="mb-2 rounded bg-sun/30 p-2 text-ink"><b>Bank details changed recently</b> for {fileCheck.recently_changed.join(", ")}. Phone the creator on a number you already have (not one from an email) to confirm before paying — changed bank details are the most common payment scam.</p>
                        )}
                        <ul className="mb-2 space-y-0.5">
                          {fileCheck.items.map((i) => (
                            <li key={i.creator_id}>{i.creator}: {formatMoney(i.amount_minor)} → {i.bank ? `${i.bank.account_name}, ${i.bank.bsb} ${i.bank.account_masked}` : "no bank details"}</li>
                          ))}
                        </ul>
                        <p className="mb-2 text-ink/60">Shown on their statement as <span className="font-mono">{fileCheck.lodgement_reference}</span>.</p>
                        <label className="mr-2">Processing date<input type="date" value={procDate} onChange={(e) => setProcDate(e.target.value)} className="ml-2 rounded border border-ink/20 px-2 py-1" /></label>
                        <button disabled={busy || !fileCheck.settings_complete || fileCheck.missing_bank_details.length > 0} onClick={() => makeFile(b.id)} className="mt-2 rounded-full bg-ink px-3 py-1.5 font-semibold text-paper disabled:opacity-40">
                          {fileCheck.recently_changed.length > 0 ? "I’ve confirmed by phone — make file" : "Make & download file"}
                        </button>
                      </>
                    )}
                  </div>
                )}
                {recFor === b.id && (
                  <form className="mt-3 max-w-md rounded-lg bg-ink/[0.03] p-3" onSubmit={(e) => { e.preventDefault(); reconcile(b.id); }}>
                    <p className="mb-2 text-ink/70">Export your business account’s transactions as CSV from online banking (covering the payment date) and choose the file, or paste it.</p>
                    <input type="file" accept=".csv,text/csv" onChange={async (e) => { const f = e.target.files?.[0]; if (f) setCsv(await f.text()); }} className="mb-2 block text-xs" />
                    <textarea value={csv} onChange={(e) => setCsv(e.target.value)} rows={3} placeholder="Date,Amount,Description" className="block w-full rounded border border-ink/20 px-2 py-1 font-mono" />
                    <button disabled={busy || !csv.trim()} className="mt-2 rounded-full bg-ink px-3 py-1.5 font-semibold text-paper disabled:opacity-40">Match against statement</button>
                  </form>
                )}
                {confirmFor === b.id && (
                  <form className="mt-3 flex flex-wrap items-end gap-2" onSubmit={(e) => { e.preventDefault(); action(b.id, "confirm", { p_bank_reference: ref, p_confirmed_total: Math.round(Number(amount) * 100) }); }}>
                    {!b.reconciliation?.all_matched && <p className="w-full text-[#8a5a00]">Not yet matched to your bank statement — reconcile first if you can.</p>}
                    <label>Bank reference<input value={ref} onChange={(e) => setRef(e.target.value)} className="mt-1 block rounded border border-ink/20 px-2 py-1" /></label>
                    <label>Amount paid (A$)<input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" className="mt-1 block w-28 rounded border border-ink/20 px-2 py-1" /></label>
                    <button className="rounded-full bg-ink px-3 py-1.5 font-semibold text-paper">Confirm</button>
                  </form>
                )}
              </td>
            </tr>
          ))}
        </Table>
      )}
      <p className="mt-4 text-xs text-ink/50">
        Rules enforced by the database: the person who created a batch can’t approve it; a batch is only marked paid with a bank reference and the exact total; a paid batch can’t be cancelled; no ledger entry can be paid twice; the bank file can only be made for an approved batch, and its fingerprint is kept so the downloaded file can be checked later.
      </p>
    </>
  );
}
