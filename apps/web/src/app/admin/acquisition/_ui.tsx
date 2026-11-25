"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { hasMissingMarks, mergeValuesFor, renderTemplate } from "@app/domain/crm";
import { Badge } from "@/components/AdminShell";
import { supabaseConfigured } from "@/lib/supabase";
import {
  CHANNEL_LABEL,
  PURPOSE_LABEL,
  addDays,
  channelUrl,
  copyText,
  crmError,
  db,
  fmtCount,
  fmtDate,
  loadSettings,
  loadTemplates,
  profileLinks,
  todaySydney,
  type Card,
  type CrmSettings,
  type Stage,
  type Template,
} from "@/lib/crm";

export function NeedsDatabase({ children }: { children: React.ReactNode }) {
  if (!supabaseConfigured) {
    return (
      <div className="rounded-xl bg-white p-6 text-sm text-ink/70 ring-1 ring-ink/5">
        The creator CRM works on the real database only. This copy of the site is running with sample data, so there’s nothing to show here.
      </div>
    );
  }
  return <>{children}</>;
}

export function Notice({ tone = "info", children, onClose }: { tone?: "info" | "ok" | "error" | "warn"; children: React.ReactNode; onClose?: () => void }) {
  const cls = { info: "bg-sky/10", ok: "bg-mint/15", error: "bg-coral/10", warn: "bg-sun/25" }[tone];
  return (
    <div role={tone === "error" ? "alert" : "status"} className={`flex items-start justify-between gap-3 rounded-xl px-4 py-3 text-sm text-ink ${cls}`}>
      <div>{children}</div>
      {onClose && <button onClick={onClose} className="text-ink/50 hover:text-ink" aria-label="Dismiss">✕</button>}
    </div>
  );
}

export function Btn({ tone = "plain", className = "", ...p }: React.ButtonHTMLAttributes<HTMLButtonElement> & { tone?: "primary" | "dark" | "plain" | "danger" }) {
  const t = {
    primary: "bg-coral text-white hover:bg-gum-hover",
    dark: "bg-ink text-paper hover:bg-ink-2",
    plain: "bg-white text-ink ring-1 ring-ink/15 hover:bg-ink/5",
    danger: "bg-white text-[#b8361a] ring-1 ring-coral/40 hover:bg-coral/10",
  }[tone];
  return <button type="button" {...p} className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-45 ${t} ${className}`} />;
}

export const inputCls = "w-full rounded-lg border-0 bg-white px-3 py-2 text-sm ring-1 ring-ink/15 focus:ring-2 focus:ring-sky";

export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    ref.current?.querySelector<HTMLElement>("textarea, input, select, button")?.focus();
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} role="dialog" aria-modal="true" aria-label={title} className={`max-h-[92vh] w-full overflow-y-auto rounded-2xl bg-page p-5 shadow-xl ${wide ? "max-w-3xl" : "max-w-lg"}`}>
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 className="font-display text-xl">{title}</h2>
          <button onClick={onClose} className="text-ink/50 hover:text-ink" aria-label="Close">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function StageBadge({ stage, stages }: { stage: string; stages?: Stage[] }) {
  const s = stages?.find((x) => x.key === stage);
  const label = s?.label ?? stage.replace(/_/g, " ");
  const tone = stage === "do_not_contact" ? "red" : s?.kind === "outcome" ? "grey" : (s?.position ?? 0) >= 13 ? "green" : (s?.position ?? 0) >= 6 ? "blue" : "grey";
  return <Badge tone={tone}>{label}</Badge>;
}

/** Score and confidence are shown separately: a high score with low confidence is a guess, not a fact. */
export function ScoreBadge({ score, tier, confidence }: { score: number | null; tier: string | null; confidence?: string | null }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      {score === null ? (
        <Badge tone="grey">No score</Badge>
      ) : (
        <Badge tone={tier === "A" ? "green" : tier === "B" ? "blue" : tier === "C" ? "amber" : "grey"}>
          {tier} · {Number(score).toFixed(0)}
        </Badge>
      )}
      {confidence && <span className="text-xs text-ink/55" title="How sure the research is">{confidence} conf.</span>}
    </span>
  );
}

export function LinkChips({ p }: { p: Partial<Card> }) {
  const links = profileLinks(p);
  if (!links.length) return <span className="text-xs text-ink/45">No links</span>;
  return (
    <span className="flex flex-wrap gap-1.5">
      {links.map((l) => (
        <a key={l.channel} href={l.url} target="_blank" rel="noopener noreferrer nofollow" className="rounded-full bg-ink/5 px-2 py-0.5 text-xs font-semibold text-sky hover:bg-ink/10">
          {CHANNEL_LABEL[l.channel] ?? l.channel} ↗
        </a>
      ))}
    </span>
  );
}

export function ProspectSummary({ p, stages, reasons }: { p: Card; stages?: Stage[]; reasons?: string[] }) {
  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-center gap-2">
        <Link href={`/admin/acquisition/prospect/?id=${p.id}`} className="font-semibold hover:underline">{p.creator_name}</Link>
        <ScoreBadge score={p.fit_score} tier={p.fit_tier} confidence={p.confidence_level} />
        <StageBadge stage={p.stage} stages={stages} />
      </div>
      <div className="mt-0.5 text-xs text-ink/60">
        {[p.primary_category, p.country, p.primary_platform && CHANNEL_LABEL[p.primary_platform], p.followers !== null ? `${fmtCount(p.followers)} followers` : "audience unknown",
          p.last_contact_at ? `last contact ${fmtDate(p.last_contact_at)}` : null].filter(Boolean).join(" · ")}
      </div>
      {reasons && reasons.length > 0 && <div className="mt-1 text-xs text-ink/50">Why now: {reasons.join(" · ")}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// Message composer: pick a prepared message or template, review, copy, open the profile, then confirm it was sent.
// ---------------------------------------------------------------------------------------------------------------
interface ComposerProps {
  prospect: Card;
  onClose: () => void;
  onSent: (msg: string) => void;
  defaultPurpose?: string;
}

let settingsPromise: Promise<CrmSettings> | null = null;
let templatesPromise: Promise<Template[]> | null = null;
export function refreshTemplateCache() {
  templatesPromise = null;
  settingsPromise = null;
}

export function Composer({ prospect: p, onClose, onSent, defaultPurpose }: ComposerProps) {
  const [settings, setSettings] = useState<CrmSettings>();
  const [templates, setTemplates] = useState<Template[]>([]);
  const channels = useMemo(() => {
    const c: string[] = [];
    const avail = (k: string) => !p.unavailable_channels?.includes(k);
    if (p.instagram_url && avail("instagram")) c.push("instagram");
    if (p.tiktok_url && avail("tiktok")) c.push("tiktok");
    if (p.public_business_email && avail("email")) c.push("email");
    if (p.facebook_url && avail("facebook")) c.push("facebook");
    if (p.linkedin_url && avail("linkedin")) c.push("linkedin");
    if (p.contact_form_url && avail("contact_form")) c.push("contact_form");
    if (p.youtube_url && avail("youtube")) c.push("youtube");
    return c;
  }, [p]);
  const [channel, setChannel] = useState<string>(p.channel && channels.includes(p.channel) ? p.channel : channels[0] ?? "");
  const [sourceChoice, setSource] = useState<string | null>(null); // "prepared" | template id; null = the best default
  const [draft, setDraft] = useState<{ subject: string; body: string } | null>(null); // the person's own edits
  const [note, setNote] = useState<{ tone: "ok" | "error" | "warn"; text: string }>();
  const [confirmPerm, setConfirmPerm] = useState(false);
  const [needsForce, setNeedsForce] = useState(false);
  const [busy, setBusy] = useState(false);
  const isEmail = channel === "email";
  const kind = isEmail ? "email" : channel === "contact_form" ? "contact_form" : channel === "linkedin" ? "linkedin" : "dm";

  useEffect(() => {
    settingsPromise ??= loadSettings();
    templatesPromise ??= loadTemplates();
    Promise.all([settingsPromise, templatesPromise])
      .then(([s, t]) => {
        setSettings(s);
        setTemplates(t.filter((x) => x.active));
      })
      .catch((e) => setNote({ tone: "error", text: crmError(e) }));
  }, []);

  const purpose = defaultPurpose ?? (p.outbound_count > 0 ? "follow_up" : "initial");
  const prepared = isEmail ? p.personalised_initial_email : p.personalised_initial_dm;
  const options = useMemo(() => {
    const fit = templates.filter((t) => (t.channel === kind || (kind !== "email" && t.channel === "dm")) && t.purpose === purpose);
    const rank = (t: Template) =>
      (t.categories.includes(p.allocation_category ?? "") ? -3 : 0) + (t.follow_up_number === p.outbound_count ? -2 : 0) + (t.categories.length ? 1 : 0);
    const rest = templates.filter((t) => !fit.includes(t) && (t.channel === kind || (kind !== "email" && t.channel === "dm")));
    return [...fit.sort((a, b) => rank(a) - rank(b)), ...rest];
  }, [templates, kind, purpose, p]);

  const source = sourceChoice ?? (purpose === "initial" && prepared ? "prepared" : options[0]?.id ?? "");

  const mergeValues = useMemo(
    () =>
      settings
        ? mergeValuesFor(p as unknown as Record<string, unknown>, {
            founder_name: settings.founder_name,
            launch_date: String(settings.targets.launch_date ?? ""),
            application_url: settings.application_url,
            founding_places_remaining: null, // shown only once Phase 2 counts real founding places
          })
        : {},
    [settings, p],
  );

  // the text from the chosen source, until the person starts editing it
  const generated = useMemo(() => {
    if (source === "prepared") return { subject: "", body: prepared ?? "" };
    const t = templates.find((x) => x.id === source);
    if (!t) return { subject: "", body: "" };
    return { subject: t.subject ? renderTemplate(t.subject, mergeValues).text : "", body: renderTemplate(t.body, mergeValues).text };
  }, [source, templates, mergeValues, prepared]);
  const subject = draft?.subject ?? generated.subject;
  const body = draft?.body ?? generated.body;
  const setSubject = (v: string) => setDraft({ subject: v, body });
  const setBody = (v: string) => setDraft({ subject, body: v });

  const template = templates.find((x) => x.id === source);
  const missing = hasMissingMarks(body) || (isEmail && hasMissingMarks(subject));
  const url = channelUrl(p, channel);
  const commercial = template ? template.commercial : true;
  const optOutMissing = isEmail && commercial && !/no thanks|unsubscribe|won.t contact you again|opt out/i.test(body);

  async function copy(text: string, what: string) {
    const ok = await copyText(text);
    setNote(ok ? { tone: "ok", text: `${what} copied. Nothing is logged until you confirm you sent it.` } : { tone: "error", text: "Couldn't copy — select the text and copy it yourself." });
  }

  async function confirmSent(force = false) {
    setBusy(true);
    setNote(undefined);
    const { data, error } = await db().rpc("crm_log_outreach", {
      p_prospect: p.id, p_channel: channel, p_body: body, p_subject: isEmail ? subject || null : null,
      p_template: template?.id ?? null, p_template_version: template?.current_version ?? null,
      p_confirm_permission: confirmPerm, p_force: force,
    });
    setBusy(false);
    if (error) {
      if (/confirm the address is published/i.test(error.message)) {
        setNote({ tone: "warn", text: "Before emailing, tick the box to confirm this address is published for business enquiries (see where it came from on the Contact tab)." });
      } else if (/Already contacted/i.test(error.message)) {
        setNeedsForce(true);
        setNote({ tone: "warn", text: `${crmError(error)}. If you really did send another message, confirm again.` });
      } else setNote({ tone: "error", text: crmError(error) });
      return;
    }
    const due = (data as { follow_up_on?: string })?.follow_up_on;
    onSent(`Logged your ${CHANNEL_LABEL[channel]} message to ${p.creator_name}.${due ? ` Follow-up scheduled for ${fmtDate(due)}.` : ""}`);
  }

  if (!channels.length) {
    return (
      <Modal title={`Contact ${p.creator_name}`} onClose={onClose}>
        <Notice tone="warn">There’s no usable contact channel for this creator. Add a profile link or business email on their profile first.</Notice>
      </Modal>
    );
  }

  return (
    <Modal title={`Contact ${p.creator_name}`} onClose={onClose} wide>
      <div className="space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-sm">
            <span className="mb-1 block text-xs font-semibold text-ink/60">Channel</span>
            <select className={inputCls} value={channel} onChange={(e) => { setChannel(e.target.value); setSource(null); setDraft(null); }}>
              {channels.map((c) => <option key={c} value={c}>{CHANNEL_LABEL[c]}</option>)}
            </select>
          </label>
          <label className="min-w-64 flex-1 text-sm">
            <span className="mb-1 block text-xs font-semibold text-ink/60">Message</span>
            <select className={inputCls} value={source} onChange={(e) => { setSource(e.target.value); setDraft(null); }}>
              {prepared && <option value="prepared">Prepared by research ({isEmail ? "email" : "DM"})</option>}
              {options.map((t) => <option key={t.id} value={t.id}>{t.name} — {PURPOSE_LABEL[t.purpose]}</option>)}
            </select>
          </label>
        </div>

        {isEmail && (
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-semibold text-ink/60">Subject</span>
            <input className={inputCls} value={subject} onChange={(e) => setSubject(e.target.value)} />
          </label>
        )}
        <label className="block text-sm">
          <span className="mb-1 block text-xs font-semibold text-ink/60">Review and edit before sending</span>
          <textarea className={`${inputCls} min-h-56 font-[inherit] leading-relaxed`} value={body} onChange={(e) => setBody(e.target.value)} />
        </label>
        {missing && <Notice tone="warn">Replace each <b>[[add …]]</b> with a real detail (or delete it). We never fill gaps with made-up facts, so copying is switched off until they’re gone.</Notice>}
        {optOutMissing && <Notice tone="warn">Recruitment emails should tell the creator how to opt out (for example “just reply ‘no thanks’ and we won’t contact you again”) and say who it’s from.</Notice>}
        {p.why_gfit_is_relevant && <p className="text-xs text-ink/55"><b>Research:</b> {p.why_gfit_is_relevant}</p>}

        <div className="flex flex-wrap gap-2">
          <Btn tone="dark" disabled={!body.trim() || missing} onClick={() => copy(isEmail && subject ? `${body}` : body, "Message")}>Copy message</Btn>
          {url && <a href={url} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center rounded-full bg-white px-3 py-1.5 text-sm font-semibold ring-1 ring-ink/15 hover:bg-ink/5">Open {CHANNEL_LABEL[channel]} ↗</a>}
          {isEmail && p.public_business_email && (
            <>
              <Btn onClick={() => copy(p.public_business_email!, "Email address")}>Copy email address</Btn>
              {!missing && (
                <a href={`mailto:${encodeURIComponent(p.public_business_email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`}
                   className="inline-flex items-center rounded-full bg-white px-3 py-1.5 text-sm font-semibold ring-1 ring-ink/15 hover:bg-ink/5">Open in my email app ↗</a>
              )}
            </>
          )}
        </div>

        <div className="rounded-xl bg-white p-4 ring-1 ring-ink/5">
          <p className="text-sm font-semibold">Sent it yourself?</p>
          <p className="mt-0.5 text-xs text-ink/60">G.Fit never sends DMs for you. Once you’ve sent the message on {CHANNEL_LABEL[channel]}, confirm here: we log it and schedule the follow-up.</p>
          {isEmail && p.outreach_permission_status === "unknown" && (
            <label className="mt-3 flex items-start gap-2 text-sm">
              <input type="checkbox" className="mt-1" checked={confirmPerm} onChange={(e) => setConfirmPerm(e.target.checked)} />
              <span>I’ve checked this address is published for business enquiries{p.public_business_email ? ` (${p.public_business_email})` : ""}, and this message is relevant to their business.</span>
            </label>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <Btn tone="primary" disabled={busy || !body.trim() || missing} onClick={() => confirmSent(needsForce)}>{needsForce ? "Yes, I sent another message" : "I've sent it"}</Btn>
            <Btn onClick={onClose}>Not now</Btn>
          </div>
        </div>
        {note && <Notice tone={note.tone}>{note.text}</Notice>}
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// Smaller actions
// ---------------------------------------------------------------------------------------------------------------
export function RecordResponse({ prospect, onClose, onDone }: { prospect: Card; onClose: () => void; onDone: (m: string) => void }) {
  const [sentiment, setSentiment] = useState<"positive" | "neutral" | "negative">("positive");
  const [summary, setSummary] = useState("");
  const [objection, setObjection] = useState("");
  const [channel, setChannel] = useState(prospect.channel ?? "instagram");
  const [err, setErr] = useState<string>();
  async function save() {
    const { error } = await db().rpc("crm_record_response", { p_prospect: prospect.id, p_sentiment: sentiment, p_summary: summary, p_channel: channel, p_objection: objection || null });
    if (error) return setErr(crmError(error));
    onDone(`Reply from ${prospect.creator_name} recorded.`);
  }
  return (
    <Modal title={`Reply from ${prospect.creator_name}`} onClose={onClose}>
      <div className="space-y-3 text-sm">
        <div className="flex flex-wrap gap-2">
          {(["positive", "neutral", "negative"] as const).map((s) => (
            <label key={s} className={`cursor-pointer rounded-full px-3 py-1.5 ring-1 ${sentiment === s ? "bg-ink text-paper ring-ink" : "ring-ink/15"}`}>
              <input type="radio" className="sr-only" checked={sentiment === s} onChange={() => setSentiment(s)} />
              {s === "positive" ? "Interested" : s === "neutral" ? "Has questions / unsure" : "Not interested"}
            </label>
          ))}
        </div>
        <select className={inputCls} value={channel} onChange={(e) => setChannel(e.target.value)} aria-label="Channel">
          {Object.entries(CHANNEL_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <textarea className={`${inputCls} min-h-24`} placeholder="What did they say? (summary)" value={summary} onChange={(e) => setSummary(e.target.value)} />
        <input className={inputCls} placeholder="Objection or concern, if any (e.g. exclusivity, time, payment terms)" value={objection} onChange={(e) => setObjection(e.target.value)} />
        <p className="text-xs text-ink/55">Interested → stage Interested and a “reply” task for today. Not interested → stage Not Interested (they’re not added to do-not-contact unless you choose that).</p>
        {err && <Notice tone="error">{err}</Notice>}
        <div className="flex gap-2"><Btn tone="primary" onClick={save} disabled={!summary.trim()}>Save reply</Btn><Btn onClick={onClose}>Cancel</Btn></div>
      </div>
    </Modal>
  );
}

export function PromptModal({ title, label, onClose, onSubmit, input = "text", initial = "", cta = "Save", hint }: {
  title: string; label: string; onClose: () => void; onSubmit: (v: string) => Promise<string | void>; input?: "text" | "textarea" | "date"; initial?: string; cta?: string; hint?: string;
}) {
  const [v, setV] = useState(initial);
  const [err, setErr] = useState<string>();
  const [busy, setBusy] = useState(false);
  async function go() {
    setBusy(true);
    const e = await onSubmit(v).catch((x) => crmError(x));
    setBusy(false);
    if (e) setErr(e);
  }
  return (
    <Modal title={title} onClose={onClose}>
      <label className="block text-sm">
        <span className="mb-1 block text-xs font-semibold text-ink/60">{label}</span>
        {input === "textarea" ? <textarea className={`${inputCls} min-h-28`} value={v} onChange={(e) => setV(e.target.value)} /> :
          <input type={input} className={inputCls} value={v} min={input === "date" ? addDays(todaySydney(), 1) : undefined} onChange={(e) => setV(e.target.value)} onKeyDown={(e) => e.key === "Enter" && v.trim() && go()} />}
      </label>
      {hint && <p className="mt-2 text-xs text-ink/55">{hint}</p>}
      {err && <div className="mt-3"><Notice tone="error">{err}</Notice></div>}
      <div className="mt-4 flex gap-2"><Btn tone="primary" disabled={!v.trim() || busy} onClick={go}>{cta}</Btn><Btn onClick={onClose}>Cancel</Btn></div>
    </Modal>
  );
}

export type QuickAction = "compose" | "reply" | "note" | "followup" | "snooze" | "dnc" | "stage";

/** The dialogs behind each quick action, so every screen behaves the same way. */
export function ActionDialogs({ action, prospect, taskId, stages, onClose, onDone }: {
  action: QuickAction | null; prospect: Card | null; taskId?: string | null; stages?: Stage[]; onClose: () => void; onDone: (msg: string) => void;
}) {
  if (!action || !prospect) return null;
  const p = prospect;
  switch (action) {
    case "compose":
      return <Composer prospect={p} onClose={onClose} onSent={onDone} />;
    case "reply":
      return <RecordResponse prospect={p} onClose={onClose} onDone={onDone} />;
    case "note":
      return <PromptModal title={`Note on ${p.creator_name}`} label="Internal note (staff only)" input="textarea" onClose={onClose}
        onSubmit={async (v) => { const { error } = await db().rpc("crm_add_note", { p_prospect: p.id, p_body: v }); if (error) return crmError(error); onDone("Note added."); }} />;
    case "followup":
      return <PromptModal title={`Schedule a follow-up with ${p.creator_name}`} label="Follow up on" input="date" initial={addDays(todaySydney(), 3)} onClose={onClose}
        onSubmit={async (v) => { const { error } = await db().rpc("crm_schedule_task", { p_prospect: p.id, p_due: v }); if (error) return crmError(error); onDone(`Follow-up scheduled for ${fmtDate(v)}.`); }} />;
    case "snooze":
      return <PromptModal title={`Snooze ${p.creator_name}`} label="Show again on" input="date" initial={addDays(todaySydney(), 7)} onClose={onClose}
        onSubmit={async (v) => {
          const { error } = taskId ? await db().rpc("crm_task_action", { p_task: taskId, p_action: "snooze", p_until: v }) : await db().rpc("crm_snooze_prospect", { p_prospect: p.id, p_until: v });
          if (error) return crmError(error);
          onDone(`Snoozed until ${fmtDate(v)}.`);
        }} />;
    case "dnc":
      return <PromptModal title={`Do not contact ${p.creator_name}?`} label="Reason (kept with the record)" cta="Mark do-not-contact" onClose={onClose}
        hint="They're removed from every queue and can't be messaged. Only an admin can undo this. A fingerprint of their profiles is kept so they stay excluded if they appear in a later research file."
        onSubmit={async (v) => { const { error } = await db().rpc("crm_set_dnc", { p_prospect: p.id, p_reason: v }); if (error) return crmError(error); onDone(`${p.creator_name} marked do-not-contact.`); }} />;
    case "stage":
      return <StageDialog ids={[p.id]} name={p.creator_name} stages={stages ?? []} current={p.stage} onClose={onClose} onDone={onDone} />;
  }
}

export function StageDialog({ ids, name, stages, current, onClose, onDone }: { ids: string[]; name: string; stages: Stage[]; current?: string; onClose: () => void; onDone: (m: string) => void }) {
  const [stage, setStage] = useState(current ?? "");
  const [reason, setReason] = useState("");
  const [err, setErr] = useState<string>();
  const st = stages.find((s) => s.key === stage);
  async function go() {
    const { data, error } = await db().rpc("crm_set_stage", { p_ids: ids, p_stage: stage, p_reason: reason || null });
    if (error) return setErr(crmError(error));
    const r = data as { moved: number; skipped: Array<{ name: string; reason: string }> };
    onDone(`${r.moved} moved to ${st?.label}.${r.skipped.length ? ` ${r.skipped.length} skipped (do-not-contact).` : ""}`);
  }
  return (
    <Modal title={`Change stage — ${name}`} onClose={onClose}>
      <div className="space-y-3 text-sm">
        <select className={inputCls} value={stage} onChange={(e) => setStage(e.target.value)} aria-label="Stage">
          <option value="" disabled>Choose a stage…</option>
          <optgroup label="Pipeline">{stages.filter((s) => s.kind === "stage" && s.active).map((s) => <option key={s.key} value={s.key}>{s.label}{s.system_event ? " (set by the system)" : ""}</option>)}</optgroup>
          <optgroup label="Outcomes">{stages.filter((s) => s.kind === "outcome" && s.active).map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}</optgroup>
        </select>
        {st?.system_event && <Notice tone="warn">“{st.label}” is normally set automatically when it really happens (for example, when the agreement is accepted in the creator portal). Only an admin can set it by hand, with a reason that’s kept in the audit log.</Notice>}
        {(st?.system_event || st?.kind === "outcome") && (
          <input className={inputCls} placeholder={st?.kind === "outcome" ? "Reason (optional, helps analytics)" : "Reason for the override (required)"} value={reason} onChange={(e) => setReason(e.target.value)} />
        )}
        {st?.key === "do_not_contact" && <p className="text-xs text-ink/55">This also adds them to the do-not-contact list.</p>}
        {err && <Notice tone="error">{err}</Notice>}
        <div className="flex gap-2"><Btn tone="primary" disabled={!stage || (st?.system_event && !reason.trim())} onClick={go}>Move</Btn><Btn onClick={onClose}>Cancel</Btn></div>
      </div>
    </Modal>
  );
}

export function QuickActions({ p, onAction, compact, extra }: { p: Card; onAction: (a: QuickAction) => void; compact?: boolean; extra?: React.ReactNode }) {
  const links = profileLinks(p);
  const main = channelUrl(p, p.channel) ?? links[0]?.url;
  const site = p.website_url && /^https?:/i.test(p.website_url) ? p.website_url : null;
  const prepared = p.personalised_initial_dm ?? p.personalised_initial_email;
  const [copied, setCopied] = useState<string>();
  const sm = "rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-ink/15 hover:bg-ink/5";
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <button className="rounded-full bg-coral px-3 py-1 text-xs font-semibold text-white hover:bg-gum-hover" onClick={() => onAction("compose")} title="Review a message, copy it, then confirm you sent it (c)">Contact…</button>
      {main && <a href={main} target="_blank" rel="noopener noreferrer nofollow" className={sm} title="Opens in a new tab. Doesn't log anything.">Open profile ↗</a>}
      {site && !compact && <a href={site} target="_blank" rel="noopener noreferrer nofollow" className={sm}>Website ↗</a>}
      {prepared && !compact && (
        <button className={sm} onClick={async () => setCopied((await copyText(prepared)) ? "Copied" : "Copy failed")}>{copied ?? "Copy prepared message"}</button>
      )}
      {p.public_business_email && !compact && <button className={sm} onClick={async () => setCopied((await copyText(p.public_business_email!)) ? "Email copied" : "Copy failed")}>Copy email</button>}
      <button className={sm} onClick={() => onAction("reply")}>Record reply</button>
      <button className={sm} onClick={() => onAction("followup")}>Follow-up…</button>
      <button className={sm} onClick={() => onAction("note")}>Note</button>
      <button className={sm} onClick={() => onAction("stage")}>Stage…</button>
      <button className={sm} onClick={() => onAction("snooze")}>Snooze</button>
      <button className={`${sm} text-[#b8361a]`} onClick={() => onAction("dnc")}>Do not contact</button>
      {extra}
    </div>
  );
}

export function Bar({ value, max, tone = "ink" }: { value: number; max: number; tone?: "ink" | "coral" | "mint" | "sky" }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  const c = { ink: "bg-ink", coral: "bg-coral", mint: "bg-mint", sky: "bg-sky" }[tone];
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-ink/10" role="progressbar" aria-valuenow={value} aria-valuemax={max}>
      <div className={`h-full rounded-full ${c}`} style={{ width: `${pct}%` }} />
    </div>
  );
}
