"use client";

import Link from "next/link";
import { useState } from "react";
import { formatMoney } from "@app/domain";
import { brand } from "@app/config";

export interface CreatorData {
  id: string;
  name: string;
  isMinor: boolean;
  code: string;
  bankOnFile: boolean;
  months: string[];
  statements: Array<{ month: string; status: string; royalties: number; referrals: number; adjustments: number; closing: number; payDate: string }>;
  minutesByMonth: number[];
  households: number[];
  funnel: { clicks: number; registered: number; paying: number };
  referredActive: number;
  payouts: Array<{ batch: string; status: string; amount: number; date: string }>;
  videos: Array<{ title: string; state: string }>;
}

export function CreatorPortal({ data }: { data: CreatorData[] }) {
  const [id, setId] = useState(data[3]!.id);
  const c = data.find((x) => x.id === id)!;
  const last = c.statements.at(-1)!;
  const paid = c.payouts.filter((p) => p.status === "confirmed").reduce((a, p) => a + p.amount, 0);
  const maxMin = Math.max(1, ...c.minutesByMonth);

  return (
    <main className="flex-1 bg-paper-2">
      <header className="border-b border-ink/10 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <Link href="/" className="font-display text-lg font-semibold">{brand.name} <span className="text-coral">Creators</span></Link>
          <label className="flex items-center gap-2 text-sm">
            <span className="text-ink/60">Demo: viewing as</span>
            <select value={id} onChange={(e) => setId(e.target.value)} className="rounded-lg border border-ink/15 bg-white px-2 py-1.5">
              {data.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </label>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <h1 className="font-display text-4xl">Hi, {c.name}</h1>
        {c.isMinor && <p className="mt-1 text-sm text-ink/60">This account is managed by a parent or guardian, who receives statements and payments.</p>}

        <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            ["Earned in Oct (provisional)", formatMoney(last.royalties + last.referrals + last.adjustments)],
            ["Balance owed to you", formatMoney(last.closing)],
            ["Paid to date", formatMoney(paid)],
            ["Households you referred", String(c.referredActive)],
          ].map(([k, v]) => (
            <div key={k} className="rounded-2xl bg-white p-4 ring-1 ring-ink/5">
              <div className="text-xs font-semibold uppercase tracking-wide text-ink/50">{k}</div>
              <div className="font-display mt-1 text-2xl tabular-nums">{v}</div>
            </div>
          ))}
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1.3fr_1fr]">
          <section className="rounded-2xl bg-white p-5 ring-1 ring-ink/5">
            <h2 className="font-semibold">Qualified viewing of your workouts</h2>
            <p className="text-xs text-ink/50">Totals only — we never share who watched.</p>
            <div className="mt-5 flex h-40 items-end gap-3">
              {c.months.map((m, i) => (
                <div key={m} className="flex flex-1 flex-col items-center gap-1.5">
                  <div className="text-[11px] tabular-nums text-ink/60">{c.minutesByMonth[i]!.toLocaleString()}</div>
                  <div className="w-full rounded-t-md bg-coral" style={{ height: `${(c.minutesByMonth[i]! / maxMin) * 110}px` }} />
                  <div className="text-[11px] text-ink/50">{m.slice(5)}/{m.slice(2, 4)}</div>
                </div>
              ))}
            </div>
            <p className="mt-2 text-xs text-ink/50">Minutes · {c.households.at(-1)} households watched in October</p>
          </section>

          <section className="rounded-2xl bg-white p-5 ring-1 ring-ink/5">
            <h2 className="font-semibold">Your referral link</h2>
            <div className="mt-2 flex items-center gap-2 rounded-xl bg-paper-2 px-3 py-2 font-mono text-sm">/r/{c.code}</div>
            <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
              {[["Clicks", c.funnel.clicks], ["Sign-ups", c.funnel.registered], ["Paying", c.funnel.paying]].map(([k, v]) => (
                <div key={k as string} className="rounded-xl bg-paper-2 p-3"><dt className="text-xs text-ink/50">{k}</dt><dd className="font-display text-xl">{(v as number).toLocaleString()}</dd></div>
              ))}
            </dl>
            <p className="mt-3 text-xs text-ink/50">You earn your agreed referral rate on each referred household’s paid months, for the number of paid months in your contract.</p>
          </section>
        </div>

        <section className="mt-6 rounded-2xl bg-white p-5 ring-1 ring-ink/5">
          <h2 className="font-semibold">Monthly statements</h2>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm tabular-nums">
              <thead className="text-left text-xs uppercase text-ink/50"><tr>{["Month", "Status", "Content royalties", "Referral", "Adjustments", "Balance", "Pay date", ""].map((h) => <th key={h} className="py-2 pr-4">{h}</th>)}</tr></thead>
              <tbody className="divide-y divide-ink/5">
                {[...c.statements].reverse().map((s) => (
                  <tr key={s.month}>
                    <td className="py-2 pr-4 font-semibold">{s.month}</td>
                    <td className="py-2 pr-4 text-xs">{s.status}</td>
                    <td className="py-2 pr-4">{formatMoney(s.royalties)}</td>
                    <td className="py-2 pr-4">{formatMoney(s.referrals)}</td>
                    <td className="py-2 pr-4">{formatMoney(s.adjustments)}</td>
                    <td className="py-2 pr-4">{formatMoney(s.closing)}</td>
                    <td className="py-2 pr-4 text-xs">{s.payDate}</td>
                    <td className="py-2 text-xs"><button disabled className="text-sky/60" title="PDF statements arrive in Phase 4">PDF</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <section className="rounded-2xl bg-white p-5 ring-1 ring-ink/5">
            <h2 className="font-semibold">Payments</h2>
            <ul className="mt-2 divide-y divide-ink/5 text-sm">
              {c.payouts.map((p) => <li key={p.batch} className="flex justify-between py-2"><span>{p.batch} · {p.status}</span><span className="tabular-nums">{formatMoney(p.amount)} · {p.date}</span></li>)}
              {c.payouts.length === 0 && <li className="py-2 text-ink/50">No payments yet.</li>}
            </ul>
            <p className="mt-3 text-xs text-ink/50">
              Bank details: {c.bankOnFile ? "on file (shown masked)" : "missing — payments are on hold"}. Changes go through a verified request, never by email.
            </p>
          </section>
          <section className="rounded-2xl bg-white p-5 ring-1 ring-ink/5">
            <h2 className="font-semibold">Your licensed workouts</h2>
            <ul className="mt-2 divide-y divide-ink/5 text-sm">
              {c.videos.map((v) => <li key={v.title} className="flex justify-between py-2"><span>{v.title}</span><span className="text-xs text-ink/50">{v.state}</span></li>)}
            </ul>
            <p className="mt-3 text-xs text-ink/50">To propose a new workout, contact the content team. Creators can’t publish or edit videos directly.</p>
          </section>
        </div>
      </div>
    </main>
  );
}
