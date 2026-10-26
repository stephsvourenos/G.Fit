"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { brand } from "@app/config";

export const ADMIN_NAV: Array<[string, string, string?]> = [
  ["/admin/", "Overview"],
  ["/admin/content/", "Content approval & scheduling"],
  ["/admin/uploads/", "Media uploads", "Phase 2"],
  ["/admin/creators/", "Creators & contracts"],
  ["/admin/pricing/", "Plans, pricing & promotions"],
  ["/admin/subscribers/", "Subscribers & entitlements"],
  ["/admin/referrals/", "Referrals"],
  ["/admin/playback/", "Playback & fraud alerts"],
  ["/admin/royalties/", "Monthly royalty run"],
  ["/admin/ledger/", "Creator liability ledger"],
  ["/admin/payouts/", "Payout batches"],
  ["/admin/audit/", "Audit log"],
  ["/admin/settings/", "Configuration"],
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  return (
    <div className="flex flex-1 flex-col bg-[#f4f5f7] text-ink lg:flex-row">
      <aside className="border-b border-ink/10 bg-white lg:min-h-full lg:w-64 lg:border-b-0 lg:border-r">
        <div className="flex items-center justify-between px-5 py-4">
          <Link href="/admin/" className="font-display text-lg font-semibold">{brand.name} <span className="text-coral">Admin</span></Link>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-col lg:overflow-visible">
          {ADMIN_NAV.map(([href, label, phase]) => (
            <Link
              key={href}
              href={href}
              className={`flex shrink-0 items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm ${path === href ? "bg-ink text-paper" : "text-ink/75 hover:bg-ink/5"}`}
            >
              <span>{label}</span>
              {phase && <span className="rounded bg-ink/10 px-1.5 text-[10px] font-semibold text-ink/60">{phase}</span>}
            </Link>
          ))}
        </nav>
        <div className="hidden px-5 py-4 text-xs text-ink/50 lg:block">
          Signed in as <b>ops@demo</b> (role: owner). Prototype — no real logins yet.
          <div className="mt-3 flex gap-3"><Link href="/" className="underline">Website</Link><Link href="/creator/" className="underline">Creator portal</Link></div>
        </div>
      </aside>
      <main className="min-w-0 flex-1 p-4 sm:p-8">{children}</main>
    </div>
  );
}

export function PageHeader({ title, sub, children }: { title: string; sub?: string; children?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-display text-3xl">{title}</h1>
        {sub && <p className="mt-1 max-w-3xl text-sm text-ink/60">{sub}</p>}
      </div>
      {children}
    </div>
  );
}

export function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl bg-white p-4 ring-1 ring-ink/5">
      <div className="text-xs font-semibold uppercase tracking-wide text-ink/50">{label}</div>
      <div className="font-display mt-1 text-2xl tabular-nums">{value}</div>
      {hint && <div className="mt-0.5 text-xs text-ink/50">{hint}</div>}
    </div>
  );
}

export function Badge({ tone = "grey", children }: { tone?: "grey" | "green" | "amber" | "red" | "blue"; children: React.ReactNode }) {
  const tones = {
    grey: "bg-ink/5 text-ink/70",
    green: "bg-mint/15 text-[#0f7a57]",
    amber: "bg-sun/25 text-[#8a5a00]",
    red: "bg-coral/15 text-[#b8361a]",
    blue: "bg-sky/10 text-sky",
  };
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${tones[tone]}`}>{children}</span>;
}

export function Table({ head, children }: { head: string[]; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-xl bg-white ring-1 ring-ink/5">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-ink/5 text-xs uppercase tracking-wide text-ink/50">
          <tr>{head.map((h) => <th key={h} className="whitespace-nowrap px-4 py-3 font-semibold">{h}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-ink/5 tabular-nums">{children}</tbody>
      </table>
    </div>
  );
}
