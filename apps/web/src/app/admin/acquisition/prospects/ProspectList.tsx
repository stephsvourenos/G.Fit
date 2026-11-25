"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { PROSPECT_FIELDS, allocationCategory, importTemplateCsv, parseField, prospectKeys, toCsv } from "@app/domain/crm";
import { Table } from "@/components/AdminShell";
import { useStaffSession } from "@/lib/staff";
import { CHANNEL_LABEL, crmError, db, download, fmtCount, fmtDate, loadSettings, loadStaff, loadStages, todaySydney, useLoad, type Card, type Stage } from "@/lib/crm";
import { Btn, LinkChips, Modal, Notice, ScoreBadge, StageBadge, StageDialog, inputCls } from "../_ui";

const PAGE = 50;
const LIST_COLS =
  "id, ref, creator_name, business_name, country, primary_category, allocation_category, primary_platform, estimated_combined_followers, instagram_followers, tiktok_followers, youtube_subscribers, fit_score, fit_tier, confidence_level, stage, last_contact_at, assigned_to, do_not_contact, tags, instagram_url, tiktok_url, youtube_url, facebook_url, linkedin_url, website_url, contact_form_url, created_at, import_batch_id";

interface Filters {
  q: string;
  stage: string;
  category: string;
  country: string;
  tier: string;
  confidence: string;
  assigned: string;
  tag: string;
  batch: string;
  dnc: "hide" | "only" | "all";
  filter: string;
  sort: string;
}
const EMPTY: Filters = { q: "", stage: "", category: "", country: "", tier: "", confidence: "", assigned: "", tag: "", batch: "", dnc: "hide", filter: "", sort: "score" };

type Row = Card & { tags: string[]; created_at: string; estimated_combined_followers: number | null; instagram_followers: number | null; tiktok_followers: number | null; youtube_subscribers: number | null };

/* eslint-disable @typescript-eslint/no-explicit-any */
function applyFilters(q: any, f: Filters, today: string) {
  if (f.q.trim()) {
    const s = f.q.trim().replace(/[%,()]/g, " ");
    q = q.or(`creator_name.ilike.%${s}%,business_name.ilike.%${s}%,public_business_email.ilike.%${s}%,key_instagram.ilike.%${s.replace(/^@/, "")}%`);
  }
  if (f.stage) q = q.eq("stage", f.stage);
  if (f.category) q = f.category === "__none" ? q.is("allocation_category", null) : q.eq("allocation_category", f.category);
  if (f.country) q = q.eq("country", f.country);
  if (f.tier) q = f.tier === "none" ? q.is("fit_tier", null) : q.eq("fit_tier", f.tier);
  if (f.confidence) q = f.confidence === "none" ? q.is("confidence_level", null) : q.eq("confidence_level", f.confidence);
  if (f.assigned) q = f.assigned === "none" ? q.is("assigned_to", null) : q.eq("assigned_to", f.assigned);
  if (f.tag) q = q.contains("tags", [f.tag]);
  if (f.batch) q = q.eq("import_batch_id", f.batch);
  if (f.dnc === "hide") q = q.eq("do_not_contact", false);
  if (f.dnc === "only") q = q.eq("do_not_contact", true);
  if (f.filter === "incomplete") q = q.in("stage", ["identified", "qualified", "ready_for_outreach"]).or("allocation_category.is.null,fit_score.is.null");
  if (f.filter === "never_contacted") q = q.eq("outbound_count", 0);
  if (f.filter === "snoozed") q = q.gt("snoozed_until", today);
  const order: Record<string, [string, boolean]> = {
    score: ["fit_score", false], confidence: ["confidence_rank", false], newest: ["created_at", false], oldest: ["created_at", true],
    contacted: ["last_contact_at", false], name: ["creator_name", true], followers: ["estimated_combined_followers", false],
  };
  const [col, asc] = order[f.sort] ?? order.score!;
  return q.order(col, { ascending: asc, nullsFirst: false }).order("ref", { ascending: true });
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export function ProspectList() {
  const sp = useSearchParams();
  const router = useRouter();
  const staff = useStaffSession();
  const isAdmin = staff.roles.includes("admin");
  const [f, setF] = useState<Filters>(() => ({ ...EMPTY, ...Object.fromEntries([...sp.entries()].filter(([k]) => k in EMPTY)) }));
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [note, setNote] = useState<{ tone: "ok" | "error"; text: string }>();
  const [bulk, setBulk] = useState<null | "stage" | "assign" | "tag" | "untag">(null);
  const [adding, setAdding] = useState(false);
  const today = todaySydney();
  const stages = useLoad<Stage[]>(() => loadStages());
  const staffList = useLoad(() => loadStaff());
  const settings = useLoad(() => loadSettings());
  const batches = useLoad(async () => {
    const { data, error } = await db().from("crm_import_batches").select("id, file_name, created_at").order("created_at", { ascending: false }).limit(50);
    if (error) throw error;
    return data as Array<{ id: string; file_name: string; created_at: string }>;
  });
  const countries = useLoad(async () => {
    const { data } = await db().from("crm_prospects").select("country").not("country", "is", null).limit(5000);
    return [...new Set((data ?? []).map((r: { country: string }) => r.country))].sort();
  });

  const key = JSON.stringify(f);
  const list = useLoad<{ rows: Row[]; count: number }>(async () => {
    const q = applyFilters(db().from("crm_prospects").select(LIST_COLS, { count: "exact" }), f, today).range(page * PAGE, page * PAGE + PAGE - 1);
    const { data, error, count } = await q;
    if (error) throw error;
    return { rows: (data ?? []) as Row[], count: count ?? 0 };
  }, [key, page]);

  /** Changing a filter starts again from page 1, clears the selection and keeps the address shareable. */
  function setFilters(next: Filters) {
    setF(next);
    setPage(0);
    setSelected(new Set());
    const params = new URLSearchParams(Object.entries(next).filter(([k, v]) => v && v !== EMPTY[k as keyof Filters]) as Array<[string, string]>);
    router.replace(`/admin/acquisition/prospects/${params.size ? `?${params}` : ""}`, { scroll: false });
  }
  const set = (k: keyof Filters) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setFilters({ ...f, [k]: e.target.value });
  const rows = list.data?.rows ?? [];
  const staffEmail = useMemo(() => Object.fromEntries((staffList.data ?? []).map((s) => [s.user_id, s.email])), [staffList.data]);
  const allTags = useMemo(() => [...new Set(rows.flatMap((r) => r.tags))].sort(), [rows]);
  const allOnPage = rows.length > 0 && rows.every((r) => selected.has(r.id));

  async function exportCsv(ids: string[]) {
    if (!ids.length) return;
    const out: Record<string, unknown>[] = [];
    for (let i = 0; i < ids.length; i += 500) {
      const { data, error } = await db().rpc("crm_export_prospects", { p_ids: ids.slice(i, i + 500) });
      if (error) return setNote({ tone: "error", text: crmError(error) });
      out.push(...(data as Record<string, unknown>[]));
    }
    const extra = ["ref", "stage", "fit_score", "fit_tier", "allocation_category", "do_not_contact", "outreach_permission_status", "last_contact_at", "created_at"];
    const head = [...extra, ...PROSPECT_FIELDS.map((x) => x.key).filter((k) => !["recruitment_status", "notes", "next_follow_up_date", "last_contact_date", "assigned_to"].includes(k))];
    const rowsOut = out.map((r) => ({ ...r, assigned_to: staffEmail[r.assigned_to as string] ?? "" }));
    download(`gfit-prospects-${today}.csv`, toCsv([...head, "assigned_to"], rowsOut));
    setNote({ tone: "ok", text: `Exported ${out.length} prospects. Keep the file somewhere private — it contains people's contact details.` });
  }

  async function exportFiltered() {
    const ids: string[] = [];
    for (let from = 0; from < 20000; from += 1000) {
      const { data, error } = await applyFilters(db().from("crm_prospects").select("id"), f, today).range(from, from + 999);
      if (error) return setNote({ tone: "error", text: crmError(error) });
      ids.push(...(data ?? []).map((r: { id: string }) => r.id));
      if ((data ?? []).length < 1000) break;
    }
    await exportCsv(ids);
  }

  async function bulkUpdate(args: Record<string, unknown>, msg: string) {
    const { data, error } = await db().rpc("crm_bulk_update", { p_ids: [...selected], ...args });
    setBulk(null);
    if (error) return setNote({ tone: "error", text: crmError(error) });
    setNote({ tone: "ok", text: `${data} ${msg}` });
    list.reload();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Link href="/admin/acquisition/import/" className="rounded-full bg-coral px-4 py-2 text-sm font-semibold text-white hover:bg-gum-hover">Import a research file</Link>
        <Btn onClick={() => setAdding(true)}>Add a prospect</Btn>
        <Btn onClick={() => download("gfit-prospect-import-template.csv", importTemplateCsv())}>Download blank template</Btn>
        {isAdmin && <Btn onClick={exportFiltered} disabled={!list.data?.count}>Export {list.data?.count ?? 0} matching (CSV)</Btn>}
      </div>

      <div className="grid gap-2 rounded-xl bg-white p-3 ring-1 ring-ink/5 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
        <input className={`${inputCls} sm:col-span-2`} placeholder="Search name, business, email or @handle" value={f.q} onChange={set("q")} aria-label="Search" />
        <select className={inputCls} value={f.stage} onChange={set("stage")} aria-label="Stage">
          <option value="">All stages</option>
          {(stages.data ?? []).map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
        </select>
        <select className={inputCls} value={f.category} onChange={set("category")} aria-label="Category">
          <option value="">All categories</option>
          {(settings.data?.categories ?? []).map((c) => <option key={c.name}>{c.name}</option>)}
          <option value="__none">No founding category</option>
        </select>
        <select className={inputCls} value={f.tier} onChange={set("tier")} aria-label="Tier">
          <option value="">Any tier</option>{["A", "B", "C", "D"].map((t) => <option key={t} value={t}>Tier {t}</option>)}<option value="none">No score</option>
        </select>
        <select className={inputCls} value={f.confidence} onChange={set("confidence")} aria-label="Confidence">
          <option value="">Any confidence</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option><option value="none">Unknown</option>
        </select>
        <select className={inputCls} value={f.country} onChange={set("country")} aria-label="Country">
          <option value="">All countries</option>{(countries.data ?? []).map((c) => <option key={c}>{c}</option>)}
        </select>
        <select className={inputCls} value={f.assigned} onChange={set("assigned")} aria-label="Assigned to">
          <option value="">Anyone</option><option value="none">Unassigned</option>
          {(staffList.data ?? []).map((s) => <option key={s.user_id} value={s.user_id}>{s.email}</option>)}
        </select>
        <select className={inputCls} value={f.batch} onChange={set("batch")} aria-label="Import batch">
          <option value="">All imports</option>{(batches.data ?? []).map((b) => <option key={b.id} value={b.id}>{b.file_name} · {fmtDate(b.created_at)}</option>)}
        </select>
        <input className={inputCls} placeholder="Tag" value={f.tag} onChange={set("tag")} list="crm-tags" aria-label="Tag" />
        <datalist id="crm-tags">{allTags.map((t) => <option key={t} value={t} />)}</datalist>
        <select className={inputCls} value={f.filter} onChange={set("filter")} aria-label="Quick filter">
          <option value="">No quick filter</option><option value="incomplete">Research incomplete</option><option value="never_contacted">Never contacted</option><option value="snoozed">Snoozed</option>
        </select>
        <select className={inputCls} value={f.dnc} onChange={set("dnc")} aria-label="Do-not-contact">
          <option value="hide">Hide do-not-contact</option><option value="all">Include do-not-contact</option><option value="only">Only do-not-contact</option>
        </select>
        <select className={inputCls} value={f.sort} onChange={set("sort")} aria-label="Sort">
          <option value="score">Sort: fit score</option><option value="confidence">Sort: confidence</option><option value="followers">Sort: audience</option>
          <option value="newest">Sort: newest</option><option value="oldest">Sort: oldest</option><option value="contacted">Sort: last contact</option><option value="name">Sort: name</option>
        </select>
        <Btn onClick={() => setFilters(EMPTY)}>Clear filters</Btn>
      </div>

      {note && <Notice tone={note.tone} onClose={() => setNote(undefined)}>{note.text}</Notice>}
      {list.error && <Notice tone="error">{list.error}</Notice>}

      {selected.size > 0 && (
        <div className="sticky top-2 z-10 flex flex-wrap items-center gap-2 rounded-xl bg-ink px-4 py-2 text-sm text-paper">
          <b>{selected.size} selected</b>
          <button className="rounded-full bg-paper/15 px-3 py-1" onClick={() => setBulk("stage")}>Change stage</button>
          <button className="rounded-full bg-paper/15 px-3 py-1" onClick={() => setBulk("assign")}>Assign</button>
          <button className="rounded-full bg-paper/15 px-3 py-1" onClick={() => setBulk("tag")}>Add tag</button>
          <button className="rounded-full bg-paper/15 px-3 py-1" onClick={() => setBulk("untag")}>Remove tag</button>
          {isAdmin && <button className="rounded-full bg-paper/15 px-3 py-1" onClick={() => exportCsv([...selected])}>Export selected</button>}
          <button className="ml-auto text-paper/70 underline" onClick={() => setSelected(new Set())}>Clear</button>
          <span className="w-full text-xs text-paper/60">Bulk changes never move do-not-contact creators forward, and never send anything.</span>
        </div>
      )}

      <div className="flex items-center justify-between text-sm text-ink/60">
        <span>{list.loading ? "Loading…" : `${(list.data?.count ?? 0).toLocaleString("en-AU")} prospects`}</span>
        <Pager page={page} count={list.data?.count ?? 0} onPage={setPage} />
      </div>
      <Table head={["", "Creator", "Score", "Stage", "Category · country", "Audience", "Last contact", "Assigned", "Links"]}>
        <tr className="bg-page/50">
          <td className="px-3 py-2"><input type="checkbox" aria-label="Select all on this page" checked={allOnPage} onChange={(e) => setSelected((s) => { const n = new Set(s); rows.forEach((r) => (e.target.checked ? n.add(r.id) : n.delete(r.id))); return n; })} /></td>
          <td colSpan={8} className="px-3 py-2 text-xs text-ink/50">Select all on this page</td>
        </tr>
        {rows.map((r) => {
          const followers = r.estimated_combined_followers ?? ((r.instagram_followers ?? 0) + (r.tiktok_followers ?? 0) + (r.youtube_subscribers ?? 0) || null);
          return (
            <tr key={r.id} className={r.do_not_contact ? "opacity-60" : ""}>
              <td className="px-3 py-2.5"><input type="checkbox" aria-label={`Select ${r.creator_name}`} checked={selected.has(r.id)} onChange={(e) => setSelected((s) => { const n = new Set(s); if (e.target.checked) n.add(r.id); else n.delete(r.id); return n; })} /></td>
              <td className="px-3 py-2.5">
                <Link href={`/admin/acquisition/prospect/?id=${r.id}`} className="font-semibold hover:underline">{r.creator_name}</Link>
                {r.business_name && r.business_name !== r.creator_name && <div className="text-xs text-ink/50">{r.business_name}</div>}
                {r.tags.length > 0 && <div className="mt-0.5 flex flex-wrap gap-1">{r.tags.map((t) => <span key={t} className="rounded bg-ink/5 px-1.5 text-[11px] text-ink/60">{t}</span>)}</div>}
              </td>
              <td className="px-3 py-2.5"><ScoreBadge score={r.fit_score} tier={r.fit_tier} confidence={r.confidence_level} /></td>
              <td className="px-3 py-2.5"><StageBadge stage={r.stage} stages={stages.data} /></td>
              <td className="px-3 py-2.5 text-xs">{r.allocation_category ?? r.primary_category ?? "—"}<div className="text-ink/50">{r.country ?? "country unknown"}</div></td>
              <td className="px-3 py-2.5 text-xs">{followers ? fmtCount(followers) : "unknown"}<div className="text-ink/50">{r.primary_platform ? CHANNEL_LABEL[r.primary_platform] : ""}</div></td>
              <td className="px-3 py-2.5 text-xs">{fmtDate(r.last_contact_at)}</td>
              <td className="px-3 py-2.5 text-xs">{r.assigned_to ? staffEmail[r.assigned_to] ?? "staff" : "—"}</td>
              <td className="px-3 py-2.5"><LinkChips p={r} /></td>
            </tr>
          );
        })}
        {!list.loading && rows.length === 0 && <tr><td colSpan={9} className="px-4 py-6 text-center text-ink/55">No prospects match.</td></tr>}
      </Table>
      <div className="flex justify-end"><Pager page={page} count={list.data?.count ?? 0} onPage={setPage} /></div>

      {bulk === "stage" && <StageDialog ids={[...selected]} name={`${selected.size} prospects`} stages={stages.data ?? []} onClose={() => setBulk(null)} onDone={(m) => { setBulk(null); setNote({ tone: "ok", text: m }); list.reload(); }} />}
      {bulk === "assign" && (
        <Modal title={`Assign ${selected.size} prospects`} onClose={() => setBulk(null)}>
          <div className="space-y-2">
            {(staffList.data ?? []).map((s) => <Btn key={s.user_id} className="mr-2" onClick={() => bulkUpdate({ p_assign: s.user_id }, `assigned to ${s.email}.`)}>{s.email}</Btn>)}
            <Btn onClick={() => bulkUpdate({ p_unassign: true }, "unassigned.")}>Unassign</Btn>
          </div>
        </Modal>
      )}
      {(bulk === "tag" || bulk === "untag") && <TagDialog remove={bulk === "untag"} onClose={() => setBulk(null)} onSave={(t) => bulkUpdate(bulk === "tag" ? { p_add_tags: [t] } : { p_remove_tags: [t] }, bulk === "tag" ? `tagged “${t}”.` : `had “${t}” removed.`)} />}
      {adding && <AddProspect onClose={() => setAdding(false)} onDone={(id) => router.push(`/admin/acquisition/prospect/?id=${id}`)} />}
    </div>
  );
}

function Pager({ page, count, onPage }: { page: number; count: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(count / PAGE));
  return (
    <span className="flex items-center gap-2 text-sm">
      <Btn disabled={page === 0} onClick={() => onPage(page - 1)}>← Previous</Btn>
      <span className="tabular-nums text-ink/60">Page {page + 1} of {pages}</span>
      <Btn disabled={page + 1 >= pages} onClick={() => onPage(page + 1)}>Next →</Btn>
    </span>
  );
}

function TagDialog({ remove, onClose, onSave }: { remove: boolean; onClose: () => void; onSave: (t: string) => void }) {
  const [t, setT] = useState("");
  return (
    <Modal title={remove ? "Remove a tag" : "Add a tag"} onClose={onClose}>
      <input className={inputCls} value={t} onChange={(e) => setT(e.target.value.slice(0, 40))} placeholder="e.g. expo-2026, reformer" onKeyDown={(e) => e.key === "Enter" && t.trim() && onSave(t.trim())} />
      <div className="mt-3 flex gap-2"><Btn tone="primary" disabled={!t.trim()} onClick={() => onSave(t.trim())}>{remove ? "Remove" : "Add"}</Btn><Btn onClick={onClose}>Cancel</Btn></div>
    </Modal>
  );
}

/** Adding one prospect by hand (e.g. someone you met). Checks for an existing record with the same profile first. */
function AddProspect({ onClose, onDone }: { onClose: () => void; onDone: (id: string) => void }) {
  const [v, setV] = useState({ creator_name: "", country: "", primary_category: "", instagram_url: "", tiktok_url: "", public_business_email: "", website_url: "", source: "Added by hand" });
  const [err, setErr] = useState<string>();
  const [dupe, setDupe] = useState<{ id: string; creator_name: string } | null>(null);
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement>) => setV((x) => ({ ...x, [k]: e.target.value }));

  async function save(force = false) {
    setErr(undefined);
    const data: Record<string, unknown> = {};
    for (const k of ["creator_name", "country", "primary_category", "instagram_url", "tiktok_url", "public_business_email", "website_url"] as const) {
      if (!v[k].trim()) continue;
      const r = parseField(PROSPECT_FIELDS.find((x) => x.key === k)!, v[k]);
      if (r.error) return setErr(r.error);
      data[k] = r.value;
    }
    if (!data.creator_name) return setErr("Add the creator's name.");
    const keys = prospectKeys(data);
    if (!force) {
      const q = (s: string) => `"${s.replace(/"/g, "")}"`;
      const ors = [keys.instagram && `key_instagram.eq.${q(keys.instagram)}`, keys.tiktok && `key_tiktok.eq.${q(keys.tiktok)}`, keys.email && `key_email.eq.${q(keys.email)}`, keys.name && `key_name.eq.${q(keys.name)}`].filter(Boolean);
      if (ors.length) {
        const { data: hit } = await db().from("crm_prospects").select("id, creator_name").or(ors.join(",")).limit(1);
        if (hit?.[0]) return setDupe(hit[0]);
      }
    }
    const { data: id, error } = await db().from("crm_prospects").insert({
      ...data, allocation_category: allocationCategory(data.primary_category as string | null), original_recruitment_source: v.source || "Added by hand",
      key_instagram: keys.instagram, key_tiktok: keys.tiktok, key_youtube: keys.youtube, key_email: keys.email, key_website: keys.website, key_name: keys.name,
    }).select("id").single();
    if (error) return setErr(crmError(error));
    onDone((id as { id: string }).id);
  }
  return (
    <Modal title="Add a prospect" onClose={onClose}>
      <div className="grid gap-2 text-sm">
        <input className={inputCls} placeholder="Creator name *" value={v.creator_name} onChange={set("creator_name")} />
        <div className="grid grid-cols-2 gap-2">
          <input className={inputCls} placeholder="Country" value={v.country} onChange={set("country")} />
          <input className={inputCls} placeholder="Category (e.g. Reformer Pilates)" value={v.primary_category} onChange={set("primary_category")} />
        </div>
        <input className={inputCls} placeholder="Instagram link or @handle" value={v.instagram_url} onChange={set("instagram_url")} />
        <input className={inputCls} placeholder="TikTok link or @handle" value={v.tiktok_url} onChange={set("tiktok_url")} />
        <input className={inputCls} placeholder="Public business email" value={v.public_business_email} onChange={set("public_business_email")} />
        <input className={inputCls} placeholder="Website" value={v.website_url} onChange={set("website_url")} />
        <input className={inputCls} placeholder="How you found them" value={v.source} onChange={set("source")} />
        {dupe && <Notice tone="warn">This looks like <Link className="font-semibold underline" href={`/admin/acquisition/prospect/?id=${dupe.id}`}>{dupe.creator_name}</Link>, who’s already in the CRM. <button className="underline" onClick={() => save(true)}>Add anyway (different person)</button></Notice>}
        {err && <Notice tone="error">{err}</Notice>}
        <div className="flex gap-2"><Btn tone="primary" onClick={() => save()}>Add prospect</Btn><Btn onClick={onClose}>Cancel</Btn></div>
      </div>
    </Modal>
  );
}
