// Turning messy researched values into clean, comparable ones. Unknown stays unknown (null) — never 0 or false.

import { FIELD_BY_KEY, type FieldDef } from "./fields";

const UNKNOWN = new Set(["", "unknown", "n/a", "na", "none found", "not found", "not available", "not visible", "unclear", "?", "-", "--", "tbc", "tbd", "null", "undefined", "not stated"]);
export const isUnknown = (s: string) => UNKNOWN.has(s.trim().toLowerCase());

/** Text safe to store: no control characters, trimmed, capped. (React escapes it on screen; exports neutralise formula characters.) */
export function cleanText(s: string, max = 5000): string {
  // eslint-disable-next-line no-control-regex
  return s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").replace(/\r\n?/g, "\n").trim().slice(0, max);
}

export function parseBool(s: string): boolean | null | undefined {
  const v = s.trim().toLowerCase();
  if (isUnknown(v)) return null;
  if (["yes", "y", "true", "1", "✓", "✔"].includes(v) || v.startsWith("yes")) return true;
  if (["no", "n", "false", "0", "✗", "✘", "x"].includes(v) || v.startsWith("no ") || v === "none") return false;
  return undefined; // not understood → validation error
}

/** "12.5K", "1.2m", "12,345", "~3,000", "3000+" → integer. */
export function parseCount(s: string): number | null | undefined {
  const v = s.trim().toLowerCase().replace(/^[~≈]|\+$|approx\.?\s*/g, "").replace(/[\s,_]/g, "");
  if (isUnknown(v)) return null;
  const m = /^(\d+(?:\.\d+)?)([km])?$/.exec(v);
  if (!m) return undefined;
  const n = Number(m[1]) * (m[2] === "k" ? 1_000 : m[2] === "m" ? 1_000_000 : 1);
  return Number.isFinite(n) ? Math.round(n) : undefined;
}

export function parseNumber(s: string): number | null | undefined {
  const v = s.trim().replace(/^[A-Za-z$€£¥₹]{0,3}\s?/, "").replace(/,/g, "");
  if (isUnknown(s)) return null;
  if (!/^-?\d+(\.\d+)?$/.test(v)) return undefined;
  return Number(v);
}

/** ISO dates, Australian day/month/year, and Excel serial numbers (from .xlsx). Returns YYYY-MM-DD. */
export function parseDate(s: string): string | null | undefined {
  const v = s.trim();
  if (isUnknown(v)) return null;
  const pad = (n: number) => String(n).padStart(2, "0");
  const ok = (y: number, m: number, d: number) => {
    const dt = new Date(Date.UTC(y, m - 1, d));
    return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d && y >= 1990 && y <= 2100 ? `${y}-${pad(m)}-${pad(d)}` : undefined;
  };
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ].*)?$/.exec(v);
  if (m) return ok(+m[1]!, +m[2]!, +m[3]!);
  m = /^(\d{1,2})[/.](\d{1,2})[/.](\d{4})$/.exec(v);
  if (m) return ok(+m[3]!, +m[2]!, +m[1]!); // day first (Australian)
  if (/^\d{5}(\.\d+)?$/.test(v)) {
    const dt = new Date(Date.UTC(1899, 11, 30) + Math.floor(Number(v)) * 86_400_000);
    return ok(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
  }
  const t = Date.parse(v); // "25 November 2026", "Nov 25, 2026"
  if (!Number.isNaN(t) && /[a-z]/i.test(v)) {
    const dt = new Date(t);
    return ok(dt.getFullYear(), dt.getMonth() + 1, dt.getDate());
  }
  return undefined;
}

/** Only http(s) links are kept — never javascript:, data: or file: links. A bare "instagram.com/x" gets https:// added. */
export function parseUrl(s: string): string | null | undefined {
  const v = s.trim();
  if (isUnknown(v)) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(v) ? v : /^[\w-]+(\.[\w-]+)+(\/|$)/.test(v) ? `https://${v}` : v;
  try {
    const u = new URL(withScheme);
    if (u.protocol !== "https:" && u.protocol !== "http:") return undefined;
    if (!u.hostname.includes(".")) return undefined;
    return u.toString();
  } catch {
    return undefined;
  }
}

export function parseEmail(s: string): string | null | undefined {
  const v = s.trim().replace(/^mailto:/i, "").toLowerCase();
  if (isUnknown(v)) return null;
  return /^[^\s@<>()[\]\\,;:"]+@[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(v) && v.length <= 254 ? v : undefined;
}

export function parseList(s: string): string[] | null {
  if (isUnknown(s)) return null;
  const sep = /[;|\n]/.test(s) ? /\s*[;|\n]\s*/ : /\s*,\s*/;
  const out = s.split(sep).map((x) => cleanText(x, 500)).filter((x) => x && !isUnknown(x));
  return out.length ? [...new Set(out)] : null;
}

/** A handle typed on its own ("@coach.amy") is accepted for social fields and turned into a profile link. */
export function socialUrlFromHandle(field: string, s: string): string {
  const v = s.trim();
  const h = /^@?([A-Za-z0-9._-]{2,40})$/.exec(v)?.[1];
  if (!h || /\.(com|net|org|io|co|au|me|ee|ai|app|tv)$/i.test(v) && !v.startsWith("@")) return v; // looks like a web address, not a handle
  if (field === "instagram_url") return `https://www.instagram.com/${h}/`;
  if (field === "tiktok_url") return `https://www.tiktok.com/@${h}`;
  if (field === "youtube_url") return `https://www.youtube.com/@${h}`;
  return v;
}

export interface ParsedValue {
  value: unknown; // null = unknown
  error?: string;
  warning?: string;
}

export function parseField(def: FieldDef, raw: string): ParsedValue {
  const s = cleanText(raw, def.type === "longtext" ? 5000 : 1000);
  if (isUnknown(s)) return { value: null };
  const fail = (what: string): ParsedValue => ({ value: null, error: `${def.label}: “${s.slice(0, 60)}” isn't ${what}` });
  let warning: string | undefined;
  if (/^[=+@]/.test(s) && def.type !== "number" && def.type !== "int") warning = `${def.label} started with a formula character; stored as plain text`;
  switch (def.type) {
    case "text":
    case "longtext":
      return { value: s, warning };
    case "int": {
      const n = parseCount(s);
      if (n === undefined) return fail("a whole number");
      if (n !== null && def.min !== undefined && n < def.min) return fail(`at least ${def.min}`);
      return { value: n };
    }
    case "number": {
      const n = parseNumber(s);
      if (n === undefined) return fail("a number");
      if (n !== null && ((def.min !== undefined && n < def.min) || (def.max !== undefined && n > def.max))) return fail(`between ${def.min ?? "–∞"} and ${def.max ?? "∞"}`);
      return { value: n };
    }
    case "bool": {
      const b = parseBool(s);
      return b === undefined ? fail("yes, no or unknown") : { value: b };
    }
    case "date": {
      const d = parseDate(s);
      return d === undefined ? fail("a date (YYYY-MM-DD)") : { value: d };
    }
    case "url": {
      const u = parseUrl(socialUrlFromHandle(def.key, s));
      return u === undefined ? fail("a web link") : { value: u };
    }
    case "email": {
      const e = parseEmail(s);
      return e === undefined ? fail("an email address") : { value: e };
    }
    case "list":
      return { value: parseList(s) };
    case "enum": {
      const v = s.toLowerCase().replace(/^tier\s+/, "").replace(/\s+/g, "_");
      const alias: Record<string, string> = { ig: "instagram", insta: "instagram", dm: "instagram", e_mail: "email", contact: "contact_form", form: "contact_form", med: "medium", moderate: "medium", hi: "high", lo: "low", yt: "youtube", fb: "facebook" };
      const val = alias[v] ?? v;
      return def.values?.includes(val) ? { value: val } : fail(`one of: ${def.values?.join(", ")}`);
    }
  }
}

// ---------- Keys used to recognise the same creator across files ----------

const IG_RESERVED = new Set(["p", "reel", "reels", "tv", "explore", "stories", "accounts", "direct"]);

function host(u: URL) {
  return u.hostname.toLowerCase().replace(/^(www|m|mobile)\./, "");
}
function tryUrl(s: string | null | undefined): URL | null {
  if (!s) return null;
  try {
    return new URL(/^https?:/i.test(s) ? s : `https://${s}`);
  } catch {
    return null;
  }
}

export function instagramKey(s: string | null | undefined): string | null {
  if (!s) return null;
  const at = /^@?([a-z0-9._]{1,30})$/i.exec(s.trim());
  if (at && !s.includes("/")) return at[1]!.toLowerCase().replace(/\.$/, "");
  const u = tryUrl(s);
  if (!u || !/(^|\.)instagram\.com$|^instagr\.am$/.test(host(u))) return null;
  const seg = u.pathname.split("/").filter(Boolean)[0]?.toLowerCase();
  return seg && !IG_RESERVED.has(seg) && /^[a-z0-9._]{1,30}$/.test(seg) ? seg : null;
}

export function tiktokKey(s: string | null | undefined): string | null {
  if (!s) return null;
  const at = /^@?([a-z0-9._]{2,24})$/i.exec(s.trim());
  if (at && !s.includes("/")) return at[1]!.toLowerCase();
  const u = tryUrl(s);
  if (!u || !/(^|\.)tiktok\.com$/.test(host(u))) return null;
  const seg = u.pathname.split("/").filter(Boolean)[0];
  return seg?.startsWith("@") ? seg.slice(1).toLowerCase() : null;
}

/** Channel IDs (UC…) keep their case; @handles, /c/ and /user/ names are lower-cased. */
export function youtubeKey(s: string | null | undefined): string | null {
  if (!s) return null;
  const u = tryUrl(s);
  if (!u || !/(^|\.)youtube\.com$|^youtu\.be$/.test(host(u))) return null;
  const [a, b] = u.pathname.split("/").filter(Boolean);
  if (!a) return null;
  if (a === "channel" && b && /^UC[\w-]{20,}$/.test(b)) return `id:${b}`;
  if (a.startsWith("@")) return `@${a.slice(1).toLowerCase()}`;
  if ((a === "c" || a === "user") && b) return `${a}:${b.toLowerCase()}`;
  return null;
}

/** Link-in-bio and platform hosts are shared by thousands of creators, so they never identify one. */
const SHARED_HOSTS = /(^|\.)(linktr\.ee|linktree\.com|beacons\.ai|stan\.store|bio\.link|lnk\.bio|instagram\.com|tiktok\.com|youtube\.com|youtu\.be|facebook\.com|fb\.com|linkedin\.com|patreon\.com|gumroad\.com|teachable\.com|kajabi\.com|mykajabi\.com|thinkific\.com|squarespace\.com|wixsite\.com|wix\.com|wordpress\.com|shopify\.com|myshopify\.com|google\.com|sites\.google\.com|carrd\.co|substack\.com|mindbodyonline\.com|eventbrite\.com|calendly\.com|trainerize\.com|everfit\.io|uscreen\.tv|vimeo\.com|x\.com|twitter\.com|threads\.net)$/;

export function websiteKey(s: string | null | undefined): string | null {
  const u = tryUrl(s);
  if (!u) return null;
  const h = host(u);
  return h.includes(".") && !SHARED_HOSTS.test(h) ? h : null;
}

const FREE_MAIL = /@(gmail|googlemail|hotmail|outlook|live|yahoo|icloud|me|mac|aol|proton|protonmail|bigpond|optusnet|gmx)\./;
export function emailKey(s: string | null | undefined): string | null {
  return s ? s.trim().toLowerCase() : null;
}
export const isFreeMailbox = (email: string) => FREE_MAIL.test(email);

/** "Zoë O'Brien" + "Australia" → "zoe obrien|australia" */
export function nameKey(name: string | null | undefined, country: string | null | undefined): string | null {
  if (!name) return null;
  const fold = (x: string) => x.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/['’`]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
  const n = fold(name);
  return n.length >= 3 ? `${n}|${country ? fold(country) : ""}` : null;
}

export interface ProspectKeys {
  instagram: string | null;
  tiktok: string | null;
  youtube: string | null;
  email: string | null;
  website: string | null;
  name: string | null;
}

export function prospectKeys(p: Record<string, unknown>): ProspectKeys {
  const s = (k: string) => (typeof p[k] === "string" ? (p[k] as string) : null);
  return {
    instagram: instagramKey(s("instagram_url")),
    tiktok: tiktokKey(s("tiktok_url")),
    youtube: youtubeKey(s("youtube_url")),
    email: emailKey(s("public_business_email")),
    website: websiteKey(s("website_url")),
    name: nameKey(s("creator_name"), s("country")),
  };
}

export { FIELD_BY_KEY };
