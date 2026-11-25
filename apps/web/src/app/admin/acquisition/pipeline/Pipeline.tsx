"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Table } from "@/components/AdminShell";
import { CHANNEL_LABEL, crmError, db, fmtCount, fmtDate, loadSettings, loadStaff, loadStages, useLoad, type Card, type Stage } from "@/lib/crm";
import { ActionDialogs, Btn, Notice, ScoreBadge, StageDialog, inputCls, type QuickAction } from "../_ui";

const PER_COLUMN = 40;
const COLS = "id, ref, creator_name, business_name, country, primary_category, allocation_category, primary_platform, estimated_combined_followers, instagram_followers, tiktok_followers, youtube_subscribers, fit_score, fit_tier, confidence_level, stage, last_contact_at, assigned_to, do_not_contact, outbound_count, last_inbound_at, instagram_url, tiktok_url, youtube_url, facebook_url, linkedin_url, website_url, contact_form_url, public_business_email, outreach_permission_status, personalised_initial_dm, personalised_initial_email, specific_personalisation_detail, recommended_pitch_angle, why_gfit_is_relevant, full_length_workouts_available, preferred_outreach_channel, unavailable_channels";

type Row = Card & { estimated_combined_followers: number | null; instagram_followers: number | null; tiktok_followers: number | null; youtube_subscribers: number | null; preferred_outreach_channel: string | null };
interface Column { stage: Stage; rows: Row[]; count: number }

export function Pipeline() {
  const stages = useLoad<Stage[]>(() => loadStages());
  const staff = useLoad(() => loadStaff());
  const settings = useLoad(() => loadSettings());
  const [view, setView] = useState<"board" | "table">("board");
  const [showOutcomes, setShowOutcomes] = useState(false);
  const [filter, setFilter] = useState({ category: "", assigned: "", tier: "" });
  const [note, setNote] = useState<{ tone: "ok" | "error"; text: string }>();
  const [drag, setDrag] = useState<Row | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [override, setOverride] = useState<{ row: Row; stage: string } | null>(null);
  const [action, setAction] = useState<{ a: QuickAction; row: Row } | null>(null);

  const visible = useMemo(() => (stages.data ?? []).filter((s) => s.active && (showOutcomes || s.kind === "stage")), [stages.data, showOutcomes]);
  const key = JSON.stringify([filter, visible.map((s) => s.key)]);
  const board = useLoad<Column[]>(async () => {
    return Promise.all(
      visible.map(async (stage) => {
        let q = db().from("crm_prospects").select(COLS, { count: "exact" }).eq("stage", stage.key);
        if (filter.category) q = q.eq("allocation_category", filter.category);
        if (filter.assigned) q = filter.assigned === "none" ? q.is("assigned_to", null) : q.eq("assigned_to", filter.assigned);
        if (filter.tier) q = q.eq("fit_tier", filter.tier);
        const { data, error, count } = await q.order("fit_score", { ascending: false, nullsFirst: false }).order("ref").limit(PER_COLUMN);
        if (error) throw error;
        const rows = (data ?? []).map((r) => ({ ...(r as Row), followers: (r as Row).estimated_combined_followers ?? (((r as Row).instagram_followers ?? 0) + ((r as Row).tiktok_followers ?? 0) + ((r as Row).youtube_subscribers ?? 0) || null), channel: (r as Row).preferred_outreach_channel }));
        return { stage, rows, count: count ?? 0 };
      }),
    );
  }, [key]);
  const staffEmail = useMemo(() => Object.fromEntries((staff.data ?? []).map((s) => [s.user_id, s.email])), [staff.data]);

  async function move(row: Row, to: string) {
    const st = stages.data?.find((s) => s.key === to);
    if (!st || row.stage === to) return;
    if (st.system_event) return setOverride({ row, stage: to }); // real events: needs an admin override with a reason
    const { data, error } = await db().rpc("crm_set_stage", { p_ids: [row.id], p_stage: to });
    if (error) return setNote({ tone: "error", text: crmError(error) });
    const r = data as { moved: number; skipped: unknown[] };
    setNote(r.moved ? { tone: "ok", text: `${row.creator_name} → ${st.label}` } : { tone: "error", text: `${row.creator_name} is do-not-contact, so they can't move forward.` });
    board.reload();
  }

  const outstanding = (r: Row) => {
    if (r.do_not_contact) return "Do not contact";
    if (r.last_inbound_at && (!r.last_contact_at || r.last_inbound_at >= r.last_contact_at)) return "Reply to them";
    if (r.outbound_count === 0 && ["identified", "qualified", "ready_for_outreach"].includes(r.stage)) return "Send first message";
    if (r.stage === "contacted" || r.stage === "follow_up_required") return "Awaiting reply";
    if (r.stage === "interested") return "Invite to apply";
    return "";
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-full bg-white p-1 ring-1 ring-ink/10">
          {(["board", "table"] as const).map((v) => <button key={v} onClick={() => setView(v)} className={`rounded-full px-3 py-1 text-sm font-semibold ${view === v ? "bg-ink text-paper" : "text-ink/60"}`}>{v === "board" ? "Board" : "Table"}</button>)}
        </div>
        <select className={`${inputCls} w-auto`} value={filter.category} onChange={(e) => setFilter((f) => ({ ...f, category: e.target.value }))} aria-label="Category">
          <option value="">All categories</option>{(settings.data?.categories ?? []).map((c) => <option key={c.name}>{c.name}</option>)}
        </select>
        <select className={`${inputCls} w-auto`} value={filter.assigned} onChange={(e) => setFilter((f) => ({ ...f, assigned: e.target.value }))} aria-label="Assigned">
          <option value="">Anyone</option><option value="none">Unassigned</option>{(staff.data ?? []).map((s) => <option key={s.user_id} value={s.user_id}>{s.email}</option>)}
        </select>
        <select className={`${inputCls} w-auto`} value={filter.tier} onChange={(e) => setFilter((f) => ({ ...f, tier: e.target.value }))} aria-label="Tier">
          <option value="">Any tier</option>{["A", "B", "C", "D"].map((t) => <option key={t} value={t}>Tier {t}</option>)}
        </select>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={showOutcomes} onChange={(e) => setShowOutcomes(e.target.checked)} /> Show closed outcomes</label>
        <span className="text-xs text-ink/50">Shows the top {PER_COLUMN} by score in each stage. Grey-lock stages are set by real events.</span>
      </div>
      {note && <Notice tone={note.tone} onClose={() => setNote(undefined)}>{note.text}</Notice>}
      {board.error && <Notice tone="error">{board.error}</Notice>}
      {board.loading && !board.data && <p className="text-ink/60">Loading the pipeline…</p>}

      {view === "board" && board.data && (
        <div className="flex gap-3 overflow-x-auto pb-4">
          {board.data.map(({ stage, rows, count }) => (
            <div key={stage.key}
              onDragOver={(e) => { e.preventDefault(); setOver(stage.key); }}
              onDragLeave={() => setOver((o) => (o === stage.key ? null : o))}
              onDrop={(e) => { e.preventDefault(); setOver(null); if (drag) void move(drag, stage.key); setDrag(null); }}
              className={`flex w-64 shrink-0 flex-col rounded-xl p-2 ${over === stage.key ? "bg-sky/15 ring-2 ring-sky" : "bg-ink/[0.04]"}`}>
              <div className="flex items-center justify-between px-1 pb-2">
                <span className="text-sm font-semibold">{stage.system_event && <span title="Set automatically when it actually happens">🔒 </span>}{stage.label}</span>
                <span className="text-xs tabular-nums text-ink/50">{count}</span>
              </div>
              <div className="space-y-2">
                {rows.map((r) => (
                  <article key={r.id} draggable onDragStart={() => setDrag(r)} onDragEnd={() => setDrag(null)}
                    className={`cursor-grab rounded-lg bg-white p-2.5 text-xs shadow-sm ring-1 ring-ink/5 active:cursor-grabbing ${r.do_not_contact ? "opacity-60" : ""}`}>
                    <div className="flex items-start gap-2">
                      <div aria-hidden className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-ink/10 font-semibold text-ink/60">{r.creator_name.replace(/^FICTIONAL\s+/i, "").slice(0, 1)}</div>
                      <div className="min-w-0">
                        <Link href={`/admin/acquisition/prospect/?id=${r.id}`} className="block truncate text-sm font-semibold hover:underline">{r.creator_name}</Link>
                        <div className="truncate text-ink/55">{[r.primary_category, r.country].filter(Boolean).join(" · ") || "—"}</div>
                      </div>
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-ink/60">
                      <ScoreBadge score={r.fit_score} tier={r.fit_tier} />
                      <span>{r.primary_platform ? CHANNEL_LABEL[r.primary_platform] : "—"} · {r.followers ? fmtCount(r.followers) : "audience ?"}</span>
                    </div>
                    <div className="mt-1 text-ink/50">Last contact {fmtDate(r.last_contact_at)} · {r.assigned_to ? staffEmail[r.assigned_to]?.split("@")[0] ?? "staff" : "unassigned"}</div>
                    {outstanding(r) && <div className="mt-1 font-semibold text-ink/75">→ {outstanding(r)}</div>}
                    <div className="mt-1.5 flex gap-1.5">
                      {!r.do_not_contact && <button className="rounded-full bg-coral px-2 py-0.5 font-semibold text-white" onClick={() => setAction({ a: "compose", row: r })}>Contact…</button>}
                      <button className="rounded-full px-2 py-0.5 ring-1 ring-ink/15" onClick={() => setAction({ a: "stage", row: r })}>Move…</button>
                    </div>
                  </article>
                ))}
                {count > rows.length && <Link className="block px-1 text-xs text-sky underline" href={`/admin/acquisition/prospects/?stage=${stage.key}`}>+ {count - rows.length} more</Link>}
              </div>
            </div>
          ))}
        </div>
      )}

      {view === "table" && board.data && (
        <Table head={["Stage", "Creator", "Score", "Category · country", "Audience", "Last contact", "Assigned", "Next"]}>
          {board.data.flatMap(({ stage, rows }) =>
            rows.map((r) => (
              <tr key={r.id}>
                <td className="px-3 py-2">
                  <select className="rounded-lg bg-white px-2 py-1 text-xs ring-1 ring-ink/15" value={r.stage} onChange={(e) => move(r, e.target.value)} aria-label={`Stage for ${r.creator_name}`}>
                    {(stages.data ?? []).filter((s) => s.active).map((s) => <option key={s.key} value={s.key}>{s.system_event ? "🔒 " : ""}{s.label}</option>)}
                  </select>
                  <span className="sr-only">{stage.label}</span>
                </td>
                <td className="px-3 py-2"><Link className="font-semibold hover:underline" href={`/admin/acquisition/prospect/?id=${r.id}`}>{r.creator_name}</Link></td>
                <td className="px-3 py-2"><ScoreBadge score={r.fit_score} tier={r.fit_tier} confidence={r.confidence_level} /></td>
                <td className="px-3 py-2 text-xs">{r.primary_category ?? "—"} · {r.country ?? "—"}</td>
                <td className="px-3 py-2 text-xs">{r.followers ? fmtCount(r.followers) : "unknown"}</td>
                <td className="px-3 py-2 text-xs">{fmtDate(r.last_contact_at)}</td>
                <td className="px-3 py-2 text-xs">{r.assigned_to ? staffEmail[r.assigned_to] ?? "staff" : "—"}</td>
                <td className="px-3 py-2 text-xs">{outstanding(r) || "—"}</td>
              </tr>
            )),
          )}
        </Table>
      )}

      {override && (
        <StageDialog ids={[override.row.id]} name={override.row.creator_name} stages={stages.data ?? []} current={override.stage}
          onClose={() => setOverride(null)} onDone={(m) => { setOverride(null); setNote({ tone: "ok", text: m }); board.reload(); }} />
      )}
      <ActionDialogs action={action?.a ?? null} prospect={action?.row ?? null} stages={stages.data} onClose={() => setAction(null)}
        onDone={(m) => { setAction(null); setNote({ tone: "ok", text: m }); board.reload(); }} />
      <p className="text-xs text-ink/50">Need to move many at once? Select them in <Link className="underline" href="/admin/acquisition/prospects/">All Prospects</Link> and use “Change stage”. <Btn className="ml-2 !py-0.5 !text-xs" onClick={() => board.reload()}>Refresh</Btn></p>
    </div>
  );
}
