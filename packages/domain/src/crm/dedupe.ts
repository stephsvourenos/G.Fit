// Recognising the same creator across research files.
//
// - An Instagram, TikTok or YouTube profile identifies one creator: a match there is a confident duplicate.
// - A business email or website is often shared by every instructor at a studio, and names repeat, so a match on
//   those alone is only a *possible* duplicate for a person to review — unless the name AND the email/website agree.
// - Two records with different profiles on the same platform are different people, even if they share a studio.

import type { ProspectKeys } from "./normalise";

export type MatchReason = "instagram" | "tiktok" | "youtube" | "email" | "website" | "name";
export const MATCH_REASON_LABEL: Record<MatchReason, string> = {
  instagram: "same Instagram profile",
  tiktok: "same TikTok profile",
  youtube: "same YouTube channel",
  email: "same business email",
  website: "same website",
  name: "same name and country",
};

export interface Candidate {
  id: string;
  reasons: MatchReason[];
}
export type Match =
  | { kind: "new"; related?: Candidate[] }
  | { kind: "duplicate"; id: string; reasons: MatchReason[] }
  | { kind: "possible"; candidates: Candidate[] };

const STRONG: MatchReason[] = ["instagram", "tiktok", "youtube"];
const ALL: MatchReason[] = ["instagram", "tiktok", "youtube", "email", "website", "name"];

/** An index of known prospects (from the database, plus rows already seen in this file). */
export class ProspectIndex {
  private byKey = new Map<string, Set<string>>();
  private keysById = new Map<string, ProspectKeys>();

  add(id: string, keys: ProspectKeys) {
    const prev = this.keysById.get(id);
    const merged: ProspectKeys = prev ? (Object.fromEntries(ALL.map((r) => [r, keys[r] ?? prev[r]])) as unknown as ProspectKeys) : keys;
    this.keysById.set(id, merged);
    for (const r of ALL) {
      const v = merged[r];
      if (!v) continue;
      const k = `${r}:${v}`;
      if (!this.byKey.has(k)) this.byKey.set(k, new Set());
      this.byKey.get(k)!.add(id);
    }
  }

  get size() {
    return this.keysById.size;
  }

  match(keys: ProspectKeys): Match {
    const hits = new Map<string, Set<MatchReason>>();
    for (const r of ALL) {
      const v = keys[r];
      if (!v) continue;
      for (const id of this.byKey.get(`${r}:${v}`) ?? []) {
        if (!hits.has(id)) hits.set(id, new Set());
        hits.get(id)!.add(r);
      }
    }
    if (!hits.size) return { kind: "new" };

    const conflicts = (id: string) => {
      const other = this.keysById.get(id)!;
      return STRONG.some((r) => keys[r] && other[r] && keys[r] !== other[r]);
    };
    const all: Candidate[] = [...hits].map(([id, rs]) => ({ id, reasons: ALL.filter((r) => rs.has(r)) }));
    const different = all.filter((c) => conflicts(c.id));
    const live = all.filter((c) => !conflicts(c.id));

    const confident = live.filter((c) => c.reasons.some((r) => STRONG.includes(r)) || (c.reasons.includes("name") && (c.reasons.includes("email") || c.reasons.includes("website"))));
    if (confident.length === 1 && live.length === 1) return { kind: "duplicate", id: confident[0]!.id, reasons: confident[0]!.reasons };
    if (confident.length === 1 && live.every((c) => c === confident[0] || !c.reasons.some((r) => STRONG.includes(r)))) {
      // One clear match plus weaker look-alikes (e.g. colleagues at the same studio): still the clear match.
      return { kind: "duplicate", id: confident[0]!.id, reasons: confident[0]!.reasons };
    }
    if (live.length) return { kind: "possible", candidates: live };
    return { kind: "new", related: different };
  }
}
