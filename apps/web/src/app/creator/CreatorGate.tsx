"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { brand } from "@app/config";
import { CATEGORY_LABEL, formatDuration, formatMoney, type CategoryId } from "@app/domain";
import { useStaffSession } from "@/lib/staff";
import { friendlyError, supabase, supabaseConfigured } from "@/lib/supabase";

/**
 * Creator portal access:
 *  - demo mode: the sample portal;
 *  - a creator's (or guardian's) login: their own record, from the database;
 *  - an admin: the sample portal as a preview.
 * The database only ever returns a creator's own rows — never households,
 * profiles or anyone's viewing activity.
 */
export function CreatorGate({ sample }: { sample: React.ReactNode }) {
  const s = useStaffSession();
  const router = useRouter();

  useEffect(() => {
    if (s.state === "signed-out") router.replace("/account/sign-in/?next=/creator/");
  }, [s.state, router]);

  if (!supabaseConfigured) return <>{sample}</>;
  if (s.state === "loading" || s.state === "signed-out") return <div className="grid flex-1 place-items-center bg-paper-2 text-ink/60">Checking your access…</div>;
  if (s.creatorIds.length > 0) return <CreatorLive creatorId={s.creatorIds[0]!} email={s.email} />;
  if (s.roles.includes("admin") || s.roles.includes("finance")) {
    return (
      <>
        <p className="bg-sun/25 px-4 py-2.5 text-center text-sm text-ink">
          <b>Admin preview with sample data.</b> Creators who sign in see only their own record and figures.
        </p>
        {sample}
      </>
    );
  }
  return (
    <main className="grid flex-1 place-items-center bg-paper-2 p-6 text-center">
      <div className="max-w-md">
        <h1 className="font-display text-3xl">No creator access</h1>
        <p className="mt-2 text-ink/65">{s.email} isn’t linked to a creator. If you’re one of our instructors (or a parent of one), ask us to link your login.</p>
        <button onClick={() => supabase().auth.signOut().then(() => router.push("/account/sign-in/?next=/creator/"))} className="mt-5 rounded-full px-4 py-2 font-semibold ring-1 ring-ink/20">Sign in as someone else</button>
      </div>
    </main>
  );
}

interface CreatorRow { id: string; display_name: string; status: string; referral_code: string | null; guardian_managed: boolean }
interface LedgerRow { id: string; kind: string; amount_minor: number; earning_month: string; run_status: string; memo: string | null }
interface WorkoutLite { title: string; category: string; duration_sec: number; instructor_id: string }

function CreatorLive({ creatorId, email }: { creatorId: string; email?: string }) {
  const router = useRouter();
  const [creator, setCreator] = useState<CreatorRow>();
  const [ledger, setLedger] = useState<LedgerRow[]>([]);
  const [videos, setVideos] = useState<WorkoutLite[]>([]);
  const [error, setError] = useState<string>();

  useEffect(() => {
    const db = supabase();
    Promise.all([
      db.from("creators").select("id, display_name, status, referral_code, guardian_managed").eq("id", creatorId).single(),
      db.from("ledger_entries").select("id, kind, amount_minor, earning_month, run_status, memo").eq("creator_id", creatorId).order("earning_month", { ascending: false }),
      db.from("instructors").select("id").eq("creator_id", creatorId),
    ])
      .then(async ([c, l, ins]) => {
        if (c.error) throw c.error;
        setCreator(c.data as CreatorRow);
        setLedger((l.data ?? []) as LedgerRow[]);
        const ids = (ins.data ?? []).map((x) => x.id);
        if (ids.length) {
          const w = await db.from("workouts").select("title, category, duration_sec, instructor_id").in("instructor_id", ids).order("title");
          setVideos((w.data ?? []) as WorkoutLite[]);
        }
      })
      .catch((e) => setError(friendlyError(e)));
  }, [creatorId]);

  const balance = ledger.filter((e) => e.run_status === "final").reduce((a, e) => a + e.amount_minor, 0);

  return (
    <main className="flex-1 bg-paper-2">
      <header className="border-b border-ink/10 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <Link href="/" className="font-display text-lg font-semibold">{brand.name} <span className="text-coral">Creators</span></Link>
          <div className="flex items-center gap-3 text-sm text-ink/60">
            {email}
            <button onClick={() => supabase().auth.signOut().then(() => router.push("/"))} className="underline">Sign out</button>
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        {error && <p role="alert" className="rounded-xl bg-coral/10 px-4 py-2.5 text-sm text-[#b8361a]">{error}</p>}
        {!creator && !error && <p className="text-ink/60">Loading your portal…</p>}
        {creator && (
          <>
            <h1 className="font-display text-4xl">Hi, {creator.display_name}</h1>
            {creator.guardian_managed && <p className="mt-1 text-sm text-ink/60">This account is managed by a parent or guardian, who receives statements and payments.</p>}
            <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
              {[
                ["Balance owed to you", formatMoney(balance)],
                ["Status", creator.status === "active" ? "Active" : creator.status === "paused" ? "Paused" : "Licence ended"],
                ["Your referral link", creator.referral_code ? `/r/${creator.referral_code}` : "Not set up yet"],
              ].map(([k, v]) => (
                <div key={k} className="rounded-2xl bg-white p-4 ring-1 ring-ink/5">
                  <div className="text-xs font-semibold uppercase tracking-wide text-ink/50">{k}</div>
                  <div className="font-display mt-1 text-2xl tabular-nums">{v}</div>
                </div>
              ))}
            </div>

            <section className="mt-6 rounded-2xl bg-white p-5 ring-1 ring-ink/5">
              <h2 className="font-semibold">Earnings and statements</h2>
              {ledger.length === 0 ? (
                <p className="mt-2 text-sm text-ink/60">
                  Nothing yet. Royalties and referral commission start once family memberships go on sale. Each month you’ll see
                  what you earned, any adjustments, and when it will be paid.
                </p>
              ) : (
                <ul className="mt-2 divide-y divide-ink/5 text-sm">
                  {ledger.map((e) => (
                    <li key={e.id} className="flex justify-between py-2"><span>{e.earning_month} · {e.kind} · {e.run_status}</span><span className="tabular-nums">{formatMoney(e.amount_minor)}</span></li>
                  ))}
                </ul>
              )}
            </section>

            <section className="mt-6 rounded-2xl bg-white p-5 ring-1 ring-ink/5">
              <h2 className="font-semibold">Your licensed workouts</h2>
              {videos.length === 0 ? (
                <p className="mt-2 text-sm text-ink/60">No published workouts yet.</p>
              ) : (
                <ul className="mt-2 divide-y divide-ink/5 text-sm">
                  {videos.map((v) => (
                    <li key={v.title} className="flex justify-between py-2"><span>{v.title}</span><span className="text-xs text-ink/50">{CATEGORY_LABEL[v.category as CategoryId] ?? v.category} · {formatDuration(v.duration_sec)}</span></li>
                  ))}
                </ul>
              )}
              <p className="mt-3 text-xs text-ink/50">To propose a new workout, contact the content team. Creators can’t publish or edit videos directly.</p>
            </section>
            <p className="mt-6 text-xs text-ink/50">You only ever see totals for your own work. We never share who watched, or any details about the families or children who use the service.</p>
          </>
        )}
      </div>
    </main>
  );
}
