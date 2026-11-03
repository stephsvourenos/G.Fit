"use client";

import { useEffect, useState } from "react";
import { Table } from "@/components/AdminShell";
import { friendlyError, supabase, supabaseConfigured } from "@/lib/supabase";

interface Row { at: string; actor_label: string | null; area: string; action: string }

/** Real audit entries from the database (admins only); sample rows in demo mode. */
export function LiveAudit({ sample }: { sample: string[][] }) {
  const [rows, setRows] = useState<string[][] | null>(supabaseConfigured ? null : sample);
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!supabaseConfigured) return;
    supabase()
      .from("audit_log")
      .select("at, actor_label, area, action")
      .order("at", { ascending: false })
      .limit(200)
      .then(({ data, error }) => {
        if (error) return setError(friendlyError(error));
        setRows(
          ((data ?? []) as Row[]).map((r) => [
            new Date(r.at).toLocaleString("en-AU", { timeZone: "Australia/Sydney", dateStyle: "medium", timeStyle: "short" }),
            r.actor_label ?? "system",
            r.area,
            r.action,
          ]),
        );
      });
  }, []);

  if (error) return <p role="alert" className="rounded-xl bg-coral/10 px-4 py-2.5 text-sm text-[#b8361a]">{error}</p>;
  if (!rows) return <p className="text-ink/60">Loading…</p>;
  if (rows.length === 0) return <p className="rounded-xl bg-white p-5 text-ink/60 ring-1 ring-ink/5">Nothing recorded yet. Changes made in Content approval will appear here.</p>;
  return (
    <Table head={["When (Sydney)", "Who", "Area", "What"]}>
      {rows.map((r, idx) => <tr key={idx}>{r.map((c, i) => <td key={i} className="px-4 py-3 text-sm">{c}</td>)}</tr>)}
    </Table>
  );
}
