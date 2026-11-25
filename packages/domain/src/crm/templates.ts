// Outreach message templates. Merge fields are filled only from real, stored facts; when a fact is missing the
// template's own fallback is used ({{creator_first_name|there}}), otherwise the gap is left visibly marked and the
// message must be edited before it can be copied or sent. Nothing is ever invented.

export const MERGE_FIELDS = [
  { key: "creator_first_name", label: "Creator's first name" },
  { key: "creator_name", label: "Creator's name" },
  { key: "business_name", label: "Business name" },
  { key: "primary_category", label: "Primary category" },
  { key: "programme_name", label: "Their programme name" },
  { key: "specific_personalisation_detail", label: "Personalisation detail (researched)" },
  { key: "recommended_pitch_angle", label: "Recommended pitch angle" },
  { key: "founder_name", label: "Founder name (Settings)" },
  { key: "launch_date", label: "Launch date (Settings)" },
  { key: "founding_creator_application_url", label: "Application link" },
  { key: "founding_places_remaining", label: "Founding places remaining" },
  { key: "referral_link", label: "Referral link" },
] as const;

export interface RenderResult {
  text: string;
  /** Merge fields that had no value and no fallback — the message needs editing before use. */
  missing: string[];
  /** Merge fields filled from data. */
  used: string[];
}

const TOKEN = /\{\{\s*([a-z_]+)\s*(?:\|([^}]*))?\}\}/g;
export const MISSING_MARK = (k: string) => `[[add ${k.replace(/_/g, " ")}]]`;
export const hasMissingMarks = (s: string) => /\[\[add [a-z ]+\]\]/.test(s);

export function renderTemplate(body: string, values: Record<string, string | number | null | undefined>): RenderResult {
  const missing: string[] = [];
  const used: string[] = [];
  const text = body.replace(TOKEN, (_m, key: string, fallback: string | undefined) => {
    const v = values[key];
    const s = v === null || v === undefined ? "" : String(v).trim();
    if (s) {
      used.push(key);
      return s;
    }
    if (fallback !== undefined) return fallback.trim();
    missing.push(key);
    return MISSING_MARK(key);
  });
  return { text, missing: [...new Set(missing)], used: [...new Set(used)] };
}

/** First name from a creator name, only when it clearly is a personal name ("Coach Amy Lee" → "Amy"; "Pilates Lab" → null). */
export function firstName(creatorName: string | null | undefined): string | null {
  if (!creatorName) return null;
  const studioWords = /\b(pilates|yoga|fitness|studio|gym|barre|dance|training|fit|club|lab|academy|co|method|collective|strength|hiit|health|team|official)\b/i;
  const clean = creatorName.replace(/\s[|–—-]\s.*$/, "").trim();
  if (studioWords.test(clean)) return null; // could be a business, not a person — use the fallback instead
  const w = clean.split(/\s+/).find((x) => !/^(coach|trainer|dr\.?|mr\.?|mrs\.?|ms\.?|miss|pt)$/i.test(x));
  if (!w || !/^[A-Za-zÀ-ÿ'’-]{2,}$/.test(w)) return null;
  return w[0]!.toUpperCase() + w.slice(1);
}

export function formatLaunchDate(iso: string | null | undefined): string | null {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const [y, m, d] = iso.split("-").map(Number);
  const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  return `${d} ${months[m! - 1]} ${y}`;
}

/** Merge values for one prospect. Only facts we hold; settings supply founder name, launch date and places. */
export function mergeValuesFor(
  p: Record<string, unknown>,
  settings: { founder_name?: string | null; launch_date?: string | null; founding_places_remaining?: number | null; application_url?: string | null },
): Record<string, string | number | null> {
  const s = (k: string) => (typeof p[k] === "string" && (p[k] as string).trim() ? (p[k] as string).trim() : null);
  return {
    creator_first_name: firstName(s("creator_name")),
    creator_name: s("creator_name"),
    business_name: s("business_name"),
    primary_category: s("primary_category"),
    programme_name: s("programme_name"),
    specific_personalisation_detail: s("specific_personalisation_detail"),
    recommended_pitch_angle: s("recommended_pitch_angle"),
    founder_name: settings.founder_name?.trim() || null,
    launch_date: formatLaunchDate(settings.launch_date),
    founding_creator_application_url: settings.application_url ?? null,
    founding_places_remaining: settings.founding_places_remaining ?? null,
    referral_link: null, // creator referral links exist only once someone is a creator (Phase 2)
  };
}
