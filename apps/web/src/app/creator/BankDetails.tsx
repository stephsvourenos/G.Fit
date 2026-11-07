"use client";

import { useEffect, useState } from "react";
import { friendlyError, supabase } from "@/lib/supabase";

interface Bank { account_name: string; bsb: string; account_number: string; updated_at: string }

/** Where the creator (or their guardian) is paid. Shown masked; changes are logged and double-checked by finance. */
export function BankDetails({ creatorId, guardian }: { creatorId: string; guardian: boolean }) {
  const [bank, setBank] = useState<Bank | null>();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ account_name: "", bsb: "", account_number: "" });
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string }>();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase().from("creator_bank_accounts").select("account_name, bsb, account_number, updated_at").eq("creator_id", creatorId).maybeSingle()
      .then(({ data }) => setBank((data as Bank) ?? null));
  }, [creatorId]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const bsb = form.bsb.replace(/\D/g, "");
    const acct = form.account_number.replace(/[\s-]/g, "");
    if (bsb.length !== 6) return setMsg({ tone: "err", text: "BSB must be 6 digits." });
    if (!/^\d{1,9}$/.test(acct)) return setMsg({ tone: "err", text: "Account number must be up to 9 digits." });
    if (!form.account_name.trim()) return setMsg({ tone: "err", text: "Enter the account name exactly as your bank shows it." });
    setBusy(true);
    const row = { creator_id: creatorId, account_name: form.account_name.trim().slice(0, 32), bsb: `${bsb.slice(0, 3)}-${bsb.slice(3)}`, account_number: acct };
    // Insert the first time, update after (an upsert would log both "added" and "changed").
    const table = supabase().from("creator_bank_accounts");
    const { data, error } = await (bank ? table.update(row).eq("creator_id", creatorId) : table.insert(row))
      .select("account_name, bsb, account_number, updated_at").single();
    setBusy(false);
    if (error) return setMsg({ tone: "err", text: friendlyError(error) });
    setBank(data as Bank);
    setEditing(false);
    setForm({ account_name: "", bsb: "", account_number: "" });
    setMsg({ tone: "ok", text: "Saved. For your security, our finance team will confirm a change with you by phone before the next payment." });
  };

  const field = "mt-1 block w-full rounded border border-ink/20 px-2 py-1.5";
  return (
    <section className="mt-6 rounded-2xl bg-white p-5 ring-1 ring-ink/5">
      <h2 className="font-semibold">Where we pay you</h2>
      <p className="mt-1 text-sm text-ink/60">
        An Australian bank account{guardian ? " in the parent or guardian’s name (or a trust account for the child)" : ""}. We’ll never ask for these details by email —
        if you get an email asking you to change them, don’t reply; tell us.
      </p>
      {msg && <p role="alert" className={`mt-3 rounded-lg px-3 py-2 text-sm ${msg.tone === "ok" ? "bg-mint/15 text-[#0f6a4a]" : "bg-coral/10 text-[#b8361a]"}`}>{msg.text}</p>}
      {bank === undefined ? null : bank && !editing ? (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm">
          <div>
            <div className="font-semibold">{bank.account_name}</div>
            <div className="tabular-nums text-ink/70">BSB {bank.bsb} · Account ****{bank.account_number.slice(-3)}</div>
            <div className="text-xs text-ink/50">Last changed {new Date(bank.updated_at).toLocaleDateString("en-AU")}</div>
          </div>
          <button onClick={() => { setEditing(true); setMsg(undefined); }} className="rounded-full px-3 py-1.5 font-semibold ring-1 ring-ink/20">Change</button>
        </div>
      ) : (
        <form onSubmit={save} className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
          <label className="sm:col-span-3">Account name<input value={form.account_name} onChange={(e) => setForm({ ...form, account_name: e.target.value })} maxLength={32} autoComplete="off" className={field} /></label>
          <label>BSB<input value={form.bsb} onChange={(e) => setForm({ ...form, bsb: e.target.value })} inputMode="numeric" placeholder="000-000" autoComplete="off" className={field} /></label>
          <label className="sm:col-span-2">Account number<input value={form.account_number} onChange={(e) => setForm({ ...form, account_number: e.target.value })} inputMode="numeric" autoComplete="off" className={field} /></label>
          <div className="flex gap-2 sm:col-span-3">
            <button disabled={busy} className="rounded-full bg-ink px-4 py-2 font-semibold text-paper disabled:opacity-40">Save bank details</button>
            {bank && <button type="button" onClick={() => setEditing(false)} className="rounded-full px-4 py-2 font-semibold ring-1 ring-ink/20">Cancel</button>}
          </div>
        </form>
      )}
    </section>
  );
}
