"use client";

import { useState } from "react";
import { SCORE_CRITERIA } from "@app/domain/crm";
import { Table } from "@/components/AdminShell";
import { useStaffSession } from "@/lib/staff";
import { crmError, db, fmtDate, loadSettings, loadStages, useLoad, type CrmSettings as S, type Stage } from "@/lib/crm";
import { Btn, Notice, inputCls, refreshTemplateCache } from "../_ui";

const TARGETS: Array<[string, string, "date" | "int" | "pct"]> = [
  ["launch_date", "Launch date", "date"],
  ["founding_creators", "Founding creators", "int"],
  ["qualified_prospects", "Qualified prospects", "int"],
  ["signed_creators", "Signed creators", "int"],
  ["min_approved_workouts", "Minimum approved workouts per launch-ready creator", "int"],
  ["workout_library", "Approved workout library", "int"],
  ["waitlist_registrations", "Pre-launch waiting-list registrations", "int"],
  ["monthly_new_subscribers", "Monthly new paying subscribers (planning target)", "int"],
  ["monthly_churn_pct", "Monthly subscriber churn assumption (%)", "pct"],
];
const QUEUE: Array<[string, string]> = [
  ["new_per_day", "New creators to contact each day"],
  ["follow_ups_per_day", "Follow-ups to show each day"],
  ["first_follow_up_days", "Days before the first follow-up"],
  ["second_follow_up_days", "Days before the next follow-up"],
  ["max_follow_ups", "Follow-ups before suggesting “No Response”"],
  ["duplicate_guard_days", "Days before the same channel can be logged again"],
];

export function CrmSettings() {
  const staff = useStaffSession();
  const isAdmin = staff.roles.includes("admin");
  const settings = useLoad(() => loadSettings());
  const stages = useLoad(() => loadStages(true));
  const [draft, setV] = useState<S>();
  const v = draft ?? settings.data;
  const [note, setNote] = useState<{ tone: "ok" | "error"; text: string }>();
  if (settings.error) return <Notice tone="error">{settings.error}</Notice>;
  if (!v) return <p className="text-ink/60">Loading…</p>;

  const weightSum = SCORE_CRITERIA.reduce((s, c) => s + Number(v.scoring.weights[c.key] ?? c.max), 0);

  async function save() {
    if (!v) return;
    const tiers = [...v.scoring.tiers].sort((a, b) => b.min - a.min);
    if (tiers.some((t) => !Number.isFinite(t.min) || t.min < 0 || t.min > 100)) return setNote({ tone: "error", text: "Tier minimums must be between 0 and 100." });
    if (v.application_url && !/^https:\/\//.test(v.application_url)) return setNote({ tone: "error", text: "The application link must start with https://" });
    const { error } = await db().from("crm_settings").update({
      targets: v.targets, queue: v.queue, scoring: { ...v.scoring, tiers }, categories: v.categories.filter((c) => c.name.trim()),
      founder_name: v.founder_name?.trim() || null, application_url: v.application_url?.trim() || null,
    }).eq("id", 1).select("id").single();
    if (error) return setNote({ tone: "error", text: crmError(error) });
    refreshTemplateCache();
    setNote({ tone: "ok", text: "Settings saved. Changes are recorded in the audit log; a change to scoring re-scores every prospect." });
    setV(undefined);
    settings.reload();
  }

  const num = (x: string) => (x === "" ? 0 : Number(x));
  return (
    <div className="space-y-6">
      {!isAdmin && <Notice tone="info">Only admins can change these settings.</Notice>}
      {note && <Notice tone={note.tone} onClose={() => setNote(undefined)}>{note.text}</Notice>}
      <fieldset disabled={!isAdmin} className="space-y-6">
        <section className="rounded-xl bg-white p-5 ring-1 ring-ink/5">
          <h2 className="font-display text-xl">Launch targets</h2>
          <p className="mt-1 text-xs text-ink/55">Planning targets for the dashboard. They never change creator agreements or any money.</p>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            {TARGETS.map(([k, label, type]) => (
              <label key={k} className="text-sm"><span className="mb-1 block text-xs font-semibold text-ink/60">{label}</span>
                <input className={inputCls} type={type === "date" ? "date" : "number"} min={0} value={String(v.targets[k] ?? "")}
                  onChange={(e) => setV({ ...v, targets: { ...v.targets, [k]: type === "date" ? e.target.value : num(e.target.value) } })} />
              </label>
            ))}
          </div>
        </section>

        <section className="rounded-xl bg-white p-5 ring-1 ring-ink/5">
          <h2 className="font-display text-xl">Messages</h2>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <label className="text-sm"><span className="mb-1 block text-xs font-semibold text-ink/60">Founder’s name (signs templates)</span><input className={inputCls} value={v.founder_name ?? ""} onChange={(e) => setV({ ...v, founder_name: e.target.value })} /></label>
            <label className="text-sm"><span className="mb-1 block text-xs font-semibold text-ink/60">Founding creator application link (until personal links arrive in Phase 2)</span><input className={inputCls} placeholder="https://…" value={v.application_url ?? ""} onChange={(e) => setV({ ...v, application_url: e.target.value })} /></label>
          </div>
        </section>

        <section className="rounded-xl bg-white p-5 ring-1 ring-ink/5">
          <h2 className="font-display text-xl">Daily queue and follow-ups</h2>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            {QUEUE.map(([k, label]) => (
              <label key={k} className="text-sm"><span className="mb-1 block text-xs font-semibold text-ink/60">{label}</span>
                <input className={inputCls} type="number" min={0} max={500} value={v.queue[k] ?? ""} onChange={(e) => setV({ ...v, queue: { ...v.queue, [k]: num(e.target.value) } })} />
              </label>
            ))}
          </div>
        </section>

        <section className="rounded-xl bg-white p-5 ring-1 ring-ink/5">
          <h2 className="font-display text-xl">Creator fit score</h2>
          <p className="mt-1 text-xs text-ink/55">Maximum points for each criterion (they’re added up and shown out of 100). Research files score each criterion out of the default maximum; changing a weight re-weights it.</p>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            {SCORE_CRITERIA.map((c) => (
              <label key={c.key} className="text-sm"><span className="mb-1 block text-xs font-semibold text-ink/60">{c.label} (default {c.max})</span>
                <input className={inputCls} type="number" min={0} max={100} value={v.scoring.weights[c.key] ?? c.max} onChange={(e) => setV({ ...v, scoring: { ...v.scoring, weights: { ...v.scoring.weights, [c.key]: num(e.target.value) } } })} />
              </label>
            ))}
          </div>
          <p className="mt-2 text-xs text-ink/55">Weights add up to {weightSum}.</p>
          <div className="mt-3 flex flex-wrap gap-3">
            {v.scoring.tiers.map((t, i) => (
              <label key={t.tier} className="text-sm"><span className="mb-1 block text-xs font-semibold text-ink/60">Tier {t.tier} from</span>
                <input className={`${inputCls} w-24`} type="number" min={0} max={100} value={t.min} onChange={(e) => setV({ ...v, scoring: { ...v.scoring, tiers: v.scoring.tiers.map((x, j) => (j === i ? { ...x, min: num(e.target.value) } : x)) } })} />
              </label>
            ))}
          </div>
        </section>

        <section className="rounded-xl bg-white p-5 ring-1 ring-ink/5">
          <h2 className="font-display text-xl">Founding creator categories</h2>
          <p className="mt-1 text-xs text-ink/55">Each creator counts once, in their primary category. The daily queue gives a boost to categories that still need creators.</p>
          <div className="mt-3 space-y-2">
            {v.categories.map((c, i) => (
              <div key={i} className="flex gap-2">
                <input className={inputCls} value={c.name} onChange={(e) => setV({ ...v, categories: v.categories.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })} aria-label="Category name" />
                <input className={`${inputCls} w-28`} type="number" min={0} value={c.target} onChange={(e) => setV({ ...v, categories: v.categories.map((x, j) => (j === i ? { ...x, target: num(e.target.value) } : x)) })} aria-label="Target" />
                <Btn onClick={() => setV({ ...v, categories: v.categories.filter((_, j) => j !== i) })}>Remove</Btn>
              </div>
            ))}
            <Btn onClick={() => setV({ ...v, categories: [...v.categories, { name: "", target: 10 }] })}>Add category</Btn>
            <p className="text-xs text-ink/55">Total: {v.categories.reduce((s, c) => s + Number(c.target || 0), 0)} (founding target {String(v.targets.founding_creators)}).</p>
          </div>
        </section>
        {isAdmin && <div className="flex items-center gap-3"><Btn tone="primary" onClick={save}>Save settings</Btn><span className="text-xs text-ink/50">Last changed {fmtDate(settings.data?.updated_at, true)}</span></div>}
      </fieldset>

      <StagesEditor stages={stages.data ?? []} isAdmin={isAdmin} onChanged={() => stages.reload()} />
    </div>
  );
}

function StagesEditor({ stages, isAdmin, onChanged }: { stages: Stage[]; isAdmin: boolean; onChanged: () => void }) {
  const [err, setErr] = useState<string>();
  const [label, setLabel] = useState("");
  async function update(key: string, patch: Partial<Stage>) {
    const { error } = await db().from("crm_stages").update(patch).eq("key", key);
    if (error) return setErr(crmError(error));
    await loadStages(true);
    onChanged();
  }
  async function swap(a: Stage, b: Stage) {
    await update(a.key, { position: b.position });
    await update(b.key, { position: a.position });
  }
  async function add() {
    const key = label.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 40);
    if (!/^[a-z]/.test(key)) return setErr("Start the stage name with a letter.");
    const max = Math.max(...stages.filter((s) => s.kind === "stage").map((s) => s.position));
    const { error } = await db().from("crm_stages").insert({ key, label: label.trim(), position: max + 1, kind: "stage" });
    if (error) return setErr(crmError(error));
    setLabel("");
    await loadStages(true);
    onChanged();
  }
  const pipeline = stages.filter((s) => s.kind === "stage");
  return (
    <section>
      <h2 className="font-display mb-1 text-xl">Pipeline stages</h2>
      <p className="mb-3 text-xs text-ink/55">Rename, reorder or hide stages. 🔒 stages mean a real event happened and can’t be reached by dragging; their meaning can’t be changed. Funnel numbers use this order.</p>
      {err && <Notice tone="error" onClose={() => setErr(undefined)}>{err}</Notice>}
      <Table head={["Order", "Stage", "Type", "Shown", ""]}>
        {stages.map((s) => {
          const list = s.kind === "stage" ? pipeline : stages.filter((x) => x.kind === "outcome");
          const i = list.indexOf(s);
          return (
            <tr key={s.key}>
              <td className="px-3 py-2 text-xs tabular-nums">{s.position}</td>
              <td className="px-3 py-2"><input className="rounded-lg bg-white px-2 py-1 text-sm ring-1 ring-ink/15 disabled:ring-0" disabled={!isAdmin} defaultValue={s.label} onBlur={(e) => e.target.value.trim() && e.target.value !== s.label && update(s.key, { label: e.target.value.trim() })} aria-label={`Label for ${s.key}`} /></td>
              <td className="px-3 py-2 text-xs">{s.system_event ? "🔒 Set by real events" : s.kind === "outcome" ? "Closed outcome" : "Manual"}{s.queue === "new" ? " · in the daily queue" : ""}</td>
              <td className="px-3 py-2"><input type="checkbox" disabled={!isAdmin || s.key === "do_not_contact"} checked={s.active} onChange={(e) => update(s.key, { active: e.target.checked })} aria-label={`Show ${s.label}`} /></td>
              <td className="space-x-1 px-3 py-2 text-right">
                {isAdmin && i > 0 && <Btn className="!px-2 !py-0.5 !text-xs" onClick={() => swap(s, list[i - 1]!)}>↑</Btn>}
                {isAdmin && i < list.length - 1 && <Btn className="!px-2 !py-0.5 !text-xs" onClick={() => swap(s, list[i + 1]!)}>↓</Btn>}
                {isAdmin && !s.built_in && <Btn tone="danger" className="!px-2 !py-0.5 !text-xs" onClick={async () => { const { error } = await db().from("crm_stages").delete().eq("key", s.key); if (error) setErr(/foreign key/i.test(error.message) ? "Move the prospects out of this stage first." : crmError(error)); else { await loadStages(true); onChanged(); } }}>Delete</Btn>}
              </td>
            </tr>
          );
        })}
      </Table>
      {isAdmin && (
        <div className="mt-3 flex gap-2">
          <input className={`${inputCls} max-w-xs`} placeholder="New manual stage, e.g. Call booked" value={label} onChange={(e) => setLabel(e.target.value.slice(0, 60))} />
          <Btn onClick={add} disabled={!label.trim()}>Add stage</Btn>
        </div>
      )}
    </section>
  );
}
