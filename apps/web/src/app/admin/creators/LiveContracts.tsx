"use client";

import { useEffect, useState, type ReactNode } from "react";
import { formatMoney } from "@app/domain";
import { Badge, Table } from "@/components/AdminShell";
import { friendlyError, supabase, supabaseConfigured } from "@/lib/supabase";

interface Terms {
  licenceStartMonth: string;
  licenceEndMonth?: string;
  royaltyEligible: boolean;
  royaltyPauses: { fromMonth: string; toMonth: string }[];
  guardianManaged: boolean;
  referral: { rateBps: number; maxPaidMonths: number; acceptNewFromMonth: string; acceptNewUntilMonth?: string; newReferralsPaused: boolean; attributionWindowDays: number };
  payout: { minPayoutMinor: number; monthsAfterEarning: number; payDay: number };
  [k: string]: unknown;
}
interface Contract { contract_id: string; version: number; creator_id: string; terms: Terms; effective_from: string; created_at: string }
interface Creator { id: string; display_name: string; status: string; referral_code: string; is_minor: boolean; guardian_managed: boolean; payee_name: string | null; abn: string | null; gst_registered: boolean }
interface Balance { creator_id: string; closing_balance_minor: number; month: string }

const load = async () => {
  const db = supabase();
  const [c, k, s] = await Promise.all([
    db.from("creators").select("id, display_name, status, referral_code, is_minor, guardian_managed, payee_name, abn, gst_registered").order("display_name"),
    db.from("creator_contracts").select("*").order("version", { ascending: false }),
    db.from("creator_statements").select("creator_id, closing_balance_minor, month").order("month", { ascending: false }),
  ]);
  return { error: c.error ?? k.error ?? s.error, creators: (c.data ?? []) as Creator[], contracts: (k.data ?? []) as Contract[], balances: (s.data ?? []) as Balance[] };
};

/** Creators and versioned contracts (admin). A change = a NEW version; old versions stay for reproducible statements. */
export function LiveContracts({ demo }: { demo: ReactNode }) {
  const [data, setData] = useState<Awaited<ReturnType<typeof load>>>();
  const [editing, setEditing] = useState<string>();
  const [form, setForm] = useState<Record<string, string | boolean>>({});
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string }>();

  useEffect(() => {
    if (supabaseConfigured) load().then(setData);
  }, []);
  if (!supabaseConfigured) return <>{demo}</>;
  if (!data) return <p className="text-ink/60">Loading…</p>;
  if (data.error) return <p role="alert" className="rounded-xl bg-coral/10 px-4 py-2.5 text-sm text-[#b8361a]">{friendlyError(data.error)}</p>;

  const latest = (id: string) => data.contracts.find((k) => k.creator_id === id);
  const startEdit = (c: Creator) => {
    const k = latest(c.id);
    const t = k?.terms;
    setEditing(c.id);
    setMsg(undefined);
    setForm({
      licenceEndMonth: t?.licenceEndMonth ?? "",
      pauseFrom: t?.royaltyPauses?.at(-1)?.fromMonth ?? "",
      pauseTo: t?.royaltyPauses?.at(-1)?.toMonth ?? "",
      ratePct: String((t?.referral.rateBps ?? 1000) / 100),
      maxPaidMonths: String(t?.referral.maxPaidMonths ?? 12),
      referralsPaused: t?.referral.newReferralsPaused ?? false,
      minPayout: String((t?.payout.minPayoutMinor ?? 10000) / 100),
    });
  };
  const save = async (c: Creator) => {
    const k = latest(c.id);
    const today = new Date().toISOString().slice(0, 10);
    const month = today.slice(0, 7);
    const base: Terms = k?.terms ?? {
      payoutCurrency: "AUD", royaltyEligible: true, netReceiptsPolicyVersion: "net-receipts-v1", royaltyPoolPolicyVersion: "royalty-pool-v1",
      guardianManaged: c.guardian_managed, licenceStartMonth: month, royaltyPauses: [],
      referral: { rateBps: 1000, maxPaidMonths: 12, acceptNewFromMonth: month, newReferralsPaused: false, attributionWindowDays: 30 },
      payout: { minPayoutMinor: 10000, monthsAfterEarning: 3, payDay: 15 },
    };
    const rate = Math.round(Number(form.ratePct) * 100);
    const months = Number(form.maxPaidMonths);
    const minPayout = Math.round(Number(form.minPayout) * 100);
    if (!(rate >= 0 && rate <= 5000) || !(months >= 0 && months <= 240) || !(minPayout >= 0)) {
      return setMsg({ tone: "err", text: "Check the numbers: referral rate 0–50%, paid months 0–240, minimum payout ≥ 0." });
    }
    const pauses = form.pauseFrom && form.pauseTo ? [{ fromMonth: String(form.pauseFrom), toMonth: String(form.pauseTo) }] : [];
    const terms: Terms = {
      ...base,
      licenceEndMonth: form.licenceEndMonth ? String(form.licenceEndMonth) : undefined,
      royaltyPauses: pauses,
      referral: { ...base.referral, rateBps: rate, maxPaidMonths: months, newReferralsPaused: Boolean(form.referralsPaused) },
      payout: { ...base.payout, minPayoutMinor: minPayout },
    };
    const { error } = await supabase().from("creator_contracts").insert({
      contract_id: k?.contract_id ?? `CT-${c.referral_code.toUpperCase()}`,
      version: (k?.version ?? 0) + 1,
      creator_id: c.id,
      terms,
      effective_from: today,
      created_by: (await supabase().auth.getUser()).data.user?.id,
    });
    if (error) return setMsg({ tone: "err", text: friendlyError(error) });
    setMsg({ tone: "ok", text: `Saved ${c.display_name} contract v${(k?.version ?? 0) + 1}. Families already referred keep the terms they joined under.` });
    setEditing(undefined);
    setData(await load());
  };

  const input = (key: string, label: string, type = "text", hint?: string) => (
    <label className="text-xs">
      {label}
      <input type={type} value={String(form[key] ?? "")} onChange={(e) => setForm({ ...form, [key]: e.target.value })} className="mt-1 block w-36 rounded border border-ink/20 px-2 py-1 text-sm" />
      {hint && <span className="text-ink/40">{hint}</span>}
    </label>
  );

  return (
    <>
      {msg && <p role="alert" className={`mb-4 rounded-xl px-4 py-2.5 text-sm ${msg.tone === "ok" ? "bg-mint/15 text-[#0f6a4a]" : "bg-coral/10 text-[#b8361a]"}`}>{msg.text}</p>}
      <Table head={["Creator", "Contract", "Licence", "Referral terms", "Payout", "Payee", "Balance (final)", ""]}>
        {data.creators.map((c) => {
          const k = latest(c.id);
          const t = k?.terms;
          const versions = data.contracts.filter((x) => x.creator_id === c.id).length;
          const bal = data.balances.find((b) => b.creator_id === c.id);
          const paused = t?.royaltyPauses?.find((p) => p.toMonth >= new Date().toISOString().slice(0, 7));
          return (
            <tr key={c.id} className="align-top">
              <td className="px-4 py-3 font-semibold">
                {c.display_name}
                <div className="text-xs font-normal text-ink/50">code {c.referral_code} · <Badge tone={c.status === "active" ? "green" : "grey"}>{c.status}</Badge></div>
              </td>
              <td className="px-4 py-3 text-xs">{k ? `${k.contract_id} v${k.version}` : "none"}<div className="text-ink/50">{versions} version{versions === 1 ? "" : "s"}</div></td>
              <td className="px-4 py-3 text-xs">
                {t ? `${t.licenceStartMonth} → ${t.licenceEndMonth ?? "ongoing"}` : "—"}
                {paused && <div className="text-[#b8361a]">paused {paused.fromMonth}–{paused.toMonth}</div>}
              </td>
              <td className="px-4 py-3 text-xs">
                {t ? `${t.referral.rateBps / 100}% × ${t.referral.maxPaidMonths} paid months` : "—"}
                {t?.referral.newReferralsPaused && <div className="text-[#b8361a]">new referrals paused</div>}
              </td>
              <td className="px-4 py-3 text-xs">{t ? `min ${formatMoney(t.payout.minPayoutMinor)} · ${t.payout.payDay}th, +${t.payout.monthsAfterEarning} months` : "—"}</td>
              <td className="px-4 py-3 text-xs">
                {c.guardian_managed || t?.guardianManaged ? <><Badge tone="amber">guardian-managed</Badge><div className="mt-1">{c.payee_name ?? "payee not set"}</div></> : c.payee_name ?? "creator"}
                <div className="text-ink/50">ABN {c.abn ?? "—"} · GST {c.gst_registered ? "registered" : "not registered"}</div>
              </td>
              <td className="px-4 py-3">{bal ? formatMoney(bal.closing_balance_minor) : "—"}<div className="text-xs text-ink/50">{bal?.month}</div></td>
              <td className="px-4 py-3 text-xs">
                {editing === c.id ? (
                  <div className="grid gap-2">
                    {input("licenceEndMonth", "Licence ends (month)", "month")}
                    <div className="flex gap-2">{input("pauseFrom", "Pause from", "month")}{input("pauseTo", "Pause to", "month")}</div>
                    {input("ratePct", "Referral %")}
                    {input("maxPaidMonths", "Paid months")}
                    <label className="flex items-center gap-2"><input type="checkbox" checked={Boolean(form.referralsPaused)} onChange={(e) => setForm({ ...form, referralsPaused: e.target.checked })} /> Pause new referrals</label>
                    {input("minPayout", "Minimum payout (A$)")}
                    <div className="flex gap-2">
                      <button onClick={() => save(c)} className="rounded-full bg-ink px-3 py-1.5 font-semibold text-paper">Save as new version</button>
                      <button onClick={() => setEditing(undefined)} className="px-2 text-ink/60">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => startEdit(c)} className="rounded-full px-3 py-1 font-semibold ring-1 ring-ink/20">New version…</button>
                )}
              </td>
            </tr>
          );
        })}
      </Table>
      <p className="mt-4 text-xs text-ink/50">
        Contract versions can’t be edited or deleted. GST and withholding treatment on creator payments is pending your accountant’s advice (see Decisions).
      </p>
    </>
  );
}
