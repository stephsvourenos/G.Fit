"use client";

import { useEffect, useState } from "react";
import { Badge, Table } from "@/components/AdminShell";
import { friendlyError, supabase, supabaseConfigured } from "@/lib/supabase";

interface Notice {
  id: number; kind: string; status: string; due_at: string; sent_at: string | null; to_email: string | null;
  subject: string | null; body_text: string | null; last_error: string | null; attempts: number;
}
const KIND: Record<string, string> = {
  trial_started: "Trial started", trial_ending: "Trial ending reminder", membership_started: "Welcome / membership started",
  payment_failed: "Payment failed", cancellation_confirmed: "Cancellation confirmed", membership_ended: "Membership ended",
  promo_ending: "Offer price ending", price_change: "Price change notice",
};
const TONE: Record<string, "green" | "amber" | "grey" | "red" | "blue"> = { sent: "green", logged: "blue", queued: "amber", failed: "red", skipped: "grey" };
const STATUS: Record<string, string> = { sent: "Sent", logged: "Kept (not sent)", queued: "Waiting", failed: "Failed", skipped: "Skipped" };

async function fn<T>(body: Record<string, unknown>): Promise<T & { error?: string }> {
  const { data, error } = await supabase().functions.invoke("send-emails", { body });
  if (data) return data;
  const ctx = (error as { context?: Response } | null)?.context;
  try { if (ctx) return await ctx.json(); } catch { /* ignore */ }
  return { error: "Couldn’t reach the email service." } as T & { error?: string };
}

export function LiveEmails() {
  const [rows, setRows] = useState<Notice[]>();
  const [open, setOpen] = useState<number>();
  const [status, setStatus] = useState<{ provider: string; production: boolean; allowlist: number; from: string | null }>();
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string }>();
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const { data, error } = await supabase().from("member_notices")
      .select("id, kind, status, due_at, sent_at, to_email, subject, body_text, last_error, attempts")
      .order("created_at", { ascending: false }).limit(200);
    if (error) setMsg({ tone: "err", text: friendlyError(error) });
    else setRows(data as Notice[]);
  };
  useEffect(() => {
    if (!supabaseConfigured) return;
    void load(); // eslint-disable-line react-hooks/set-state-in-effect -- async fetch
    fn<{ provider: string; production: boolean; allowlist: number; from: string | null }>({ action: "status" }).then((s) => !s.error && setStatus(s));
  }, []);
  if (!supabaseConfigured) return <p className="text-ink/60">Needs the live database.</p>;

  const run = async (body: Record<string, unknown>) => {
    setBusy(true);
    const r = await fn<{ processed: number }>(body);
    setBusy(false);
    setMsg(r.error ? { tone: "err", text: r.error } : { tone: "ok", text: `Processed ${r.processed} email${r.processed === 1 ? "" : "s"}.` });
    load();
  };

  return (
    <>
      {status && (
        <p className={`mb-4 rounded-xl px-4 py-2.5 text-sm ${status.provider === "connected" ? "bg-mint/15" : "bg-sky/10"} text-ink`}>
          {status.provider === "connected"
            ? `Email service connected (from ${status.from}).${status.production ? "" : ` Test mode: only ${status.allowlist} allow-listed address${status.allowlist === 1 ? "" : "es"} receive real emails; the rest are kept here.`}`
            : "No email service connected yet — emails are written and kept here so you can read them, but nothing is sent. Connecting one is a launch step."}
        </p>
      )}
      {msg && <p role="alert" className={`mb-4 rounded-xl px-4 py-2.5 text-sm ${msg.tone === "ok" ? "bg-mint/15 text-[#0f6a4a]" : "bg-coral/10 text-[#b8361a]"}`}>{msg.text}</p>}
      <button disabled={busy} onClick={() => run({})} className="mb-4 rounded-full bg-ink px-4 py-2 text-sm font-semibold text-paper disabled:opacity-40">Process waiting emails now</button>
      <span className="ml-3 text-xs text-ink/50">Runs automatically every 10 minutes.</span>
      {!rows ? <p className="text-ink/60">Loading…</p> : rows.length === 0 ? (
        <p className="rounded-xl bg-white p-5 text-ink/60 ring-1 ring-ink/5">No member emails yet.</p>
      ) : (
        <Table head={["Created", "Email", "To", "Status", ""]}>
          {rows.map((r) => (
            <tr key={r.id} className="align-top">
              <td className="whitespace-nowrap px-4 py-3 text-xs">{new Date(r.due_at).toLocaleString("en-AU", { dateStyle: "medium", timeStyle: "short" })}</td>
              <td className="px-4 py-3">
                <div className="font-semibold">{KIND[r.kind] ?? r.kind}</div>
                {r.subject && <div className="text-xs text-ink/60">{r.subject}</div>}
                {open === r.id && r.body_text && <pre className="mt-2 max-w-xl whitespace-pre-wrap rounded-lg bg-ink/[0.03] p-3 font-sans text-xs text-ink/80">{r.body_text}</pre>}
              </td>
              <td className="px-4 py-3 text-xs">{r.to_email ?? "—"}</td>
              <td className="px-4 py-3">
                <Badge tone={TONE[r.status] ?? "grey"}>{STATUS[r.status] ?? r.status}</Badge>
                {r.last_error && <div className="mt-1 max-w-[16rem] text-xs text-ink/50">{r.last_error}</div>}
              </td>
              <td className="px-4 py-3 text-xs">
                <div className="flex gap-2">
                  {r.body_text && <button onClick={() => setOpen(open === r.id ? undefined : r.id)} className="rounded-full px-3 py-1 font-semibold ring-1 ring-ink/20">{open === r.id ? "Hide" : "Read"}</button>}
                  {["failed", "skipped"].includes(r.status) && <button disabled={busy} onClick={() => run({ action: "retry", id: r.id })} className="rounded-full px-3 py-1 font-semibold ring-1 ring-ink/20">Retry</button>}
                </div>
              </td>
            </tr>
          ))}
        </Table>
      )}
    </>
  );
}
