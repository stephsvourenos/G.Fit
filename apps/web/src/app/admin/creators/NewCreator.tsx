"use client";

import { useState } from "react";
import { CATEGORY_LABEL, type CategoryId } from "@app/domain";
import { friendlyError, supabase } from "@/lib/supabase";

/**
 * Add a creator: their business record, the coach profile families see, and (optionally) the login that
 * opens their creator portal. Contract terms are added next, with "New contract version".
 */
export function NewCreator({ onDone }: { onDone: (msg: string) => void }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({
    displayName: "", legalName: "", minor: false, payeeName: "", abn: "", gst: false, code: "", bio: "",
    specialties: new Set<CategoryId>(), loginEmail: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const suggestCode = (name: string) => name.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(undefined);
    const code = (f.code || suggestCode(f.displayName)).toUpperCase();
    if (!f.displayName.trim() || !f.legalName.trim()) return setError("Display name and legal name are required.");
    if (!/^[A-Z0-9]{3,20}$/.test(code)) return setError("Referral code: 3–20 letters or numbers.");
    if (f.minor && !f.payeeName.trim()) return setError("For a creator under 18, enter the parent or guardian who signs and is paid.");
    if (f.abn && !/^\d{11}$/.test(f.abn.replace(/\s/g, ""))) return setError("ABN must be 11 digits.");
    setBusy(true);
    const db = supabase();
    const c = await db.from("creators").insert({
      display_name: f.displayName.trim(), legal_name: f.legalName.trim(), is_minor: f.minor, guardian_managed: f.minor,
      payee_name: f.payeeName.trim() || null, abn: f.abn.replace(/\s/g, "") || null, gst_registered: f.gst, referral_code: code,
    }).select("id").single();
    if (c.error) { setBusy(false); return setError(friendlyError(c.error).replace(/duplicate key.*referral_code.*/i, "That referral code is already used.")); }
    const i = await db.from("instructors").insert({
      creator_id: c.data.id, display_name: f.displayName.trim(), bio: f.bio.trim(), is_minor: f.minor, specialties: [...f.specialties],
    });
    let note = "";
    if (!i.error && f.loginEmail.trim()) {
      const l = await db.rpc("admin_link_creator_login", { p_creator: c.data.id, p_email: f.loginEmail.trim() });
      if (l.error) note = ` Portal login not linked: ${friendlyError(l.error)}`;
    }
    setBusy(false);
    if (i.error) return setError(`Creator saved, but the coach profile failed: ${friendlyError(i.error)}`);
    setOpen(false);
    setF({ displayName: "", legalName: "", minor: false, payeeName: "", abn: "", gst: false, code: "", bio: "", specialties: new Set(), loginEmail: "" });
    onDone(`${f.displayName} added with referral code ${code}. Next: “New contract version” to set their terms.${note}`);
  }

  if (!open) return <button onClick={() => setOpen(true)} className="mb-4 rounded-full bg-ink px-4 py-2 text-sm font-semibold text-paper">+ New creator</button>;
  const field = "mt-1 block w-full rounded border border-ink/20 bg-white px-2 py-1.5";
  return (
    <form onSubmit={save} className="mb-6 grid gap-3 rounded-xl bg-white p-4 text-sm ring-1 ring-ink/10 sm:grid-cols-2">
      <div className="font-semibold sm:col-span-2">New creator</div>
      <label>Name shown to families<input value={f.displayName} onChange={(e) => setF({ ...f, displayName: e.target.value })} placeholder="Coach Sam" className={field} /></label>
      <label>Legal name (contract)<input value={f.legalName} onChange={(e) => setF({ ...f, legalName: e.target.value })} className={field} /></label>
      <label className="flex items-center gap-2 sm:col-span-2"><input type="checkbox" checked={f.minor} onChange={(e) => setF({ ...f, minor: e.target.checked })} />Under 18 — managed by a parent or guardian (who signs, is paid, and gives filming consent)</label>
      <label>{f.minor ? "Parent / guardian name (payee)" : "Payee name (if different)"}<input value={f.payeeName} onChange={(e) => setF({ ...f, payeeName: e.target.value })} className={field} /></label>
      <label>ABN (optional)<input value={f.abn} onChange={(e) => setF({ ...f, abn: e.target.value })} inputMode="numeric" className={field} /></label>
      <label className="flex items-center gap-2 pt-5"><input type="checkbox" checked={f.gst} onChange={(e) => setF({ ...f, gst: e.target.checked })} />Registered for GST</label>
      <label>Referral code<input value={f.code} onChange={(e) => setF({ ...f, code: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "") })} placeholder={suggestCode(f.displayName) || "SAM"} className={field} /></label>
      <label className="sm:col-span-2">Short bio (shown to families)<input value={f.bio} onChange={(e) => setF({ ...f, bio: e.target.value })} maxLength={200} className={field} /></label>
      <fieldset className="sm:col-span-2"><legend>Specialties</legend>
        <div className="mt-1 flex flex-wrap gap-3">
          {(Object.keys(CATEGORY_LABEL) as CategoryId[]).map((k) => (
            <label key={k} className="flex items-center gap-1.5"><input type="checkbox" checked={f.specialties.has(k)} onChange={() => { const s = new Set(f.specialties); if (s.has(k)) s.delete(k); else s.add(k); setF({ ...f, specialties: s }); }} />{CATEGORY_LABEL[k]}</label>
          ))}
        </div>
      </fieldset>
      <label className="sm:col-span-2">Creator portal login (optional)<input type="email" value={f.loginEmail} onChange={(e) => setF({ ...f, loginEmail: e.target.value })} placeholder={f.minor ? "the guardian's email — they sign up on the website first" : "their email — they sign up on the website first"} className={field} /></label>
      {error && <p role="alert" className="text-[#b8361a] sm:col-span-2">{error}</p>}
      <div className="flex gap-2 sm:col-span-2">
        <button disabled={busy} className="rounded-full bg-ink px-4 py-2 font-semibold text-paper disabled:opacity-40">{busy ? "Saving…" : "Add creator"}</button>
        <button type="button" onClick={() => setOpen(false)} className="rounded-full px-4 py-2 font-semibold ring-1 ring-ink/20">Cancel</button>
      </div>
    </form>
  );
}
