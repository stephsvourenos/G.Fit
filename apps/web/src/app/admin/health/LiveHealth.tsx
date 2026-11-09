"use client";

import { useEffect, useState } from "react";
import { Badge, Kpi, Table } from "@/components/AdminShell";
import { friendlyError, supabase, supabaseConfigured } from "@/lib/supabase";

interface Ev {
  id: number; source: string; level: string; title: string; detail: Record<string, unknown>; count: number;
  first_at: string; last_at: string; resolved_at: string | null; alerted_at: string | null;
}
const SOURCE: Record<string, string> = { web: "Website", mobile: "App", function: "Server", health: "Health check", database: "Database" };
const when = (iso: string) => new Date(iso).toLocaleString("en-AU", { dateStyle: "medium", timeStyle: "short" });

export function LiveHealth() {
  const [rows, setRows] = useState<Ev[]>();
  const [showResolved, setShowResolved] = useState(false);
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string }>();
  const [busy, setBusy] = useState(false);
  const [loadedAt, setLoadedAt] = useState(0);

  const load = async (resolved = showResolved) => {
    let q = supabase().from("system_events").select("*").order("last_at", { ascending: false }).limit(200);
    if (!resolved) q = q.is("resolved_at", null);
    const { data, error } = await q;
    if (error) setMsg({ tone: "err", text: friendlyError(error) });
    else { setRows(data as Ev[]); setLoadedAt(Date.now()); }
  };
  useEffect(() => { if (supabaseConfigured) void load(); }, []); // eslint-disable-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps
  if (!supabaseConfigured) return <p className="text-ink/60">Needs the live database.</p>;

  const check = async () => {
    setBusy(true);
    const { data, error } = await supabase().rpc("run_health_check");
    setBusy(false);
    setMsg(error ? { tone: "err", text: friendlyError(error) } : { tone: data ? "err" : "ok", text: data ? `Health check found ${data} problem${data === 1 ? "" : "s"}.` : "Health check passed — scheduled jobs, emails and month-end look fine." });
    load();
  };
  const resolve = async (id: number, done: boolean) => {
    const { data: u } = await supabase().auth.getUser();
    const { error } = await supabase().from("system_events").update({ resolved_at: done ? new Date().toISOString() : null, resolved_by: done ? u.user?.id : null }).eq("id", id);
    if (error) setMsg({ tone: "err", text: friendlyError(error) });
    load();
  };

  const open = rows?.filter((r) => !r.resolved_at) ?? [];
  return (
    <>
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Open problems" value={rows ? String(open.length) : "…"} />
        <Kpi label="Errors" value={rows ? String(open.filter((r) => r.level === "error").length) : "…"} />
        <Kpi label="Warnings" value={rows ? String(open.filter((r) => r.level === "warning").length) : "…"} />
        <Kpi label="Last 24 hours" value={rows ? String(open.filter((r) => loadedAt - new Date(r.last_at).getTime() < 86400_000).length) : "…"} hint="problems seen" />
      </div>
      {msg && <p role="alert" className={`mb-4 rounded-xl px-4 py-2.5 text-sm ${msg.tone === "ok" ? "bg-mint/15 text-[#0f6a4a]" : "bg-coral/10 text-[#b8361a]"}`}>{msg.text}</p>}
      <div className="mb-4 flex flex-wrap items-center gap-3 text-sm">
        <button disabled={busy} onClick={check} className="rounded-full bg-ink px-4 py-2 font-semibold text-paper disabled:opacity-40">Run health check now</button>
        <label className="flex items-center gap-2"><input type="checkbox" checked={showResolved} onChange={(e) => { setShowResolved(e.target.checked); load(e.target.checked); }} />Show resolved</label>
        <span className="text-xs text-ink/50">Checks run automatically every hour. New errors are emailed to the alert address once email is connected.</span>
      </div>
      {!rows ? <p className="text-ink/60">Loading…</p> : rows.length === 0 ? (
        <p className="rounded-xl bg-white p-5 text-ink/60 ring-1 ring-ink/5">No problems. 🎉</p>
      ) : (
        <Table head={["Problem", "Where", "Times", "Last seen", ""]}>
          {rows.map((r) => (
            <tr key={r.id} className={`align-top ${r.resolved_at ? "opacity-50" : ""}`}>
              <td className="px-4 py-3">
                <div className="flex items-start gap-2"><Badge tone={r.level === "error" ? "red" : r.level === "warning" ? "amber" : "grey"}>{r.level}</Badge><span className="font-semibold">{r.title}</span></div>
                {typeof r.detail?.where === "string" && r.detail.where && <div className="mt-1 text-xs text-ink/50">Page: {r.detail.where}</div>}
              </td>
              <td className="px-4 py-3 text-xs">{SOURCE[r.source] ?? r.source}</td>
              <td className="px-4 py-3">{r.count}</td>
              <td className="whitespace-nowrap px-4 py-3 text-xs">{when(r.last_at)}<div className="text-ink/40">first {when(r.first_at)}</div></td>
              <td className="px-4 py-3">
                <button onClick={() => resolve(r.id, !r.resolved_at)} className="rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-ink/20">{r.resolved_at ? "Reopen" : "Mark resolved"}</button>
              </td>
            </tr>
          ))}
        </Table>
      )}
    </>
  );
}
