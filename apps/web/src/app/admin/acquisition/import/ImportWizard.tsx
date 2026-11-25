"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  MATCH_REASON_LABEL,
  PROSPECT_FIELDS,
  ProspectIndex,
  autoMapHeaders,
  errorReportRows,
  importTemplateCsv,
  parseCsv,
  planImport,
  readXlsx,
  summarisePlan,
  toCsv,
  toTable,
  type ImportOptions,
  type RowPlan,
  type Sheet,
} from "@app/domain/crm";
import { Table } from "@/components/AdminShell";
import { crmError, db, download, fmtDate, inflateRaw, loadStaff, loadStages, todaySydney, useLoad } from "@/lib/crm";
import { Bar, Btn, Notice, inputCls } from "../_ui";

const MAX_BYTES = 25 * 1024 * 1024;
const MAX_ROWS = 20_000;
const CHUNK = 500;

type Step = "upload" | "map" | "check" | "importing" | "done";
interface Origin { sheet: string; line: number }
type Decision = "skip" | "new" | `merge:${string}`;

export function ImportWizard() {
  const [step, setStep] = useState<Step>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [sheets, setSheets] = useState<Sheet[]>([]);
  const [chosen, setChosen] = useState<string[]>([]);
  const [error, setError] = useState<string>();
  const [headers, setHeaders] = useState<string[]>([]);
  const [records, setRecords] = useState<string[][]>([]);
  const [origins, setOrigins] = useState<Origin[]>([]);
  const [mapping, setMapping] = useState<Array<string | null>>([]);
  const [options, setOptions] = useState<ImportOptions>({ duplicates: "fill_blanks", possible: "review" });
  const [source, setSource] = useState("ChatGPT Work research");
  const [tag, setTag] = useState("");
  const [plan, setPlan] = useState<RowPlan[] | null>(null);
  const [names, setNames] = useState<Map<string, string>>(new Map());
  const [decisions, setDecisions] = useState<Record<number, Decision>>({});
  const [progress, setProgress] = useState(0);
  const [outcome, setOutcome] = useState<{ counts: Record<string, number>; byLine: Map<number, string>; batch: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const history = useLoad(async () => {
    const { data, error } = await db().from("crm_import_batches").select("*").order("created_at", { ascending: false }).limit(30);
    if (error) throw error;
    return data as Array<{ id: string; file_name: string; sheet_name: string | null; status: string; stats: Record<string, number>; created_at: string }>;
  });

  async function readFile(f: File) {
    setError(undefined);
    setFile(f);
    if (f.size > MAX_BYTES) return setError("That file is over 25 MB. Split it into smaller files.");
    try {
      const lower = f.name.toLowerCase();
      let s: Sheet[];
      if (lower.endsWith(".xlsx")) s = await readXlsx(new Uint8Array(await f.arrayBuffer()), inflateRaw);
      else if (lower.endsWith(".csv") || lower.endsWith(".txt")) {
        const text = new TextDecoder("utf-8", { fatal: false }).decode(await f.arrayBuffer());
        if (text.includes("�")) setError("Some characters couldn't be read — save the file as “CSV UTF-8” and try again if names look wrong.");
        s = [{ name: f.name, rows: parseCsv(text) }];
      } else if (lower.endsWith(".xls")) return setError("Old .xls files aren't supported. In Excel choose File → Save As → Excel Workbook (.xlsx) or CSV UTF-8.");
      else return setError("Choose a .csv or .xlsx file.");
      s = s.filter((x) => x.rows.length > 1);
      if (!s.length) return setError("The file has no rows below the header.");
      setSheets(s);
      setChosen(s.length === 1 ? [s[0]!.name] : []);
      if (s.length === 1) prepare(s, [s[0]!.name]);
    } catch (e) {
      setError(crmError(e));
    }
  }

  /** Combine the chosen worksheets by column name, so sheets with slightly different columns still line up. */
  function prepare(all: Sheet[], names: string[]) {
    const pick = all.filter((s) => names.includes(s.name));
    const unionHeaders: string[] = [];
    const tables = pick.map((s) => ({ s, t: toTable(s.rows) }));
    for (const { t } of tables) for (const h of t.headers) if (!unionHeaders.includes(h)) unionHeaders.push(h);
    const recs: string[][] = [];
    const orig: Origin[] = [];
    for (const { s, t } of tables) {
      t.records.forEach((r, i) => {
        recs.push(unionHeaders.map((h) => r[t.headers.indexOf(h)] ?? ""));
        orig.push({ sheet: s.name, line: i + 2 });
      });
    }
    if (recs.length > MAX_ROWS) return setError(`That's ${recs.length.toLocaleString()} rows. Import at most ${MAX_ROWS.toLocaleString()} at a time.`);
    setHeaders(unionHeaders);
    setRecords(recs);
    setOrigins(orig);
    setMapping(autoMapHeaders(unionHeaders));
    setStep("map");
  }

  async function check() {
    setBusy(true);
    setError(undefined);
    try {
      const [stages, staff] = await Promise.all([loadStages(), loadStaff()]);
      const index = new ProspectIndex();
      const nm = new Map<string, string>();
      for (let after = 0; ; ) {
        const { data, error } = await db().rpc("crm_match_index", { p_after: after });
        if (error) throw error;
        const rows = (data ?? []) as Array<{ ref: number; id: string; creator_name: string; key_instagram: string | null; key_tiktok: string | null; key_youtube: string | null; key_email: string | null; key_website: string | null; key_name: string | null }>;
        for (const r of rows) {
          index.add(r.id, { instagram: r.key_instagram, tiktok: r.key_tiktok, youtube: r.key_youtube, email: r.key_email, website: r.key_website, name: r.key_name });
          nm.set(r.id, r.creator_name);
        }
        if (rows.length < 5000) break;
        after = rows[rows.length - 1]!.ref;
      }
      const manual = stages.filter((s) => !s.system_event);
      const p = planImport({
        headers, records, mapping, existing: index, options,
        stages: manual.map((s) => ({ key: s.key, label: s.label })),
        staffByEmail: Object.fromEntries(staff.map((s) => [s.email.toLowerCase(), s.user_id])),
      });
      // stages that mean a real event happened can't be imported
      const system = new Map(stages.filter((s) => s.system_event).flatMap((s) => [[s.key, s.label], [s.label.toLowerCase(), s.label]]));
      p.forEach((r) => {
        r.warnings = r.warnings.map((w) => {
          const m = /Unknown recruitment stage “(.+)”/.exec(w);
          return m && system.has(m[1]!.toLowerCase()) ? `“${m[1]}” is set by real events, not imports — starts at Identified` : w;
        });
        const tags = r.data.tags as string[] | null | undefined;
        if (tag.trim()) r.data.tags = [...new Set([...(tags ?? []), tag.trim()])];
        if (!r.data.original_recruitment_source && source.trim()) r.data.original_recruitment_source = source.trim();
      });
      setNames(nm);
      setPlan(p);
      setDecisions(Object.fromEntries(p.map((r, i) => [i, r.action === "review" ? "skip" : null]).filter(([, v]) => v)) as Record<number, Decision>);
      setStep("check");
    } catch (e) {
      setError(crmError(e));
    } finally {
      setBusy(false);
    }
  }

  const summary = useMemo(() => (plan ? summarisePlan(plan) : null), [plan]);
  const reviewRows = useMemo(() => (plan ?? []).map((r, i) => ({ r, i })).filter(({ r }) => r.action === "review"), [plan]);

  async function commit() {
    if (!plan || !file) return;
    setBusy(true);
    setStep("importing");
    setProgress(0);
    const byLine = new Map<number, string>();
    const counts: Record<string, number> = { inserted: 0, updated: 0, unchanged: 0, skipped: 0, duplicates: 0, failed: 0, reviewed: 0 };
    try {
      const { data: b, error } = await db().from("crm_import_batches")
        .insert({ file_name: file.name.slice(0, 300), sheet_name: chosen.join(", ").slice(0, 200) || null, options: { ...options, source, tag } })
        .select("id").single();
      if (error) throw error;
      const batch = (b as { id: string }).id;
      const work: Array<{ line: number; action: string; target_id?: string; data: Record<string, unknown>; keys: unknown }> = [];
      plan.forEach((r, i) => {
        let action: string = r.action;
        let target = r.targetId;
        if (r.action === "review") {
          const d = decisions[i] ?? "skip";
          counts.reviewed!++;
          if (d === "skip") action = "skip";
          else if (d === "new") action = "insert";
          else { action = "fill_blanks"; target = d.slice(6); }
        }
        if (action === "skip") {
          byLine.set(i, r.reason ?? "Skipped");
          if (r.match.kind === "duplicate" || /Same creator|Already in|duplicate/i.test(r.reason ?? "")) counts.duplicates!++;
          else counts.skipped!++;
          return;
        }
        if (action === "failed") {
          byLine.set(i, `Failed: ${r.reason}`);
          counts.failed!++;
          return;
        }
        work.push({ line: i, action, target_id: target, data: r.data, keys: r.keys });
      });
      for (let c = 0; c < work.length; c += CHUNK) {
        const chunk = work.slice(c, c + CHUNK);
        const { data, error: e2 } = await db().rpc("crm_import_commit", { p_batch: batch, p_rows: chunk });
        if (e2) {
          chunk.forEach((w) => { byLine.set(w.line, `Failed: ${crmError(e2)}`); counts.failed!++; });
        } else {
          for (const res of data as Array<{ line: number; result: string; error?: string }>) {
            const k = res.result === "inserted" ? "inserted" : res.result === "updated" ? "updated" : res.result === "unchanged" ? "unchanged" : "failed";
            counts[k]!++;
            byLine.set(res.line, res.error ? `Failed: ${res.error}` : res.result);
          }
        }
        setProgress(Math.min(work.length, c + CHUNK) / Math.max(1, work.length));
      }
      await db().rpc("crm_import_finish", { p_batch: batch, p_stats: { ...counts, rows: plan.length } });
      setOutcome({ counts, byLine, batch });
      setStep("done");
      history.reload();
    } catch (e) {
      setError(crmError(e));
      setStep("check");
    } finally {
      setBusy(false);
    }
  }

  function errorReport() {
    if (!plan) return;
    const byLineNo = new Map<number, string>();
    outcome?.byLine.forEach((v, i) => byLineNo.set(plan[i]!.line, v));
    const rows = errorReportRows(plan, byLineNo).map((r) => {
      const i = plan.findIndex((x) => x.line === r.line);
      return { sheet: origins[i]?.sheet ?? "", ...r, line: origins[i]?.line ?? r.line };
    });
    download(`import-report-${todaySydney()}.csv`, toCsv(["sheet", "line", "creator_name", "result", "reason", "problems", "warnings"], rows));
  }

  function reset() {
    setStep("upload"); setFile(null); setSheets([]); setChosen([]); setPlan(null); setOutcome(null); setError(undefined); setDecisions({});
  }

  const mappedCount = mapping.filter(Boolean).length;
  const hasName = mapping.includes("creator_name") || mapping.includes("business_name");
  const dupFields = mapping.filter((m, i) => m && mapping.indexOf(m) !== i);

  return (
    <div className="space-y-6">
      <Steps step={step} />
      {error && <Notice tone="error" onClose={() => setError(undefined)}>{error}</Notice>}

      {step === "upload" && (
        <section className="space-y-4 rounded-xl bg-white p-5 ring-1 ring-ink/5">
          <label className="block cursor-pointer rounded-xl border-2 border-dashed border-ink/15 p-8 text-center hover:border-sky">
            <input type="file" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="sr-only" onChange={(e) => e.target.files?.[0] && readFile(e.target.files[0])} />
            <span className="font-display text-xl">Choose a CSV or Excel file</span>
            <span className="mt-1 block text-sm text-ink/55">UTF-8 CSV or .xlsx, up to {MAX_ROWS.toLocaleString()} rows. Formulas in the file are never run.</span>
          </label>
          {sheets.length > 1 && (
            <div>
              <p className="text-sm font-semibold">This workbook has {sheets.length} worksheets. Which should be imported?</p>
              <div className="mt-2 space-y-1">
                {sheets.map((s) => (
                  <label key={s.name} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={chosen.includes(s.name)} onChange={(e) => setChosen((c) => (e.target.checked ? [...c, s.name] : c.filter((x) => x !== s.name)))} />
                    {s.name} <span className="text-ink/50">({(s.rows.length - 1).toLocaleString()} rows)</span>
                  </label>
                ))}
              </div>
              <Btn tone="dark" className="mt-3" disabled={!chosen.length} onClick={() => prepare(sheets, chosen)}>Continue with {chosen.length} worksheet{chosen.length === 1 ? "" : "s"}</Btn>
            </div>
          )}
          <p className="text-sm text-ink/60">Not sure about the columns? <button className="underline" onClick={() => download("gfit-prospect-import-template.csv", importTemplateCsv())}>Download the blank template</button> — it has every field the CRM understands.</p>
        </section>
      )}

      {step === "map" && (
        <section className="space-y-4">
          <p className="text-sm text-ink/65"><b>{file?.name}</b> · {records.length.toLocaleString()} rows · {mappedCount} of {headers.length} columns recognised. Check each column goes to the right field; set anything else to “Ignore”.</p>
          {!hasName && <Notice tone="warn">Map a column to <b>creator_name</b> (or business_name) — rows without a name can’t be imported.</Notice>}
          {dupFields.length > 0 && <Notice tone="warn">More than one column feeds {[...new Set(dupFields)].join(", ")}. The first non-empty value is used.</Notice>}
          <Table head={["Column in your file", "Imports into", "Examples"]}>
            {headers.map((h, i) => (
              <tr key={i}>
                <td className="px-4 py-2 font-semibold">{h}</td>
                <td className="px-4 py-2">
                  <select className={`${inputCls} min-w-56`} value={mapping[i] ?? ""} onChange={(e) => setMapping((m) => m.map((x, j) => (j === i ? e.target.value || null : x)))} aria-label={`Field for ${h}`}>
                    <option value="">Ignore this column</option>
                    {Object.entries(groupBy(PROSPECT_FIELDS)).map(([g, fs]) => (
                      <optgroup key={g} label={g}>{fs.map((f) => <option key={f.key} value={f.key}>{f.key} — {f.label}</option>)}</optgroup>
                    ))}
                  </select>
                </td>
                <td className="max-w-md truncate px-4 py-2 text-xs text-ink/55">{records.slice(0, 3).map((r) => r[i]).filter(Boolean).join(" · ").slice(0, 120) || "—"}</td>
              </tr>
            ))}
          </Table>

          <div className="grid gap-4 rounded-xl bg-white p-5 ring-1 ring-ink/5 md:grid-cols-2">
            <fieldset className="space-y-2 text-sm">
              <legend className="mb-1 font-semibold">When a creator is clearly already in the CRM</legend>
              <Radio name="dup" checked={options.duplicates === "skip"} onChange={() => setOptions((o) => ({ ...o, duplicates: "skip" }))} label="Import new records only (skip them)" />
              <Radio name="dup" checked={options.duplicates === "fill_blanks"} onChange={() => setOptions((o) => ({ ...o, duplicates: "fill_blanks" }))} label="Fill in fields we don't know yet" />
              <Radio name="dup" checked={options.duplicates === "update_research"} onChange={() => setOptions((o) => ({ ...o, duplicates: "update_research" }))} label="Update research with newer information (only if this file's research_date is the same or newer)" />
              <p className="text-xs text-ink/50">Stage, notes, outreach history, assignment and do-not-contact are never changed by an import.</p>
            </fieldset>
            <fieldset className="space-y-2 text-sm">
              <legend className="mb-1 font-semibold">When a row might be someone we already have</legend>
              <Radio name="pos" checked={options.possible === "review"} onChange={() => setOptions((o) => ({ ...o, possible: "review" }))} label="Let me review each one" />
              <Radio name="pos" checked={options.possible === "skip"} onChange={() => setOptions((o) => ({ ...o, possible: "skip" }))} label="Skip possible duplicates" />
              <p className="text-xs text-ink/50">e.g. same studio email or website but no matching profile — often a different instructor at the same studio.</p>
              <label className="block pt-2"><span className="text-xs font-semibold text-ink/60">Recruitment source (if the file doesn’t say)</span><input className={inputCls} value={source} onChange={(e) => setSource(e.target.value.slice(0, 200))} /></label>
              <label className="block"><span className="text-xs font-semibold text-ink/60">Tag every row (optional)</span><input className={inputCls} placeholder="e.g. pilates-au-batch-1" value={tag} onChange={(e) => setTag(e.target.value.slice(0, 40))} /></label>
            </fieldset>
          </div>
          <div className="flex gap-2"><Btn tone="primary" disabled={!hasName || busy} onClick={check}>{busy ? "Checking…" : "Check the file"}</Btn><Btn onClick={reset}>Start again</Btn></div>
        </section>
      )}

      {step === "check" && plan && summary && (
        <section className="space-y-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
            <Sum label="New" n={summary.insert} />
            <Sum label={options.duplicates === "update_research" ? "Update research" : "Fill blanks"} n={summary.fill_blanks + summary.update_research} />
            <Sum label="To review" n={summary.review} tone={summary.review ? "amber" : undefined} />
            <Sum label="Skipped / duplicates" n={summary.skip} />
            <Sum label="Can't import" n={summary.failed} tone={summary.failed ? "red" : undefined} />
            <Sum label="Rows with unreadable values" n={summary.withProblems} tone={summary.withProblems ? "amber" : undefined} />
          </div>
          {summary.withProblems > 0 && <Notice tone="warn">{summary.withProblems} rows have values that couldn’t be read (for example “lots” in a follower count). Those fields will be left as unknown; the rest of the row is imported. Details are in the report.</Notice>}

          <h2 className="font-display text-xl">Preview</h2>
          <Table head={["Line", "Creator", "Country", "Category → founding category", "Profiles", "Score inputs", "What happens"]}>
            {plan.slice(0, 8).map((r, i) => (
              <tr key={i}>
                <td className="px-3 py-2 text-xs">{origins[i]?.sheet !== file?.name ? `${origins[i]?.sheet} ` : ""}{origins[i]?.line}</td>
                <td className="px-3 py-2 font-semibold">{String(r.data.creator_name ?? "—")}</td>
                <td className="px-3 py-2 text-xs">{String(r.data.country ?? "unknown")}</td>
                <td className="px-3 py-2 text-xs">{String(r.data.primary_category ?? "unknown")} → {String(r.data.allocation_category ?? "none")}</td>
                <td className="px-3 py-2 text-xs">{[r.keys.instagram && `IG @${r.keys.instagram}`, r.keys.tiktok && `TT @${r.keys.tiktok}`, r.keys.youtube && "YouTube", r.keys.email, r.keys.website].filter(Boolean).join(" · ") || "none"}</td>
                <td className="px-3 py-2 text-xs">{r.data.total_fit_score != null ? `total ${r.data.total_fit_score}` : ""}{r.data.confidence_level ? ` · ${r.data.confidence_level}` : ""}</td>
                <td className="px-3 py-2 text-xs"><ActionLabel r={r} />{(r.problems.length > 0 || r.warnings.length > 0) && <div className="text-[#8a5a00]">{[...r.problems, ...r.warnings].slice(0, 2).join("; ")}</div>}</td>
              </tr>
            ))}
          </Table>

          {reviewRows.length > 0 && (
            <>
              <h2 className="font-display text-xl">Possible duplicates — your call ({reviewRows.length})</h2>
              <p className="text-sm text-ink/60">These share something (an email, a website or a name) with a creator already in the CRM, but no profile link proves they’re the same person. Nothing is merged unless you choose it.</p>
              <div className="flex gap-2">
                <Btn onClick={() => setDecisions((d) => ({ ...d, ...Object.fromEntries(reviewRows.map(({ i }) => [i, "new"])) }))}>All are different people</Btn>
                <Btn onClick={() => setDecisions((d) => ({ ...d, ...Object.fromEntries(reviewRows.map(({ i }) => [i, "skip"])) }))}>Skip all</Btn>
              </div>
              <Table head={["Line", "In this file", "Already in the CRM", "Decision"]}>
                {reviewRows.slice(0, 300).map(({ r, i }) => r.match.kind === "possible" && (
                  <tr key={i}>
                    <td className="px-3 py-2 text-xs">{origins[i]?.line}</td>
                    <td className="px-3 py-2"><b>{String(r.data.creator_name)}</b><div className="text-xs text-ink/55">{[r.data.country, r.keys.email, r.keys.website, r.keys.instagram && `@${r.keys.instagram}`].filter(Boolean).join(" · ")}</div></td>
                    <td className="px-3 py-2 text-xs">{r.match.candidates.map((c) => (
                      <div key={c.id}><Link className="font-semibold text-sky underline" target="_blank" href={`/admin/acquisition/prospect/?id=${c.id}`}>{names.get(c.id) ?? "prospect"}</Link> — {c.reasons.map((x) => MATCH_REASON_LABEL[x]).join(", ")}</div>
                    ))}</td>
                    <td className="px-3 py-2">
                      <select className="rounded-lg bg-white px-2 py-1 text-xs ring-1 ring-ink/15" value={decisions[i] ?? "skip"} onChange={(e) => setDecisions((d) => ({ ...d, [i]: e.target.value as Decision }))} aria-label="Decision">
                        <option value="skip">Skip this row</option>
                        <option value="new">Different person — add as new</option>
                        {r.match.candidates.map((c) => <option key={c.id} value={`merge:${c.id}`}>Same as {names.get(c.id) ?? "prospect"} — fill blanks</option>)}
                      </select>
                    </td>
                  </tr>
                ))}
              </Table>
              {reviewRows.length > 300 && <p className="text-xs text-ink/55">Showing the first 300. The rest use the bulk choice above (default: skip).</p>}
            </>
          )}

          <div className="rounded-xl bg-white p-4 ring-1 ring-ink/5">
            <p className="text-sm">Ready to import <b>{(summary.insert + summary.fill_blanks + summary.update_research + Object.values(decisions).filter((d) => d !== "skip").length).toLocaleString()}</b> rows from <b>{file?.name}</b>.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Btn tone="primary" disabled={busy} onClick={commit}>Import now</Btn>
              <Btn onClick={errorReport}>Download the check report</Btn>
              <Btn onClick={() => setStep("map")}>Back to columns</Btn>
              <Btn onClick={reset}>Cancel</Btn>
            </div>
          </div>
        </section>
      )}

      {step === "importing" && (
        <section className="rounded-xl bg-white p-5 ring-1 ring-ink/5">
          <p className="font-semibold">Importing… {Math.round(progress * 100)}%</p>
          <div className="mt-2"><Bar value={progress} max={1} tone="coral" /></div>
          <p className="mt-2 text-xs text-ink/55">Keep this page open until it finishes.</p>
        </section>
      )}

      {step === "done" && outcome && (
        <section className="space-y-4">
          <Notice tone="ok">Import finished. {outcome.counts.inserted} new, {outcome.counts.updated} updated{outcome.counts.failed ? `, ${outcome.counts.failed} failed` : ""}.</Notice>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
            <Sum label="Added" n={outcome.counts.inserted!} />
            <Sum label="Updated" n={outcome.counts.updated!} />
            <Sum label="Already up to date" n={outcome.counts.unchanged!} />
            <Sum label="Duplicates skipped" n={outcome.counts.duplicates!} />
            <Sum label="Other skipped" n={outcome.counts.skipped!} />
            <Sum label="Failed" n={outcome.counts.failed!} tone={outcome.counts.failed ? "red" : undefined} />
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href={`/admin/acquisition/prospects/?batch=${outcome.batch}`} className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-paper">See the imported prospects</Link>
            <Link href="/admin/acquisition/today/" className="rounded-full bg-coral px-4 py-2 text-sm font-semibold text-white">Go to Today’s Tasks</Link>
            <Btn onClick={errorReport}>Download import report</Btn>
            <Btn onClick={reset}>Import another file</Btn>
          </div>
        </section>
      )}

      <section>
        <h2 className="font-display mb-3 text-xl">Import history</h2>
        <Table head={["When", "File", "Rows", "Added", "Updated", "Unchanged", "Duplicates", "Skipped", "Failed", ""]}>
          {(history.data ?? []).map((b) => (
            <tr key={b.id}>
              <td className="px-3 py-2 text-xs">{fmtDate(b.created_at, true)}</td>
              <td className="px-3 py-2">{b.file_name}{b.sheet_name && b.sheet_name !== b.file_name ? <div className="text-xs text-ink/50">{b.sheet_name}</div> : null}{b.status !== "complete" && <div className="text-xs text-[#8a5a00]">{b.status === "in_progress" ? "didn't finish" : b.status}</div>}</td>
              {["rows", "inserted", "updated", "unchanged", "duplicates", "skipped", "failed"].map((k) => <td key={k} className="px-3 py-2 tabular-nums">{b.stats?.[k] ?? "—"}</td>)}
              <td className="px-3 py-2"><Link className="text-xs text-sky underline" href={`/admin/acquisition/prospects/?batch=${b.id}`}>View</Link></td>
            </tr>
          ))}
          {!history.loading && !history.data?.length && <tr><td colSpan={10} className="px-4 py-4 text-ink/55">No imports yet.</td></tr>}
        </Table>
      </section>
    </div>
  );
}

function groupBy(fields: typeof PROSPECT_FIELDS) {
  const out: Record<string, typeof PROSPECT_FIELDS[number][]> = {};
  for (const f of fields) (out[f.group] ??= []).push(f);
  return out;
}

function ActionLabel({ r }: { r: RowPlan }) {
  const t: Record<string, string> = { insert: "Add as new", fill_blanks: "Fill blanks on existing", update_research: "Refresh research on existing", skip: r.reason ?? "Skip", review: "You decide (possible duplicate)", failed: `Can't import: ${r.reason}` };
  return <span className={r.action === "failed" ? "font-semibold text-[#b8361a]" : r.action === "review" ? "font-semibold text-[#8a5a00]" : ""}>{t[r.action]}</span>;
}

function Sum({ label, n, tone }: { label: string; n: number; tone?: "amber" | "red" }) {
  return (
    <div className="rounded-xl bg-white p-3 ring-1 ring-ink/5">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-ink/50">{label}</div>
      <div className={`font-display text-2xl tabular-nums ${tone === "red" ? "text-[#b8361a]" : tone === "amber" ? "text-[#8a5a00]" : ""}`}>{n.toLocaleString("en-AU")}</div>
    </div>
  );
}

function Radio({ name, checked, onChange, label }: { name: string; checked: boolean; onChange: () => void; label: string }) {
  return <label className="flex items-start gap-2"><input type="radio" name={name} className="mt-1" checked={checked} onChange={onChange} />{label}</label>;
}

function Steps({ step }: { step: Step }) {
  const all: Array<[Step, string]> = [["upload", "Choose file"], ["map", "Match columns & options"], ["check", "Check & review"], ["done", "Results"]];
  const idx = all.findIndex(([s]) => s === (step === "importing" ? "check" : step));
  return (
    <ol className="flex flex-wrap gap-2 text-sm">
      {all.map(([s, l], i) => <li key={s} className={`rounded-full px-3 py-1 ${i === idx ? "bg-ink text-paper" : i < idx ? "bg-mint/20" : "bg-ink/5 text-ink/50"}`}>{i + 1}. {l}</li>)}
    </ol>
  );
}

