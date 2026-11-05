"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { brand } from "@app/config";
import { ROLE_LABEL, useStaffSession } from "@/lib/staff";
import { supabase, supabaseConfigured } from "@/lib/supabase";

/** Pages that already run on the real database; the rest still show sample figures. */
const LIVE_PAGES = ["/admin/content/", "/admin/audit/", "/admin/playback/"];

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
  const router = useRouter();
  const staff = useStaffSession();

  useEffect(() => {
    if (staff.state === "signed-out") router.replace(`/account/sign-in/?next=${encodeURIComponent(path)}`);
  }, [staff.state, path, router]);

  if (staff.state === "loading" || staff.state === "signed-out") {
    return <div className="grid flex-1 place-items-center bg-[#f4f5f7] text-ink/60">Checking your access…</div>;
  }
  if (staff.state === "no-access" || staff.roles.length === 0) {
    return (
      <div className="grid flex-1 place-items-center bg-[#f4f5f7] p-6 text-center text-ink">
        <div className="max-w-md">
          <h1 className="font-display text-3xl">No admin access</h1>
          <p className="mt-2 text-ink/65">You’re signed in as {staff.email}, which isn’t a staff account. Ask an admin to add you, or sign in with a different account.</p>
          <div className="mt-5 flex justify-center gap-3">
            {staff.creatorIds.length > 0 && <Link href="/creator/" className="rounded-full bg-ink px-4 py-2 font-semibold text-paper">Go to creator portal</Link>}
            <button onClick={() => supabase().auth.signOut().then(() => router.push("/account/sign-in/?next=/admin/"))} className="rounded-full px-4 py-2 font-semibold ring-1 ring-ink/20">Sign in as someone else</button>
          </div>
        </div>
      </div>
    );
  }

  const sample = supabaseConfigured && !LIVE_PAGES.includes(path);
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
          Signed in as <b>{staff.email}</b> ({staff.roles.map((r) => ROLE_LABEL[r]).join(", ")}).
          <div className="mt-3 flex flex-wrap gap-3">
            <Link href="/" className="underline">Website</Link>
            <Link href="/creator/" className="underline">Creator portal</Link>
            {supabaseConfigured && (
              <button onClick={() => supabase().auth.signOut().then(() => router.push("/"))} className="underline">Sign out</button>
            )}
          </div>
        </div>
      </aside>
      <main className="min-w-0 flex-1 p-4 sm:p-8">
        {sample && (
          <p className="mb-5 rounded-xl bg-sun/25 px-4 py-2.5 text-sm text-ink">
            <b>Sample figures.</b> This page shows the simulated demo data until payments and creator payouts go live (Phases 3–5).
            Content approval and the audit log already use the real database.
          </p>
        )}
        {children}
      </main>
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
