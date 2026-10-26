"use client";

import { useState } from "react";
import { AGE_BAND_LABEL, AGE_BANDS, CATEGORIES, CATEGORY_LABEL, isChildBand, type AgeBand, type CategoryId, type Intensity } from "@app/domain";
import { Avatar } from "@/components/Avatar";
import { ParentGate } from "@/components/ParentGate";
import { useHousehold } from "@/lib/household";

const EMOJIS = ["🦊", "🐬", "🐣", "🦉", "🐯", "🐼", "🦄", "🐸", "🐙", "🦖"];
const COLOURS = ["#FF5A36", "#21C08B", "#FFC23D", "#2E6BFF", "#8B5CF6", "#EC4899"];
const MAX_PROFILES = 6;

export default function ProfilesPage() {
  const h = useHousehold();
  const [adding, setAdding] = useState(false);
  const [nickname, setNickname] = useState("");
  const [ageBand, setAgeBand] = useState<AgeBand>("6-8");
  const [emoji, setEmoji] = useState(EMOJIS[0]!);
  const [colour, setColour] = useState(COLOURS[0]!);
  const [interests, setInterests] = useState<CategoryId[]>([]);
  const [maxIntensity, setMaxIntensity] = useState<Intensity | "">("");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  return (
    <ParentGate title="Manage profiles">
      <p className="mt-2 text-muted">Up to {MAX_PROFILES} profiles. Children’s profiles hold only a nickname, age band and interests — no email, photo or birthday.</p>
      <ul className="mt-6 divide-y divide-white/5 rounded-2xl bg-ink-2 ring-1 ring-white/5">
        {h.profiles.map((p) => (
          <li key={p.id} className="flex items-center gap-4 p-4">
            <Avatar p={p} size={48} />
            <div className="flex-1">
              <div className="font-semibold">{p.nickname}</div>
              <div className="text-xs text-muted">
                {AGE_BAND_LABEL[p.ageBand]}{p.pinProtected ? " · PIN protected" : ""}{p.maxIntensity ? ` · max intensity: ${p.maxIntensity}` : ""}
              </div>
            </div>
            {confirmDelete === p.id ? (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted">Delete profile and all its activity?</span>
                <button onClick={() => { h.removeProfile(p.id); setConfirmDelete(null); }} className="rounded-full bg-coral px-3 py-1 font-semibold text-white">Delete</button>
                <button onClick={() => setConfirmDelete(null)} className="px-2 text-muted">Cancel</button>
              </div>
            ) : (
              <button onClick={() => setConfirmDelete(p.id)} className="text-sm text-muted hover:text-coral-2" disabled={h.profiles.length <= 1}>Remove</button>
            )}
          </li>
        ))}
      </ul>

      {!adding ? (
        <button disabled={h.profiles.length >= MAX_PROFILES} onClick={() => setAdding(true)} className="mt-6 rounded-full bg-paper px-5 py-2.5 font-semibold text-ink disabled:opacity-40">
          + Add a profile
        </button>
      ) : (
        <form
          className="mt-6 space-y-5 rounded-2xl bg-ink-2 p-5 ring-1 ring-white/10"
          onSubmit={(e) => {
            e.preventDefault();
            h.addProfile({ nickname: nickname.trim(), ageBand, avatar: { emoji, colour }, interests, pinProtected: !isChildBand(ageBand), maxIntensity: maxIntensity || undefined });
            setAdding(false);
            setNickname("");
            setInterests([]);
          }}
        >
          <div className="flex items-center gap-4">
            <Avatar p={{ nickname, avatar: { emoji, colour } }} size={64} />
            <label className="flex-1 text-sm font-semibold">Nickname
              <input required maxLength={20} value={nickname} onChange={(e) => setNickname(e.target.value)} className="mt-1 w-full rounded-xl bg-ink-3 px-3 py-2 font-normal" placeholder="e.g. Mia (no surnames)" />
            </label>
          </div>
          <div className="flex flex-wrap gap-2">{EMOJIS.map((x) => <button type="button" key={x} onClick={() => setEmoji(x)} className={`h-10 w-10 rounded-xl text-xl ${emoji === x ? "bg-white/20 ring-2 ring-sun" : "bg-ink-3"}`}>{x}</button>)}</div>
          <div className="flex gap-2">{COLOURS.map((c) => <button type="button" key={c} onClick={() => setColour(c)} aria-label={c} className={`h-8 w-8 rounded-full ${colour === c ? "ring-2 ring-paper ring-offset-2 ring-offset-ink-2" : ""}`} style={{ background: c }} />)}</div>
          <label className="block text-sm font-semibold">Age band
            <select value={ageBand} onChange={(e) => setAgeBand(e.target.value as AgeBand)} className="mt-1 w-full rounded-xl bg-ink-3 px-3 py-2 font-normal">
              {AGE_BANDS.map((b) => <option key={b} value={b}>{AGE_BAND_LABEL[b]}</option>)}
            </select>
          </label>
          <fieldset>
            <legend className="text-sm font-semibold">Interests</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {CATEGORIES.map((c) => (
                <button type="button" key={c} onClick={() => setInterests(interests.includes(c) ? interests.filter((x) => x !== c) : [...interests, c])} className={`rounded-full px-3 py-1.5 text-sm font-semibold ${interests.includes(c) ? "bg-paper text-ink" : "bg-ink-3"}`}>{CATEGORY_LABEL[c]}</button>
              ))}
            </div>
          </fieldset>
          <label className="block text-sm font-semibold">Intensity limit (optional)
            <select value={maxIntensity} onChange={(e) => setMaxIntensity(e.target.value as Intensity | "")} className="mt-1 w-full rounded-xl bg-ink-3 px-3 py-2 font-normal">
              <option value="">No extra limit</option><option value="gentle">Gentle only</option><option value="moderate">Up to moderate</option>
            </select>
          </label>
          <div className="flex gap-3">
            <button className="rounded-full bg-coral px-5 py-2.5 font-semibold text-white">Save profile</button>
            <button type="button" onClick={() => setAdding(false)} className="px-3 text-muted">Cancel</button>
          </div>
        </form>
      )}
    </ParentGate>
  );
}
