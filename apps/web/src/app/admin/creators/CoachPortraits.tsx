"use client";

import { useEffect, useState } from "react";
import { coachPortraitUrl } from "@app/domain";
import { friendlyError, supabase, supabaseConfigured } from "@/lib/supabase";

interface Row { id: string; display_name: string; is_minor: boolean; portrait_path: string | null; portrait_consent_at: string | null; portrait_consent_ref: string | null }
const BASE = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const fetchRows = () =>
  supabase().from("instructors").select("id, display_name, is_minor, portrait_path, portrait_consent_at, portrait_consent_ref").order("display_name");
const TYPES = ["image/jpeg", "image/png", "image/webp"];

/**
 * Coach portraits as profile pictures. Only adult coaches, only with written consent (creator agreement clause 10),
 * and withdrawing removes the picture from every family's profile straight away.
 */
export function CoachPortraits() {
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState<string>();
  const [file, setFile] = useState<Record<string, File | undefined>>({});
  const [ref, setRef] = useState<Record<string, string>>({});

  const apply = ({ data, error }: Awaited<ReturnType<typeof fetchRows>>) => {
    if (error) setError(friendlyError(error));
    else setRows(data as Row[]);
  };
  const load = async () => apply(await fetchRows());
  useEffect(() => {
    if (!supabaseConfigured) return;
    let alive = true;
    fetchRows().then((r) => { if (alive) apply(r); });
    return () => { alive = false; };
  }, []);
  if (!supabaseConfigured) return null;

  async function save(r: Row) {
    setError(undefined);
    const f = file[r.id];
    const why = (ref[r.id] ?? "").trim();
    if (!f) return setError(`Choose a photo of ${r.display_name} first.`);
    if (!TYPES.includes(f.type)) return setError("The photo must be a JPG, PNG or WebP image.");
    if (f.size > 2 * 1024 * 1024) return setError("The photo must be under 2 MB. A square photo around 600 × 600 pixels is plenty.");
    if (!why) return setError("Record where the coach’s written consent is, for example “Creator agreement v1, clause 10, signed 12 Nov 2026”.");
    setBusy(r.id);
    const db = supabase();
    const path = `${r.id}/${crypto.randomUUID()}.${f.type.split("/")[1]!.replace("jpeg", "jpg")}`;
    const up = await db.storage.from("coach-portraits").upload(path, f, { contentType: f.type, upsert: false });
    if (up.error) { setBusy(undefined); return setError(friendlyError(up.error)); }
    const { error } = await db.from("instructors").update({ portrait_path: path, portrait_consent_at: new Date().toISOString(), portrait_consent_ref: why }).eq("id", r.id);
    if (r.portrait_path && !error) await db.storage.from("coach-portraits").remove([r.portrait_path]);
    setBusy(undefined);
    if (error) return setError(friendlyError(error));
    setFile((x) => ({ ...x, [r.id]: undefined }));
    await load();
  }

  async function withdraw(r: Row) {
    if (!window.confirm(`Remove ${r.display_name}’s photo from profile pictures? Any family using it will go back to their previous picture.`)) return;
    setBusy(r.id);
    const db = supabase();
    const { error } = await db.from("instructors").update({ portrait_path: null, portrait_consent_at: null, portrait_consent_ref: null }).eq("id", r.id);
    if (!error && r.portrait_path) await db.storage.from("coach-portraits").remove([r.portrait_path]);
    setBusy(undefined);
    if (error) return setError(friendlyError(error));
    await load();
  }

  return (
    <section className="mt-10">
      <h2 className="text-lg font-semibold">Coach photos for profile pictures</h2>
      <p className="mt-1 max-w-3xl text-sm text-ink/60">
        Families can pick a coach’s photo as their profile picture, like choosing a favourite character. Only add a photo
        once the coach has signed the profile-picture consent (creator agreement, clause 10). Junior coaches can’t be
        used. If a coach changes their mind, choose “Remove photo” and it disappears from every family’s profile at once.
      </p>
      {error && <p role="alert" className="mt-3 text-sm text-[#b8361a]">{error}</p>}
      <ul className="mt-4 divide-y divide-ink/10 rounded-xl bg-white ring-1 ring-ink/10">
        {rows.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center gap-4 p-4 text-sm">
            <div className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-[28%] bg-paper-2 text-xs text-ink/40">
              {/* eslint-disable-next-line @next/next/no-img-element -- our own storage */}
              {r.portrait_path ? <img src={coachPortraitUrl(BASE, r.portrait_path)} alt="" className="h-full w-full object-cover" /> : "No photo"}
            </div>
            <div className="min-w-40 flex-1">
              <div className="font-semibold">{r.display_name}</div>
              <div className="text-ink/60">
                {r.is_minor
                  ? "Junior coach: can’t be a profile picture"
                  : r.portrait_consent_at
                    ? `Offered to families. Consent: ${r.portrait_consent_ref} (recorded ${new Date(r.portrait_consent_at).toLocaleDateString("en-AU")})`
                    : "Not offered to families"}
              </div>
            </div>
            {!r.is_minor && (
              <div className="flex flex-wrap items-center gap-2">
                <input type="file" accept={TYPES.join(",")} aria-label={`Photo of ${r.display_name}`} onChange={(e) => setFile((x) => ({ ...x, [r.id]: e.target.files?.[0] }))} className="max-w-52 text-xs" />
                <input value={ref[r.id] ?? ""} onChange={(e) => setRef((x) => ({ ...x, [r.id]: e.target.value }))} placeholder="Where consent is recorded" aria-label={`Consent record for ${r.display_name}`} className="w-56 rounded border border-ink/20 px-2 py-1.5" />
                <button disabled={busy === r.id} onClick={() => save(r)} className="rounded-full bg-ink px-4 py-2 font-semibold text-paper disabled:opacity-40">
                  {busy === r.id ? "Saving…" : r.portrait_path ? "Replace photo" : "Add photo"}
                </button>
                {r.portrait_consent_at && (
                  <button disabled={busy === r.id} onClick={() => withdraw(r)} className="rounded-full px-4 py-2 font-semibold ring-1 ring-ink/20">Remove photo</button>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
