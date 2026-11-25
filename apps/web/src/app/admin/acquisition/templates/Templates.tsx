"use client";

import { useMemo, useRef, useState } from "react";
import { MERGE_FIELDS, hasMissingMarks, mergeValuesFor, renderTemplate } from "@app/domain/crm";
import { Badge } from "@/components/AdminShell";
import { PURPOSE_LABEL, crmError, db, fmtDate, loadSettings, loadTemplates, useLoad, type Template } from "@/lib/crm";
import { Btn, Modal, Notice, inputCls, refreshTemplateCache } from "../_ui";

const CHANNELS: Record<Template["channel"], string> = { dm: "Social DM", email: "Email", contact_form: "Contact form", linkedin: "LinkedIn" };
const BLANK: Omit<Template, "id" | "current_version"> = { name: "", channel: "dm", purpose: "initial", categories: [], creator_types: [], stage: null, objection: null, follow_up_number: null, partnership_type: null, commercial: true, active: true, subject: "", body: "" };

// A clearly fictional sample for previews when no prospect is chosen.
const SAMPLE = {
  creator_name: "FICTIONAL Jess Example", business_name: "Example Pilates Studio (fictional)", primary_category: "Reformer Pilates",
  specific_personalisation_detail: "your 20-minute reformer series is so clear for beginners", recommended_pitch_angle: "Your library could reach families at home without you building an app.",
};

export function Templates() {
  const list = useLoad(() => loadTemplates());
  const settings = useLoad(() => loadSettings());
  const [edit, setEdit] = useState<(Partial<Template> & typeof BLANK) | null>(null);
  const [history, setHistory] = useState<Template | null>(null);
  const [filter, setFilter] = useState({ purpose: "", channel: "", category: "", showInactive: false });
  const [note, setNote] = useState<string>();

  const shown = useMemo(() => (list.data ?? []).filter((t) =>
    (!filter.purpose || t.purpose === filter.purpose) && (!filter.channel || t.channel === filter.channel) &&
    (!filter.category || t.categories.includes(filter.category)) && (filter.showInactive || t.active)), [list.data, filter]);

  return (
    <div className="space-y-4">
      {note && <Notice tone="ok" onClose={() => setNote(undefined)}>{note}</Notice>}
      {list.error && <Notice tone="error">{list.error}</Notice>}
      {settings.data && !settings.data.founder_name && <Notice tone="warn">Add the founder’s name in <a className="underline" href="/admin/acquisition/settings/">Settings</a> — most templates sign off with it, and messages can’t be copied while it’s missing.</Notice>}
      <div className="flex flex-wrap items-center gap-2">
        <Btn tone="primary" onClick={() => setEdit({ ...BLANK })}>New template</Btn>
        <select className={`${inputCls} w-auto`} value={filter.purpose} onChange={(e) => setFilter((f) => ({ ...f, purpose: e.target.value }))} aria-label="Purpose"><option value="">All purposes</option>{Object.entries(PURPOSE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        <select className={`${inputCls} w-auto`} value={filter.channel} onChange={(e) => setFilter((f) => ({ ...f, channel: e.target.value }))} aria-label="Channel"><option value="">All channels</option>{Object.entries(CHANNELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        <select className={`${inputCls} w-auto`} value={filter.category} onChange={(e) => setFilter((f) => ({ ...f, category: e.target.value }))} aria-label="Category"><option value="">Any category</option>{(settings.data?.categories ?? []).map((c) => <option key={c.name}>{c.name}</option>)}</select>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={filter.showInactive} onChange={(e) => setFilter((f) => ({ ...f, showInactive: e.target.checked }))} /> Show switched-off templates</label>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {shown.map((t) => (
          <article key={t.id} className="flex flex-col rounded-xl bg-white p-4 ring-1 ring-ink/5">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-semibold">{t.name}</h3>
              <span className="text-xs text-ink/45">v{t.current_version}</span>
            </div>
            <div className="mt-1 flex flex-wrap gap-1.5">
              <Badge>{CHANNELS[t.channel]}</Badge><Badge tone="blue">{PURPOSE_LABEL[t.purpose]}</Badge>
              {t.follow_up_number && <Badge>Follow-up {t.follow_up_number}</Badge>}
              {t.categories.map((c) => <Badge key={c} tone="green">{c}</Badge>)}
              {t.creator_types.map((c) => <Badge key={c}>{c}</Badge>)}
              {!t.commercial && <Badge tone="amber">Operational</Badge>}
              {!t.active && <Badge tone="red">Off</Badge>}
            </div>
            <p className="mt-2 line-clamp-4 whitespace-pre-line text-sm text-ink/70">{t.body}</p>
            <div className="mt-auto flex gap-2 pt-3">
              <Btn onClick={() => setEdit({ ...t })}>Edit</Btn>
              <Btn onClick={() => setHistory(t)}>Versions</Btn>
            </div>
          </article>
        ))}
      </div>
      {edit && <Editor t={edit} settings={settings.data} onClose={() => setEdit(null)} onSaved={(m) => { setEdit(null); setNote(m); refreshTemplateCache(); list.reload(); }} />}
      {history && <History t={history} onClose={() => setHistory(null)} />}
    </div>
  );
}

function Editor({ t, settings, onClose, onSaved }: { t: Partial<Template> & typeof BLANK; settings?: Awaited<ReturnType<typeof loadSettings>>; onClose: () => void; onSaved: (m: string) => void }) {
  const [v, setV] = useState(t);
  const [err, setErr] = useState<string>();
  const body = useRef<HTMLTextAreaElement>(null);
  const set = <K extends keyof typeof v>(k: K, val: (typeof v)[K]) => setV((x) => ({ ...x, [k]: val }));
  const values = mergeValuesFor(SAMPLE, { founder_name: settings?.founder_name, launch_date: String(settings?.targets.launch_date ?? ""), application_url: settings?.application_url });
  const preview = renderTemplate(v.body, values);
  const subj = v.subject ? renderTemplate(v.subject, values) : null;

  function insert(key: string) {
    const el = body.current;
    const token = `{{${key}}}`;
    if (!el) return set("body", v.body + token);
    const s = el.selectionStart, e = el.selectionEnd;
    set("body", v.body.slice(0, s) + token + v.body.slice(e));
    setTimeout(() => { el.focus(); el.selectionStart = el.selectionEnd = s + token.length; });
  }

  async function save() {
    if (!v.name.trim() || !v.body.trim()) return setErr("Give the template a name and a message.");
    const meta = { name: v.name.trim(), channel: v.channel, purpose: v.purpose, categories: v.categories, creator_types: v.creator_types, stage: v.stage, objection: v.objection || null,
      follow_up_number: v.follow_up_number || null, partnership_type: v.partnership_type || null, commercial: v.commercial, active: v.active };
    const { error } = await db().rpc("crm_save_template", { p_id: t.id ?? null, p_meta: meta, p_subject: v.channel === "email" ? v.subject ?? "" : "", p_body: v.body });
    if (error) return setErr(crmError(error));
    onSaved(t.id ? `Saved as version ${(t.current_version ?? 0) + 1}.` : "Template created.");
  }

  return (
    <Modal title={t.id ? `Edit “${t.name}”` : "New template"} onClose={onClose} wide>
      <div className="grid gap-3 text-sm md:grid-cols-2">
        <label className="md:col-span-2"><span className="mb-1 block text-xs font-semibold text-ink/60">Name</span><input className={inputCls} value={v.name} onChange={(e) => set("name", e.target.value)} /></label>
        <label><span className="mb-1 block text-xs font-semibold text-ink/60">Channel</span><select className={inputCls} value={v.channel} onChange={(e) => set("channel", e.target.value as Template["channel"])}>{Object.entries(CHANNELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
        <label><span className="mb-1 block text-xs font-semibold text-ink/60">Purpose</span><select className={inputCls} value={v.purpose} onChange={(e) => set("purpose", e.target.value)}>{Object.entries(PURPOSE_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
        <label><span className="mb-1 block text-xs font-semibold text-ink/60">Fitness categories (comma-separated)</span><input className={inputCls} value={v.categories.join(", ")} onChange={(e) => set("categories", e.target.value.split(",").map((x) => x.trim()).filter(Boolean))} list="tpl-cats" /></label>
        <datalist id="tpl-cats">{(settings?.categories ?? []).map((c) => <option key={c.name} value={c.name} />)}</datalist>
        <label><span className="mb-1 block text-xs font-semibold text-ink/60">Creator types (comma-separated)</span><input className={inputCls} value={v.creator_types.join(", ")} onChange={(e) => set("creator_types", e.target.value.split(",").map((x) => x.trim()).filter(Boolean))} /></label>
        <label><span className="mb-1 block text-xs font-semibold text-ink/60">Follow-up number</span><input type="number" min={1} max={5} className={inputCls} value={v.follow_up_number ?? ""} onChange={(e) => set("follow_up_number", e.target.value ? Number(e.target.value) : null)} /></label>
        <label><span className="mb-1 block text-xs font-semibold text-ink/60">Objection it answers</span><input className={inputCls} value={v.objection ?? ""} onChange={(e) => set("objection", e.target.value)} /></label>
        <label><span className="mb-1 block text-xs font-semibold text-ink/60">Partnership type</span><input className={inputCls} value={v.partnership_type ?? ""} onChange={(e) => set("partnership_type", e.target.value)} /></label>
        <div className="flex items-end gap-4">
          <label className="flex items-center gap-2"><input type="checkbox" checked={v.commercial} onChange={(e) => set("commercial", e.target.checked)} /> Recruitment (commercial) message</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={v.active} onChange={(e) => set("active", e.target.checked)} /> In use</label>
        </div>
        {v.channel === "email" && <label className="md:col-span-2"><span className="mb-1 block text-xs font-semibold text-ink/60">Subject</span><input className={inputCls} value={v.subject ?? ""} onChange={(e) => set("subject", e.target.value)} /></label>}
        <label className="md:col-span-2"><span className="mb-1 block text-xs font-semibold text-ink/60">Message</span><textarea ref={body} className={`${inputCls} min-h-48`} value={v.body} onChange={(e) => set("body", e.target.value)} /></label>
        <div className="md:col-span-2">
          <p className="text-xs text-ink/55">Insert a merge field. Add a fallback after a bar, e.g. <code>{"{{creator_first_name|there}}"}</code>. Without a fallback, a missing fact must be filled in by hand before the message can be used.</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">{MERGE_FIELDS.map((m) => <button key={m.key} type="button" onClick={() => insert(m.key)} className="rounded-full bg-ink/5 px-2 py-0.5 text-xs hover:bg-ink/10" title={m.label}>{m.key}</button>)}</div>
        </div>
        <div className="rounded-xl bg-white p-4 ring-1 ring-ink/5 md:col-span-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink/50">Preview with a fictional creator</p>
          {subj && <p className="mt-2 font-semibold">{subj.text}</p>}
          <p className="mt-2 whitespace-pre-line">{preview.text}</p>
          {(hasMissingMarks(preview.text) || preview.missing.length > 0) && <p className="mt-2 text-xs text-[#8a5a00]">Missing for this sample: {preview.missing.join(", ")}. With a real creator these would need filling in.</p>}
        </div>
        {err && <div className="md:col-span-2"><Notice tone="error">{err}</Notice></div>}
        <div className="flex gap-2 md:col-span-2"><Btn tone="primary" onClick={save}>{t.id ? "Save new version" : "Create template"}</Btn><Btn onClick={onClose}>Cancel</Btn></div>
      </div>
    </Modal>
  );
}

function History({ t, onClose }: { t: Template; onClose: () => void }) {
  const v = useLoad(async () => {
    const { data, error } = await db().from("crm_template_versions").select("*").eq("template_id", t.id).order("version", { ascending: false });
    if (error) throw error;
    return data as Array<{ version: number; subject: string | null; body: string; created_at: string }>;
  });
  return (
    <Modal title={`Versions of “${t.name}”`} onClose={onClose} wide>
      <ol className="space-y-3">
        {(v.data ?? []).map((x) => (
          <li key={x.version} className="rounded-xl bg-white p-3 text-sm ring-1 ring-ink/5">
            <div className="text-xs text-ink/55">Version {x.version} · {fmtDate(x.created_at, true)}</div>
            {x.subject && <div className="mt-1 font-semibold">{x.subject}</div>}
            <p className="mt-1 whitespace-pre-line">{x.body}</p>
          </li>
        ))}
      </ol>
    </Modal>
  );
}
