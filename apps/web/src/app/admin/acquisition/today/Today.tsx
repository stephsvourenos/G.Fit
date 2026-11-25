"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { crmError, db, fmtDate, loadSettings, loadStages, useLoad, type Card, type Stage, type Task } from "@/lib/crm";
import { ActionDialogs, Btn, Notice, ProspectSummary, QuickActions, type QuickAction } from "../_ui";

interface Row {
  key: string;
  section: string;
  prospect: Card | null;
  task?: Task;
  reasons?: string[];
}

interface TodayData {
  today: string;
  follow_ups: Array<{ task: Task; prospect: Card }>;
  follow_ups_total: number;
  replies: Array<{ task: Task; prospect: Card }>;
  overdue: Array<{ task: Task; prospect: Card | null }>;
  custom: Array<{ task: Task; prospect: Card | null }>;
  content_awaiting_approval: number;
}

const SECTIONS: Array<{ id: string; title: string; hint: string; phase?: string }> = [
  { id: "replies", title: "Interested creators awaiting your reply", hint: "They answered — reply first." },
  { id: "follow_ups", title: "Follow-ups due", hint: "No reply yet, and the follow-up date has arrived." },
  { id: "new", title: "New creators to contact", hint: "Best matches first. Tasks only count as done when you confirm a message was sent." },
  { id: "overdue", title: "Overdue tasks", hint: "Anything else that's past its date." },
  { id: "custom", title: "Other tasks for today", hint: "" },
];

export function Today() {
  const stages = useLoad<Stage[]>(() => loadStages());
  const settings = useLoad(() => loadSettings());
  const [newLimit, setNewLimit] = useState<number | null>(null);
  const limit = newLimit ?? Number(settings.data?.queue.new_per_day ?? 50);
  const data = useLoad<{ today: TodayData; queue: Array<{ prospect: Card; priority: number; reasons: string[] }> }>(async () => {
    const [t, q] = await Promise.all([db().rpc("crm_today_tasks"), db().rpc("crm_outreach_queue", { p_limit: limit })]);
    if (t.error) throw t.error;
    if (q.error) throw q.error;
    return { today: t.data as TodayData, queue: (q.data ?? []) as Array<{ prospect: Card; priority: number; reasons: string[] }> };
  }, [limit]);
  const [note, setNote] = useState<string>();
  const [action, setAction] = useState<{ a: QuickAction; row: Row } | null>(null);
  const [focus, setFocus] = useState(0);
  const [hidden, setHidden] = useState<Set<string>>(new Set());

  const rows: Row[] = useMemo(() => {
    const d = data.data;
    if (!d) return [];
    const out: Row[] = [];
    for (const r of d.today.replies) out.push({ key: `t${r.task.id}`, section: "replies", prospect: r.prospect, task: r.task });
    for (const r of d.today.follow_ups) out.push({ key: `t${r.task.id}`, section: "follow_ups", prospect: r.prospect, task: r.task });
    for (const r of d.queue) out.push({ key: `n${r.prospect.id}`, section: "new", prospect: r.prospect, reasons: r.reasons });
    for (const r of d.today.overdue) out.push({ key: `t${r.task.id}`, section: "overdue", prospect: r.prospect, task: r.task });
    for (const r of d.today.custom) out.push({ key: `t${r.task.id}`, section: "custom", prospect: r.prospect, task: r.task });
    return out.filter((r) => !hidden.has(r.key));
  }, [data.data, hidden]);

  const done = useCallback(
    (msg: string) => {
      setNote(msg);
      if (action && action.a !== "note" && action.a !== "followup") setHidden((h) => new Set(h).add(action.row.key));
      setAction(null);
      data.reload(); // refresh the queue
    },
    [action, data],
  );

  async function completeTask(t: Task, key: string) {
    const { error } = await db().rpc("crm_task_action", { p_task: t.id, p_action: "done" });
    if (error) return setNote(crmError(error));
    setHidden((h) => new Set(h).add(key));
    setNote("Task done.");
    data.reload();
  }

  // keyboard: j/k move, c contact, r reply, n note, f follow-up, s snooze, o open profile
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (action || e.metaKey || e.ctrlKey || e.altKey || /input|textarea|select/i.test((e.target as HTMLElement).tagName)) return;
      const row = rows[focus];
      const map: Record<string, QuickAction> = { c: "compose", r: "reply", n: "note", f: "followup", s: "snooze" };
      if (e.key === "j") setFocus((i) => Math.min(rows.length - 1, i + 1));
      else if (e.key === "k") setFocus((i) => Math.max(0, i - 1));
      else if (row?.prospect && map[e.key]) setAction({ a: map[e.key]!, row });
      else if (e.key === "o" && row?.prospect) {
        const a = document.querySelector<HTMLAnchorElement>(`[data-row="${row.key}"] a[target=_blank]`);
        a?.click();
      } else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [rows, focus, action]);
  useEffect(() => {
    document.querySelector(`[data-row="${rows[focus]?.key}"]`)?.scrollIntoView({ block: "nearest" });
  }, [focus, rows]);

  if (data.error) return <Notice tone="error">{data.error}</Notice>;
  const d = data.data;
  return (
    <div className="space-y-6">
      {note && <Notice tone="ok" onClose={() => setNote(undefined)}>{note}</Notice>}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Count label="Replies to send" n={d?.today.replies.length} tone={d?.today.replies.length ? "coral" : undefined} />
        <Count label="Follow-ups due" n={d?.today.follow_ups_total} />
        <Count label="New to contact" n={d?.queue.length} sub={`of ${limit} a day`} />
        <Count label="Overdue tasks" n={d?.today.overdue.length} tone={d?.today.overdue.length ? "coral" : undefined} />
      </div>
      <div className="flex flex-wrap items-center gap-3 text-sm text-ink/60">
        <label className="flex items-center gap-2">New creators today:
          <input type="number" min={0} max={500} className="w-20 rounded-lg px-2 py-1 ring-1 ring-ink/15" value={limit} onChange={(e) => setNewLimit(Math.max(0, Math.min(500, Number(e.target.value) || 0)))} />
        </label>
        <span>Change the daily default in <Link href="/admin/acquisition/settings/" className="underline">Settings</Link>.</span>
        <span className="hidden lg:inline">Keys: <kbd>j</kbd>/<kbd>k</kbd> move · <kbd>c</kbd> contact · <kbd>o</kbd> open profile · <kbd>r</kbd> reply · <kbd>f</kbd> follow-up · <kbd>n</kbd> note · <kbd>s</kbd> snooze</span>
      </div>
      {data.loading && !d && <p className="text-ink/60">Working out today’s list…</p>}

      {SECTIONS.map((sec) => {
        const list = rows.filter((r) => r.section === sec.id);
        if (sec.id === "custom" && !list.length) return null;
        return (
          <section key={sec.id}>
            <div className="mb-2 flex items-baseline justify-between gap-3">
              <h2 className="font-display text-xl">{sec.title} <span className="text-ink/40">{list.length}</span></h2>
              {sec.hint && <p className="text-xs text-ink/50">{sec.hint}</p>}
            </div>
            {d && !list.length && <p className="rounded-xl bg-white px-4 py-3 text-sm text-ink/55 ring-1 ring-ink/5">Nothing here today.</p>}
            <ul className="space-y-2">
              {list.map((r) => {
                const i = rows.indexOf(r);
                return (
                  <li key={r.key} data-row={r.key} onClick={() => setFocus(i)}
                      className={`rounded-xl bg-white p-3 ring-1 ${i === focus ? "ring-2 ring-sky" : "ring-ink/5"}`}>
                    {r.task && (
                      <div className="mb-1.5 flex flex-wrap items-center gap-2 text-xs">
                        <span className={`font-semibold ${r.task.due_on < (d?.today.today ?? "") ? "text-[#b8361a]" : "text-ink/60"}`}>
                          {r.task.title} · due {fmtDate(r.task.due_on)}
                        </span>
                      </div>
                    )}
                    {r.prospect ? (
                      <div className="flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
                        <ProspectSummary p={r.prospect} stages={stages.data} reasons={r.reasons} />
                        <QuickActions p={r.prospect} onAction={(a) => setAction({ a, row: r })}
                          extra={r.task && r.task.kind !== "follow_up" ? <Btn className="!px-2.5 !py-1 !text-xs" onClick={() => completeTask(r.task!, r.key)}>Mark done</Btn> : undefined} />
                      </div>
                    ) : (
                      r.task && <Btn onClick={() => completeTask(r.task!, r.key)}>Mark done</Btn>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}

      <section className="rounded-xl bg-white p-4 text-sm text-ink/60 ring-1 ring-ink/5">
        <h2 className="font-display text-lg text-ink">Coming with the application and onboarding phase</h2>
        <p className="mt-1">Applications to review, agreements awaiting acceptance, incomplete onboarding, launch promotion commitments and partnership follow-ups will appear here once those parts are built (Phase 2–3).
          {typeof d?.today.content_awaiting_approval === "number" && d.today.content_awaiting_approval > 0 && <> Right now there {d.today.content_awaiting_approval === 1 ? "is 1 workout" : `are ${d.today.content_awaiting_approval} workouts`} waiting in <Link className="underline" href="/admin/content/">Content approval</Link>.</>}
        </p>
      </section>

      <ActionDialogs action={action?.a ?? null} prospect={action?.row.prospect ?? null} taskId={action?.row.task?.id} stages={stages.data}
        onClose={() => setAction(null)} onDone={done} />
    </div>
  );
}

function Count({ label, n, sub, tone }: { label: string; n?: number; sub?: string; tone?: "coral" }) {
  return (
    <div className="rounded-xl bg-white p-4 ring-1 ring-ink/5">
      <div className="text-xs font-semibold uppercase tracking-wide text-ink/50">{label}</div>
      <div className={`font-display mt-1 text-3xl tabular-nums ${tone === "coral" ? "text-coral" : ""}`}>{n ?? "…"}</div>
      {sub && <div className="text-xs text-ink/50">{sub}</div>}
    </div>
  );
}
