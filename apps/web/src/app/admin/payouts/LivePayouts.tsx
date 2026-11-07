"use client";

import { useEffect, useState, type ReactNode } from "react";
import { formatMoney } from "@app/domain";
import { Badge, Table } from "@/components/AdminShell";
import { creatorNames, monthEnd } from "@/lib/finance";
import { friendlyError, supabase, supabaseConfigured } from "@/lib/supabase";

interface Payable { creator_id: string; status: string; due_minor: number; min_payout_minor: number; entry_ids: string[] }
interface Batch {
  id: string; status: string; total_minor: number; created_by: string; approved_by: string | null; created_at: string;
  confirmation: { bank_reference?: string } | null; note: string | null;
  payout_items: { creator_id: string; amount_minor: number }[];
}
const STATUS_TONE: Record<string, "green" | "amber" | "grey" | "red"> = { confirmed: "green", draft: "amber", approved: "amber", exported: "amber", cancelled: "grey", failed: "red" };
const PAYABLE_LABEL: Record<string, string> = {
  payable: "Payable now",
  "below-minimum-carry-forward": "Below minimum — carried forward",
  "negative-carry-forward": "Negative balance — carried forward",
  "nothing-due": "Nothing due yet",
};
const fetchBatches = () =>
  supabase().from("payout_batches").select("id, status, total_minor, created_by, approved_by, created_at, confirmation, note, payout_items(creator_id, amount_minor)").order("created_at", { ascending: false });

/**
 * Payouts: what is due today (final ledger only), batch creation, maker/checker approval,
 * export, and confirmation that requires a bank reference and the exact total.
 * Bank file export arrives in Phase 5 — "Mark exported" stands in for it.
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
              <td className="px-4 py-3 font-mono text-xs">{b.confirmation?.bank_reference ?? "—"}</td>
              <td className="px-4 py-3 text-xs">
                <div className="flex flex-wrap gap-2">
                  {b.status === "draft" && <button disabled={busy} onClick={() => action(b.id, "approve")} className="rounded-full px-3 py-1 font-semibold ring-1 ring-ink/20">Approve</button>}
                  {b.status === "approved" && <button disabled={busy} onClick={() => action(b.id, "export")} className="rounded-full px-3 py-1 font-semibold ring-1 ring-ink/20">Mark exported</button>}
                  {b.status === "exported" && <button disabled={busy} onClick={() => { setConfirmFor(b.id); setRef(""); setAmount(""); }} className="rounded-full bg-ink px-3 py-1 font-semibold text-paper">Confirm paid…</button>}
                  {["draft", "approved", "exported"].includes(b.status) && (
                    <button disabled={busy} onClick={() => { const reason = window.prompt("Reason for cancelling this batch?"); if (reason) action(b.id, "cancel", { p_reason: reason }); }} className="rounded-full px-3 py-1 text-[#b8361a] ring-1 ring-coral/40">Cancel</button>
                  )}
                </div>
                {confirmFor === b.id && (
                  <form className="mt-3 flex flex-wrap items-end gap-2" onSubmit={(e) => { e.preventDefault(); action(b.id, "confirm", { p_bank_reference: ref, p_confirmed_total: Math.round(Number(amount) * 100) }); }}>
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
        Rules enforced by the database: the person who created a batch can’t approve it; a batch is only marked paid with a bank reference and the exact total; a paid batch can’t be cancelled; no ledger entry can be paid twice. The bank payment file itself is Phase 5.
      </p>
    </>
  );
}
