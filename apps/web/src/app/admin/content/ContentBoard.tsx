"use client";

import { Fragment, useState } from "react";
import { AGE_BAND_LABEL, canPublish, CATEGORY_LABEL, CONTENT_STATES, formatDuration, type ContentState, type Workout } from "@app/domain";
import { instructors, workouts as seed } from "@app/mock-data";
import { Badge, Table } from "@/components/AdminShell";

const NEXT: Partial<Record<ContentState, ContentState>> = {
  draft: "uploaded",
  uploaded: "awaiting-review",
  "awaiting-review": "approved",
  approved: "published",
  scheduled: "published",
  published: "archived",
};
const TONE: Record<ContentState, "grey" | "green" | "amber" | "red" | "blue"> = {
  draft: "grey", uploaded: "grey", "awaiting-review": "amber", approved: "blue", scheduled: "blue", published: "green", archived: "grey",
};

export function ContentBoard() {
  const [items, setItems] = useState<Workout[]>(seed);
  const [filter, setFilter] = useState<ContentState | "all">("all");
  const [log, setLog] = useState<string[]>([]);
  const [open, setOpen] = useState<string | null>(null);

  function update(id: string, change: Partial<Workout>, note: string) {
    setItems((list) => list.map((w) => (w.id === id ? { ...w, ...change } : w)));
    setLog((l) => [`${new Date().toLocaleTimeString()} — ops@demo: ${note}`, ...l]);
  }

  const shown = items.filter((w) => filter === "all" || w.state === filter);
  return (
    <>
      <div className="mb-4 flex flex-wrap gap-2">
        {(["all", ...CONTENT_STATES] as const).map((s) => (
          <button key={s} onClick={() => setFilter(s)} className={`rounded-full px-3 py-1.5 text-sm ${filter === s ? "bg-ink text-paper" : "bg-white ring-1 ring-ink/10"}`}>
            {s} {s !== "all" && <span className="opacity-60">({items.filter((w) => w.state === s).length})</span>}
          </button>
        ))}
      </div>
      <Table head={["Workout", "Instructor", "Ages", "Status", "Checks", ""]}>
        {shown.map((w) => {
          const ins = instructors.find((i) => i.id === w.instructorId)!;
          const check = canPublish({ ...w, state: w.state === "published" ? "approved" : w.state }, ins);
          const next = NEXT[w.state];
          const blocked = next === "published" && !canPublish(w, ins).ok;
          return (
            <Fragment key={w.id}>
              <tr className="align-top">
                <td className="px-4 py-3">
                  <button onClick={() => setOpen(open === w.id ? null : w.id)} className="text-left font-semibold hover:underline">{w.title}</button>
                  <div className="text-xs text-ink/50">{CATEGORY_LABEL[w.category]} · {formatDuration(w.durationSec)} · {w.intensity}</div>
                </td>
                <td className="px-4 py-3">{ins.displayName}{ins.isMinor && <div><Badge tone="amber">minor</Badge></div>}</td>
                <td className="px-4 py-3 text-xs">{w.ageBands.map((b) => AGE_BAND_LABEL[b]).join(", ")}</td>
                <td className="px-4 py-3"><Badge tone={TONE[w.state]}>{w.state}</Badge>{w.publishedAt && <div className="mt-1 text-xs text-ink/50">{w.publishedAt}</div>}</td>
                <td className="px-4 py-3">{check.ok || w.state === "archived" ? <Badge tone="green">all clear</Badge> : <Badge tone="red">{check.problems.filter((p) => !p.startsWith("Must be")).length} issue(s)</Badge>}</td>
                <td className="whitespace-nowrap px-4 py-3 text-right">
                  {next && (
                    <button
                      disabled={blocked}
                      title={blocked ? canPublish(w, ins).problems.join("\n") : ""}
                      onClick={() => update(w.id, { state: next, publishedAt: next === "published" ? new Date().toISOString().slice(0, 10) : w.publishedAt }, `${w.title}: ${w.state} → ${next}`)}
                      className="rounded-lg bg-ink px-3 py-1.5 text-xs font-semibold text-paper disabled:cursor-not-allowed disabled:bg-ink/20"
                    >
                      {next === "published" ? "Publish" : next === "archived" ? "Archive" : `Move to ${next}`}
                    </button>
                  )}
                </td>
              </tr>
              {open === w.id && (
                <tr>
                  <td colSpan={6} className="bg-ink/[0.02] px-4 py-4">
                    <div className="grid gap-4 text-sm sm:grid-cols-2">
                      <div>
                        <div className="font-semibold">Rights & safety checklist</div>
                        {([
                          ["creatorLicenceSigned", "Creator licence signed"],
                          ["musicCleared", "Music sync & master rights cleared"],
                          ["safetyReviewed", "External safety review completed"],
                        ] as const).map(([k, label]) => (
                          <label key={k} className="mt-2 flex items-center gap-2">
                            <input type="checkbox" checked={w.rights[k]} onChange={(e) => update(w.id, { rights: { ...w.rights, [k]: e.target.checked } }, `${w.title}: ${label} = ${e.target.checked}`)} />
                            {label}
                          </label>
                        ))}
                        {ins.isMinor && (
                          <label className="mt-2 flex items-center gap-2">
                            <input type="checkbox" checked={w.rights.guardianConsent === true} onChange={(e) => update(w.id, { rights: { ...w.rights, guardianConsent: e.target.checked } }, `${w.title}: guardian consent = ${e.target.checked}`)} />
                            Guardian consent & child-employment requirements on file
                          </label>
                        )}
                        <div className="mt-2 text-xs text-ink/50">Territories: {w.rights.territories.join(", ")}</div>
                      </div>
                      <div>
                        <div className="font-semibold">Publishing blockers</div>
                        <ul className="mt-2 list-disc pl-5 text-ink/70">
                          {canPublish({ ...w, state: "approved" }, ins).problems.map((p) => <li key={p}>{p}</li>)}
                          {canPublish({ ...w, state: "approved" }, ins).ok && <li>None — ready to publish once approved.</li>}
                        </ul>
                        <p className="mt-3 text-xs text-ink/50">Video file: sample placeholder (Mux upload arrives in Phase 2).</p>
                      </div>
                    </div>
                  </td>
                </tr>
              )}
            </Fragment>
          );
        })}
      </Table>
      {log.length > 0 && (
        <div className="mt-6 rounded-xl bg-white p-4 text-xs ring-1 ring-ink/5">
          <div className="mb-2 font-semibold uppercase tracking-wide text-ink/50">Audit trail (this session)</div>
          {log.map((l, i) => <div key={i} className="font-mono">{l}</div>)}
        </div>
      )}
    </>
  );
}
