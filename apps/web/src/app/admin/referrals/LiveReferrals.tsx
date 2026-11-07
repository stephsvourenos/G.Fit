"use client";

import { useEffect, useState, type ReactNode } from "react";
import { formatMoney } from "@app/domain";
import { Table } from "@/components/AdminShell";
import { friendlyError, supabase, supabaseConfigured } from "@/lib/supabase";

interface Row {
  id: string;
  name: string;
  code: string;
  clicks: number;
  trials: number;
  trialsRefused: number;
  paying: number;
  commission: number;
  terms?: string;
}

async function load(): Promise<{ rows: Row[]; error?: string }> {
  const db = supabase();
  const [c, k, cl, tr, at, le] = await Promise.all([
    db
      .from("creators")
      .select("id, display_name, referral_code")
      .order("display_name"),
    db
      .from("creator_contracts")
      .select("creator_id, version, terms")
      .order("version", { ascending: false }),
    db.from("referral_clicks").select("referral_code"),
    db.from("trial_claims").select("referral_code, outcome"),
    db.from("referral_attributions").select("creator_id"),
    db
      .from("ledger_entries")
      .select("creator_id, kind, amount_minor, sourceRefs:source_refs")
      .eq("run_status", "final")
      .in("kind", ["referral", "adjustment"]),
  ]);
  const err =
    c.error ?? k.error ?? cl.error ?? tr.error ?? at.error ?? le.error;
  if (err) return { rows: [], error: friendlyError(err) };
  const rows = (c.data ?? []).map((cr) => {
    const terms = (k.data ?? []).find((x) => x.creator_id === cr.id)?.terms
      ?.referral;
    return {
      id: cr.id,
      name: cr.display_name,
      code: cr.referral_code,
      clicks: (cl.data ?? []).filter(
        (x) => x.referral_code === cr.referral_code,
      ).length,
      trials: (tr.data ?? []).filter(
        (x) => x.referral_code === cr.referral_code && x.outcome === "granted",
      ).length,
      trialsRefused: (tr.data ?? []).filter(
        (x) => x.referral_code === cr.referral_code && x.outcome !== "granted",
      ).length,
      paying: (at.data ?? []).filter((x) => x.creator_id === cr.id).length,
      // referral commission and its refund reversals (reversals keep the "ref:" id prefix)
      commission: (le.data ?? [])
        .filter((x) => x.creator_id === cr.id)
        .reduce((a, x) => a + Number(x.amount_minor), 0),
      terms: terms
        ? `${terms.rateBps / 100}% × ${terms.maxPaidMonths} paid months${terms.newReferralsPaused ? " (paused)" : ""}`
        : undefined,
    };
  });
  return { rows };
}

/** Referral funnel per creator: link visits → free trials started → paying families → commission (final months). */
export function LiveReferrals({ demo }: { demo: ReactNode }) {
  const [data, setData] = useState<{ rows: Row[]; error?: string }>();
  useEffect(() => {
    if (supabaseConfigured) load().then(setData);
  }, []);
  if (!supabaseConfigured) return <>{demo}</>;
  if (!data) return <p className="text-ink/60">Loading…</p>;
  if (data.error)
    return (
      <p
        role="alert"
        className="rounded-xl bg-coral/10 px-4 py-2.5 text-sm text-[#b8361a]"
      >
        {data.error}
      </p>
    );
  return (
    <>
      <Table
        head={[
          "Creator",
          "Code",
          "Current terms",
          "Link visits",
          "Trials started",
          "Paying families",
          "Visit → paying",
          "Commission (final)",
        ]}
      >
        {data.rows.map((r) => (
          <tr key={r.id}>
            <td className="px-4 py-3 font-semibold">{r.name}</td>
            <td className="px-4 py-3 font-mono text-xs">{r.code}</td>
            <td className="px-4 py-3 text-xs">{r.terms ?? "no contract"}</td>
            <td className="px-4 py-3">{r.clicks}</td>
            <td className="px-4 py-3">
              {r.trials}
              {r.trialsRefused > 0 && (
                <div className="text-xs text-ink/50">
                  +{r.trialsRefused} refused (repeat card)
                </div>
              )}
            </td>
            <td className="px-4 py-3">{r.paying}</td>
            <td className="px-4 py-3 text-xs">
              {r.clicks ? `${Math.round((r.paying / r.clicks) * 100)}%` : "—"}
            </td>
            <td className="px-4 py-3">{formatMoney(r.commission)}</td>
          </tr>
        ))}
      </Table>
      <p className="mt-4 text-xs text-ink/50">
        Visits are counted once per browser per day. A family is credited to one
        creator, once, on its first payment — using the creator’s referral terms
        at that moment. Self-referrals and creators who aren’t accepting new
        referrals are not credited.
      </p>
    </>
  );
}
