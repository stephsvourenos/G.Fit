"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { FIELD_BY_KEY, PROSPECT_FIELDS, SCORE_CRITERIA, allocationCategory, parseField, prospectKeys, type FieldGroup } from "@app/domain/crm";
import { Badge } from "@/components/AdminShell";
import { useStaffSession } from "@/lib/staff";
import { CHANNEL_LABEL, PERMISSION_LABEL, crmError, db, fmtCount, fmtDate, loadSettings, loadStaff, loadStages, todaySydney, useLoad, type Card, type Stage } from "@/lib/crm";
import { ActionDialogs, Btn, Modal, Notice, PromptModal, QuickActions, ScoreBadge, StageBadge, inputCls, type QuickAction } from "../_ui";

/* eslint-disable @typescript-eslint/no-explicit-any */
type P = Record<string, any> & Card & { tags: string[]; field_sources: Record<string, { batch?: string; research_date?: string; at?: string; by?: string }> };

interface Activity {
  id: number;
  kind: string;
  channel: string | null;
  direction: string | null;
  sentiment: string | null;
  subject: string | null;
  body: string | null;
  detail: Record<string, any>;
  actor_label: string | null;
  occurred_at: string;
  template_id: string | null;
}

const TABS = ["Overview", "Social Profiles", "Content and Monetisation", "Contact Information", "Outreach History", "Tasks", "Notes", "Application", "Onboarding", "Referral and Acquisition Performance", "Audit History"] as const;
type Tab = (typeof TABS)[number];

export function Profile() {
  const id = useSearchParams().get("id") ?? "";
  const router = useRouter();
  const staff = useStaffSession();
  const isAdmin = staff.roles.includes("admin");
  const [tab, setTab] = useState<Tab>("Overview");
  const [action, setAction] = useState<QuickAction | null>(null);
  const [note, setNote] = useState<{ tone: "ok" | "error"; text: string }>();
  const [editing, setEditing] = useState<FieldGroup | null>(null);
  const [dialog, setDialog] = useState<null | "score" | "cleardnc" | "delete">(null);
  const stages = useLoad<Stage[]>(() => loadStages());
  const staffList = useLoad(() => loadStaff());
  const settings = useLoad(() => loadSettings());
  const p = useLoad<P>(async () => {
    const { data, error } = await db().from("crm_prospects").select("*").eq("id", id).single();
    if (error) throw error;
    return data as P;
  }, [id]);
  const acts = useLoad<Activity[]>(async () => {
    const { data, error } = await db().from("crm_activities").select("*").eq("prospect_id", id).order("occurred_at", { ascending: false }).limit(500);
    if (error) throw error;
    return data as Activity[];
  }, [id]);
  const tasks = useLoad(async () => {
    const { data, error } = await db().from("crm_tasks").select("*").eq("prospect_id", id).order("due_on", { ascending: false });
    if (error) throw error;
    return data as Array<{ id: string; kind: string; title: string; due_on: string; status: string; snoozed_until: string | null; completed_at: string | null }>;
  }, [id]);

  const reloadAll = () => { p.reload(); acts.reload(); tasks.reload(); };
  const done = (m: string) => { setAction(null); setNote({ tone: "ok", text: m }); reloadAll(); };

  const staffEmail = useMemo(() => Object.fromEntries((staffList.data ?? []).map((s) => [s.user_id, s.email])), [staffList.data]);
  if (!id) return <Notice tone="error">No prospect chosen.</Notice>;
  if (p.error) return <Notice tone="error">{p.error}</Notice>;
  if (!p.data) return <p className="text-ink/60">Loading…</p>;
  const x = p.data;
  const card: Card = { ...x, followers: x.estimated_combined_followers ?? (((x.instagram_followers ?? 0) + (x.tiktok_followers ?? 0) + (x.youtube_subscribers ?? 0) + (x.facebook_followers ?? 0)) || null), channel: x.preferred_outreach_channel ?? null };
  const openTasks = (tasks.data ?? []).filter((t) => t.status === "open");
  const objections = (acts.data ?? []).filter((a) => a.kind === "objection");

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-xs text-ink/50"><Link href="/admin/acquisition/prospects/" className="underline">All Prospects</Link> · P-{String(x.ref).padStart(5, "0")}</div>
          <h1 className="font-display text-3xl">{x.creator_name}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-ink/65">
            {x.business_name && x.business_name !== x.creator_name && <span>{x.business_name}</span>}
            <StageBadge stage={x.stage} stages={stages.data} />
            <ScoreBadge score={x.fit_score} tier={x.fit_tier} confidence={x.confidence_level} />
            {x.do_not_contact && <Badge tone="red">Do not contact</Badge>}
            {x.tags.map((t: string) => <Badge key={t}>{t}</Badge>)}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {x.do_not_contact && isAdmin && <Btn onClick={() => setDialog("cleardnc")}>Clear do-not-contact</Btn>}
          {isAdmin && <Btn tone="danger" onClick={() => setDialog("delete")}>Delete prospect</Btn>}
        </div>
      </div>

      {!x.do_not_contact && <QuickActions p={card} onAction={setAction} />}
      {x.do_not_contact && <Notice tone="warn">On the do-not-contact list{x.dnc_reason ? `: ${x.dnc_reason}` : ""} ({fmtDate(x.dnc_at)}). They’re excluded from every queue and can’t be messaged.</Notice>}
      {note && <Notice tone={note.tone} onClose={() => setNote(undefined)}>{note.text}</Notice>}

      <div className="flex gap-1 overflow-x-auto border-b border-ink/10">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`shrink-0 border-b-2 px-3 py-2 text-sm ${tab === t ? "border-coral font-semibold" : "border-transparent text-ink/60 hover:text-ink"}`}>
            {t}{t === "Tasks" && openTasks.length ? ` (${openTasks.length})` : ""}
          </button>
        ))}
      </div>

      {tab === "Overview" && (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <Panel title="Who they are">
              <p className="text-sm">{[x.creator_type, x.primary_category, [x.city, x.country].filter(Boolean).join(", "), x.primary_language].filter(Boolean).join(" · ") || "Not researched yet."}</p>
              {x.secondary_categories?.length > 0 && <p className="mt-1 text-xs text-ink/55">Also: {x.secondary_categories.join(", ")}</p>}
              <p className="mt-1 text-xs text-ink/55">Founding category: {x.allocation_category ?? "doesn't match one yet"}</p>
            </Panel>
            <Panel title="Why they're relevant to G.Fit"><Text v={x.why_gfit_is_relevant} /></Panel>
            <div className="grid gap-4 md:grid-cols-2">
              <Panel title="What they sell now">
                <Facts rows={[["Paid products", x.existing_paid_products], ["Membership", yn(x.existing_membership)], ["Platform", x.monetisation_platform],
                  ["Programme price", x.current_programme_price != null ? `${x.current_programme_price} ${x.current_programme_currency ?? ""} ${x.current_programme_billing_frequency ?? ""}` : null], ["Own fitness app", x.existing_fitness_app]]} />
              </Panel>
              <Panel title="Existing workout content">
                <Facts rows={[["Full-length workouts", yn(x.full_length_workouts_available)], ["Videos (estimate)", x.estimated_workout_video_count], ["Example", x.example_workout_url ? <Ext href={x.example_workout_url}>Watch ↗</Ext> : null],
                  ["Content rights risk", x.content_rights_risk], ["Music licensing risk", x.music_licensing_risk]]} />
              </Panel>
            </div>
            <Panel title="Audience">
              <Facts rows={[["Combined (estimate)", x.estimated_combined_followers != null ? fmtCount(x.estimated_combined_followers) : null], ["Instagram", n(x.instagram_followers)], ["TikTok", n(x.tiktok_followers)],
                ["YouTube", n(x.youtube_subscribers)], ["Facebook", n(x.facebook_followers)], ["Engagement", x.engagement_observations], ["Audience", x.audience_demographic], ["Last active", x.last_active_date && fmtDate(x.last_active_date)]]} />
            </Panel>
            <div className="grid gap-4 md:grid-cols-2">
              <Panel title="Recommended outreach angle"><Text v={x.recommended_pitch_angle} />{x.specific_personalisation_detail && <p className="mt-2 text-xs text-ink/60"><b>Personal detail:</b> {x.specific_personalisation_detail}</p>}</Panel>
              <Panel title="Potential objections">
                <Text v={x.potential_objections} />
                {objections.length > 0 && <ul className="mt-2 list-disc pl-5 text-xs text-ink/65">{objections.map((o) => <li key={o.id}>{o.body} <span className="text-ink/40">({fmtDate(o.occurred_at)})</span></li>)}</ul>}
              </Panel>
            </div>
          </div>
          <div className="space-y-4">
            <Panel title="Next recommended action"><p className="text-sm font-semibold">{nextAction(x, openTasks, stages.data)}</p></Panel>
            <Panel title="Creator fit score" action={<button className="text-xs underline" onClick={() => setDialog("score")}>Adjust</button>}>
              <div className="flex items-center gap-2"><ScoreBadge score={x.fit_score} tier={x.fit_tier} /><span className="text-xs text-ink/55">Confidence: {x.confidence_level ?? "unknown"}</span></div>
              <p className="mt-1 text-xs text-ink/55">{x.fit_score_manual != null ? `Manual score — ${x.fit_score_manual_reason}` : x.criteria_known ? `From ${x.criteria_known} of 6 criteria (missing criteria earn nothing)` : x.total_fit_score != null ? "Researched total" : "No scoring evidence yet"}</p>
              <ul className="mt-2 space-y-1 text-xs">
                {SCORE_CRITERIA.map((c) => <li key={c.key} className="flex justify-between gap-2"><span className="text-ink/60">{c.label}</span><span className="tabular-nums">{x[c.key] ?? "unknown"} / {c.max}</span></li>)}
              </ul>
              <p className="mt-2 text-[11px] text-ink/45">Research assessment only — not a commitment from the creator.</p>
            </Panel>
            <Panel title="Recruitment">
              <Facts rows={[["Stage", <StageBadge key="s" stage={x.stage} stages={stages.data} />], ["Since", fmtDate(x.stage_changed_at)], ["Assigned to", x.assigned_to ? staffEmail[x.assigned_to] ?? "staff" : "nobody"],
                ["Last contact", fmtDate(x.last_contact_at, true)], ["Messages sent", x.outbound_count], ["Source", x.original_recruitment_source], ["Added", fmtDate(x.created_at)],
                ["Outcome", x.recruitment_outcome], ["Reason lost", x.reason_lost]]} />
              <AssignBox p={x} staff={staffList.data ?? []} onDone={done} />
            </Panel>
          </div>
        </div>
      )}

      {(tab === "Social Profiles" || tab === "Content and Monetisation" || tab === "Contact Information") && (
        <div className="space-y-4">
          <FieldPanel p={x} groups={tab === "Social Profiles" ? ["Social media and audience"] : tab === "Content and Monetisation" ? ["Content and monetisation"] : ["Professional contact details"]}
            onEdit={(g) => setEditing(g)} />
          {tab === "Contact Information" && <ContactRules p={x} onDone={done} />}
          {tab === "Social Profiles" && <FieldPanel p={x} groups={["Identity and classification", "Recruitment intelligence"]} onEdit={(g) => setEditing(g)} />}
        </div>
      )}

      {tab === "Outreach History" && <Timeline acts={(acts.data ?? []).filter((a) => ["outreach", "reply", "objection", "stage_change", "dnc", "permission", "channel"].includes(a.kind))} stages={stages.data} />}
      {tab === "Notes" && (
        <div className="space-y-3">
          <Btn tone="dark" onClick={() => setAction("note")}>Add a note</Btn>
          <Timeline acts={(acts.data ?? []).filter((a) => a.kind === "note" || a.kind === "objection")} stages={stages.data} />
        </div>
      )}
      {tab === "Tasks" && (
        <div className="space-y-3">
          <Btn tone="dark" onClick={() => setAction("followup")}>Schedule a follow-up</Btn>
          <div className="rounded-xl bg-white ring-1 ring-ink/5">
            {(tasks.data ?? []).length === 0 && <p className="px-4 py-3 text-sm text-ink/55">No tasks.</p>}
            {(tasks.data ?? []).map((t) => (
              <div key={t.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-ink/5 px-4 py-2.5 text-sm last:border-0">
                <span className={t.status !== "open" ? "text-ink/45 line-through" : ""}>{t.title} · due {fmtDate(t.due_on)}{t.snoozed_until && t.status === "open" ? ` · snoozed to ${fmtDate(t.snoozed_until)}` : ""}</span>
                {t.status === "open" ? (
                  <span className="flex gap-2">
                    <Btn onClick={async () => { const { error } = await db().rpc("crm_task_action", { p_task: t.id, p_action: "done" }); if (error) setNote({ tone: "error", text: crmError(error) }); else tasks.reload(); }}>Done</Btn>
                    <Btn onClick={async () => { const { error } = await db().rpc("crm_task_action", { p_task: t.id, p_action: "cancel" }); if (error) setNote({ tone: "error", text: crmError(error) }); else tasks.reload(); }}>Cancel</Btn>
                  </span>
                ) : <span className="text-xs text-ink/45">{t.status} {fmtDate(t.completed_at)}</span>}
              </div>
            ))}
          </div>
        </div>
      )}
      {tab === "Application" && <Later text="Applications arrive with the founding creator page and personal application links (Phase 2). The application will be linked to this record automatically, and nothing private here (scores, notes, history) will ever be shown to the creator." />}
      {tab === "Onboarding" && <Later text="Once this creator is approved, their onboarding checklist (agreement, profile, payout details, workouts uploaded and approved, referral link) will be shown here from real platform events (Phase 2)." />}
      {tab === "Referral and Acquisition Performance" && (
        <Later text={x.converted_creator_id ? "This prospect is linked to a creator account. Their subscriber referrals, royalties and content performance will be shown here from the existing finance records (Phase 4) — see Admin → Referrals and Royalties for now." : "Referral and subscriber performance appears once this prospect becomes a creator. Recruitment history stays with the record."} />
      )}
      {tab === "Audit History" && <Audit p={x} acts={acts.data ?? []} />}

      <ActionDialogs action={action} prospect={card} stages={stages.data} onClose={() => setAction(null)} onDone={done} />
      {editing && <EditFields p={x} group={editing} settingsCategories={settings.data?.categories.map((c) => c.name) ?? []} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); done("Saved."); }} />}
      {dialog === "score" && <ScoreDialog p={x} onClose={() => setDialog(null)} onDone={(m) => { setDialog(null); done(m); }} />}
      {dialog === "cleardnc" && (
        <PromptModal title="Clear do-not-contact" label="Why is it OK to contact them again?" cta="Clear" onClose={() => setDialog(null)} hint="Only do this if the creator has told us they're happy to hear from us. It's recorded in the audit log."
          onSubmit={async (v) => { const { error } = await db().rpc("crm_clear_dnc", { p_prospect: x.id, p_reason: v }); if (error) return crmError(error); setDialog(null); done("Do-not-contact cleared."); }} />
      )}
      {dialog === "delete" && (
        <Modal title={`Delete ${x.creator_name}?`} onClose={() => setDialog(null)}>
          <p className="text-sm">This permanently deletes the record and its history (for example, when someone asks us to delete their data). If they asked not to be contacted, mark them do-not-contact first so they stay excluded from future imports.</p>
          <div className="mt-4 flex gap-2">
            <Btn tone="danger" onClick={async () => { const { error } = await db().from("crm_prospects").delete().eq("id", x.id); if (error) return setNote({ tone: "error", text: crmError(error) }); router.push("/admin/acquisition/prospects/"); }}>Delete permanently</Btn>
            <Btn onClick={() => setDialog(null)}>Cancel</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}

function ScoreDialog({ p, onClose, onDone }: { p: P; onClose: () => void; onDone: (m: string) => void }) {
  const [score, setScore] = useState(p.fit_score_manual?.toString() ?? "");
  const [reason, setReason] = useState("");
  const [err, setErr] = useState<string>();
  async function save(clear: boolean) {
    const v = clear ? null : Number(score);
    if (v !== null && (!Number.isFinite(v) || v < 0 || v > 100)) return setErr("Enter a number from 0 to 100.");
    const { error } = await db().rpc("crm_adjust_score", { p_prospect: p.id, p_score: v, p_reason: clear ? "Back to calculated score" : reason });
    if (error) return setErr(crmError(error));
    onDone(clear ? "Back to the calculated score." : "Score adjusted.");
  }
  return (
    <Modal title="Adjust the fit score" onClose={onClose}>
      <div className="space-y-3 text-sm">
        <input className={inputCls} inputMode="decimal" placeholder="Score out of 100" value={score} onChange={(e) => setScore(e.target.value)} />
        <input className={inputCls} placeholder="Reason (required, kept in the history)" value={reason} onChange={(e) => setReason(e.target.value)} />
        {err && <Notice tone="error">{err}</Notice>}
        <div className="flex gap-2">
          <Btn tone="primary" disabled={!score.trim() || !reason.trim()} onClick={() => save(false)}>Save</Btn>
          {p.fit_score_manual != null && <Btn onClick={() => save(true)}>Use calculated score</Btn>}
          <Btn onClick={onClose}>Cancel</Btn>
        </div>
      </div>
    </Modal>
  );
}

const yn = (b: boolean | null | undefined) => (b === true ? "Yes" : b === false ? "No" : null);
const n = (v: number | null | undefined) => (v == null ? null : fmtCount(v));

function nextAction(x: P, open: Array<{ kind: string; title: string; due_on: string }>, stages?: Stage[]): string {
  if (x.do_not_contact) return "None — do not contact.";
  const reply = open.find((t) => t.kind === "reply");
  if (reply) return `Reply to them (${reply.title}).`;
  const fu = open.filter((t) => t.kind === "follow_up").sort((a, b) => a.due_on.localeCompare(b.due_on))[0];
  if (fu) return fu.due_on <= todaySydney() ? "Send the follow-up — it's due." : `Wait for a reply. Follow-up due ${fmtDate(fu.due_on)}.`;
  const st = stages?.find((s) => s.key === x.stage);
  if (st?.queue === "new" && x.outbound_count === 0) {
    if (!x.instagram_url && !x.tiktok_url && !x.public_business_email && !x.facebook_url && !x.linkedin_url && !x.contact_form_url) return "Find a contact route (profile link or business email).";
    return "Send the first message.";
  }
  if (x.stage === "interested") return "Invite them to apply (application links arrive in Phase 2 — for now, send the details by message).";
  if (x.stage === "responded") return "Answer their questions.";
  if (st?.kind === "outcome") return "No action — closed.";
  return "Keep the conversation going; schedule a follow-up.";
}

function Panel({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="rounded-xl bg-white p-4 ring-1 ring-ink/5">
      <div className="mb-2 flex items-center justify-between"><h2 className="text-xs font-semibold uppercase tracking-wide text-ink/50">{title}</h2>{action}</div>
      {children}
    </section>
  );
}
function Text({ v }: { v: string | null | undefined }) {
  return v ? <p className="whitespace-pre-line text-sm">{v}</p> : <p className="text-sm text-ink/45">Unknown — not researched yet.</p>;
}
function Facts({ rows }: { rows: Array<[string, React.ReactNode]> }) {
  return (
    <dl className="space-y-1 text-sm">
      {rows.map(([k, v]) => (
        <div key={k} className="flex justify-between gap-3"><dt className="text-ink/55">{k}</dt><dd className="text-right">{v === null || v === undefined || v === "" ? <span className="text-ink/40">unknown</span> : v}</dd></div>
      ))}
    </dl>
  );
}
function Ext({ href, children }: { href: string; children: React.ReactNode }) {
  return /^https?:\/\//i.test(href) ? <a href={href} target="_blank" rel="noopener noreferrer nofollow" className="font-semibold text-sky hover:underline">{children}</a> : <>{href}</>;
}
function Later({ text }: { text: string }) {
  return <div className="max-w-2xl rounded-xl bg-white p-5 text-sm text-ink/65 ring-1 ring-ink/5">{text}</div>;
}

function display(key: string, v: any): React.ReactNode {
  const def = FIELD_BY_KEY[key];
  if (v === null || v === undefined || (Array.isArray(v) && !v.length)) return null;
  if (def?.type === "url") return <Ext href={v}>{v.replace(/^https?:\/\/(www\.)?/, "").slice(0, 60)} ↗</Ext>;
  if (def?.type === "bool") return yn(v);
  if (def?.type === "date") return fmtDate(v);
  if (def?.type === "int") return Number(v).toLocaleString("en-AU");
  if (Array.isArray(v)) return def?.key === "research_source_urls" ? <span className="flex flex-col items-end">{v.map((u: string) => <Ext key={u} href={u}>{u.slice(0, 50)} ↗</Ext>)}</span> : v.join(", ");
  if (key === "public_business_email") return <a className="text-sky" href={`mailto:${v}`}>{v}</a>;
  return <span className="whitespace-pre-line">{String(v)}</span>;
}

function FieldPanel({ p, groups, onEdit }: { p: P; groups: FieldGroup[]; onEdit: (g: FieldGroup) => void }) {
  return (
    <>
      {groups.map((g) => (
        <Panel key={g} title={g} action={<button className="text-xs underline" onClick={() => onEdit(g)}>Edit</button>}>
          <dl className="divide-y divide-ink/5 text-sm">
            {PROSPECT_FIELDS.filter((f) => f.group === g).map((f) => (
              <div key={f.key} className="flex justify-between gap-4 py-1.5">
                <dt className="text-ink/55">{f.label}</dt>
                <dd className="max-w-[65%] text-right">
                  {display(f.key, p[f.key]) ?? <span className="text-ink/40">unknown</span>}
                  {p.field_sources?.[f.key] && <div className="text-[10px] text-ink/40">{p.field_sources[f.key]!.batch ? "from import" : "edited"} {fmtDate(p.field_sources[f.key]!.at)}{p.field_sources[f.key]!.research_date ? ` · researched ${fmtDate(p.field_sources[f.key]!.research_date)}` : ""}</div>}
                </dd>
              </div>
            ))}
          </dl>
        </Panel>
      ))}
    </>
  );
}

function ContactRules({ p, onDone }: { p: P; onDone: (m: string) => void }) {
  const [err, setErr] = useState<string>();
  const channels = ["instagram", "tiktok", "email", "facebook", "linkedin", "contact_form", "youtube"];
  return (
    <Panel title="Contact permission and channels">
      <label className="block text-sm">
        <span className="text-ink/55">Email permission</span>
        <select className={`${inputCls} mt-1 max-w-md`} value={p.outreach_permission_status} disabled={p.do_not_contact}
          onChange={async (e) => { const { error } = await db().rpc("crm_update_prospect", { p_id: p.id, p_patch: { outreach_permission_status: e.target.value, contact_verified_on: todaySydney() } }); if (error) setErr(crmError(error)); else onDone("Permission updated."); }}>
          {Object.entries(PERMISSION_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </label>
      <p className="mt-1 text-xs text-ink/55">Recruitment emails need the address to be published for business enquiries (check where it came from: {p.contact_source_url ? <Ext href={p.contact_source_url}>source ↗</Ext> : "no source recorded"}) or the creator’s agreement. Verified {fmtDate(p.contact_verified_on)}.</p>
      <div className="mt-3 text-sm">
        <span className="text-ink/55">Channels we shouldn’t use</span>
        <div className="mt-1 flex flex-wrap gap-2">
          {channels.map((c) => {
            const off = p.unavailable_channels?.includes(c);
            return (
              <label key={c} className={`flex items-center gap-1.5 rounded-full px-3 py-1 ring-1 ${off ? "bg-coral/10 ring-coral/30" : "ring-ink/15"}`}>
                <input type="checkbox" checked={!!off} onChange={async (e) => { const { error } = await db().rpc("crm_set_channel", { p_prospect: p.id, p_channel: c, p_unavailable: e.target.checked }); if (error) setErr(crmError(error)); else onDone(e.target.checked ? `${CHANNEL_LABEL[c]} marked unavailable.` : `${CHANNEL_LABEL[c]} available again.`); }} />
                {CHANNEL_LABEL[c]} unavailable
              </label>
            );
          })}
        </div>
      </div>
      {err && <div className="mt-2"><Notice tone="error">{err}</Notice></div>}
    </Panel>
  );
}

function AssignBox({ p, staff, onDone }: { p: P; staff: Array<{ user_id: string; email: string }>; onDone: (m: string) => void }) {
  return (
    <select className={`${inputCls} mt-3`} value={p.assigned_to ?? ""} aria-label="Assign to"
      onChange={async (e) => { const { error } = await db().rpc("crm_update_prospect", { p_id: p.id, p_patch: { assigned_to: e.target.value || null } }); onDone(error ? crmError(error) : "Assignment saved."); }}>
      <option value="">Unassigned</option>
      {staff.map((s) => <option key={s.user_id} value={s.user_id}>{s.email}</option>)}
    </select>
  );
}

function asInput(key: string, v: any): string {
  if (v === null || v === undefined) return "";
  if (Array.isArray(v)) return v.join("; ");
  if (typeof v === "boolean") return v ? "yes" : "no";
  return String(v);
}

function EditFields({ p, group, onClose, onSaved, settingsCategories }: { p: P; group: FieldGroup; onClose: () => void; onSaved: () => void; settingsCategories: string[] }) {
  const fields = PROSPECT_FIELDS.filter((f) => f.group === group && f.kind !== "management");
  const [v, setV] = useState<Record<string, string>>(() => Object.fromEntries(fields.map((f) => [f.key, asInput(f.key, p[f.key])])));
  const [err, setErr] = useState<string>();
  async function save() {
    const patch: Record<string, unknown> = {};
    for (const f of fields) {
      if (v[f.key] === asInput(f.key, p[f.key])) continue;
      const r = parseField(f, v[f.key] ?? "");
      if (r.error) return setErr(r.error);
      if (f.key === "creator_name" && !r.value) return setErr("The creator needs a name.");
      patch[f.key] = r.value;
    }
    if (!Object.keys(patch).length) return onClose();
    const merged = { ...p, ...patch };
    if ("primary_category" in patch) patch.allocation_category = allocationCategory(patch.primary_category as string | null, undefined) ?? (settingsCategories.includes(String(patch.primary_category)) ? patch.primary_category : null);
    const { error } = await db().rpc("crm_update_prospect", { p_id: p.id, p_patch: patch, p_keys: prospectKeys(merged) });
    if (error) return setErr(crmError(error));
    onSaved();
  }
  return (
    <Modal title={`Edit — ${group}`} onClose={onClose} wide>
      <p className="mb-3 text-xs text-ink/55">Leave a field empty (or write “unknown”) if we don’t know it. Links must start with https://.</p>
      <div className="grid gap-3 md:grid-cols-2">
        {fields.map((f) => (
          <label key={f.key} className={`text-sm ${f.type === "longtext" ? "md:col-span-2" : ""}`}>
            <span className="mb-1 block text-xs font-semibold text-ink/60">{f.label}</span>
            {f.type === "bool" ? (
              <select className={inputCls} value={v[f.key]} onChange={(e) => setV((x) => ({ ...x, [f.key]: e.target.value }))}><option value="">Unknown</option><option value="yes">Yes</option><option value="no">No</option></select>
            ) : f.type === "enum" ? (
              <select className={inputCls} value={v[f.key]} onChange={(e) => setV((x) => ({ ...x, [f.key]: e.target.value }))}><option value="">Unknown</option>{f.values!.map((o) => <option key={o} value={o}>{CHANNEL_LABEL[o] ?? o}</option>)}</select>
            ) : f.type === "longtext" ? (
              <textarea className={`${inputCls} min-h-20`} value={v[f.key]} onChange={(e) => setV((x) => ({ ...x, [f.key]: e.target.value }))} />
            ) : (
              <input className={inputCls} type={f.type === "date" ? "date" : "text"} value={v[f.key]} onChange={(e) => setV((x) => ({ ...x, [f.key]: e.target.value }))} />
            )}
          </label>
        ))}
      </div>
      {err && <div className="mt-3"><Notice tone="error">{err}</Notice></div>}
      <div className="mt-4 flex gap-2"><Btn tone="primary" onClick={save}>Save</Btn><Btn onClick={onClose}>Cancel</Btn></div>
    </Modal>
  );
}

const KIND_LABEL: Record<string, string> = {
  outreach: "Message sent", reply: "Reply received", note: "Note", stage_change: "Stage changed", task: "Task", import: "Imported", import_update: "Updated by import",
  edit: "Details edited", score_adjust: "Score adjusted", dnc: "Do-not-contact", permission: "Contact permission", assignment: "Assigned", objection: "Objection", channel: "Channel",
};

function Timeline({ acts, stages }: { acts: Activity[]; stages?: Stage[] }) {
  const label = (k: string) => stages?.find((s) => s.key === k)?.label ?? k;
  if (!acts.length) return <p className="rounded-xl bg-white px-4 py-3 text-sm text-ink/55 ring-1 ring-ink/5">Nothing yet.</p>;
  return (
    <ol className="space-y-2">
      {acts.map((a) => (
        <li key={a.id} className="rounded-xl bg-white px-4 py-3 text-sm ring-1 ring-ink/5">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-ink/55">
            <span className="font-semibold text-ink">
              {KIND_LABEL[a.kind] ?? a.kind}{a.channel ? ` · ${CHANNEL_LABEL[a.channel] ?? a.channel}` : ""}{a.sentiment ? ` · ${a.sentiment}` : ""}
              {a.kind === "stage_change" && ` · ${label(a.detail.from)} → ${label(a.detail.to)}`}
              {a.kind === "permission" && ` · ${PERMISSION_LABEL[a.detail.status] ?? a.detail.status}`}
              {a.kind === "assignment" && ` · ${a.detail.to ?? "nobody"}`}
              {a.kind === "channel" && ` · ${a.detail.unavailable ? "marked unavailable" : "available again"}`}
            </span>
            <span>{fmtDate(a.occurred_at, true)} · {a.actor_label ?? "system"}</span>
          </div>
          {a.subject && <div className="mt-1 font-semibold">{a.subject}</div>}
          {a.body && <p className="mt-1 whitespace-pre-line text-ink/80">{a.body}</p>}
          {a.detail.override_reason && <p className="mt-1 text-xs text-[#8a5a00]">Admin override: {a.detail.override_reason}</p>}
          {a.detail.fields && <p className="mt-1 text-xs text-ink/55">{(a.detail.fields as string[]).map((f) => FIELD_BY_KEY[f]?.label ?? f).join(", ")}</p>}
          {a.kind === "score_adjust" && <p className="mt-1 text-xs text-ink/55">{a.detail.from ?? "none"} → {a.detail.manual ?? "calculated"}</p>}
        </li>
      ))}
    </ol>
  );
}

function Audit({ p, acts }: { p: P; acts: Activity[] }) {
  const changes = acts.filter((a) => ["import", "import_update", "edit", "stage_change", "score_adjust", "dnc", "permission", "assignment", "channel"].includes(a.kind));
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink/50">Changes to this record</h2>
        <Timeline acts={changes} />
      </div>
      <Panel title="Where each researched fact came from">
        <dl className="space-y-1 text-xs">
          {Object.entries(p.field_sources ?? {}).sort(([a], [b]) => a.localeCompare(b)).map(([k, s]) => (
            <div key={k} className="flex justify-between gap-3">
              <dt className="text-ink/60">{FIELD_BY_KEY[k]?.label ?? k}</dt>
              <dd className="text-right">{s.batch ? "Import" : "Edited"} {fmtDate(s.at)} by {s.by ?? "system"}{s.research_date ? ` · researched ${fmtDate(s.research_date)}` : ""}</dd>
            </div>
          ))}
        </dl>
        {(p.research_source_urls?.length ?? 0) > 0 && <p className="mt-3 text-xs text-ink/55">Research sources are on the Social Profiles tab.</p>}
      </Panel>
    </div>
  );
}
/* eslint-enable @typescript-eslint/no-explicit-any */
