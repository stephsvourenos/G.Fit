// Planning an import: column mapping → cleaned values → duplicate check → what will happen to each row.
// Nothing is written here; the admin screen shows this plan, lets a person decide the uncertain rows, then commits.

import { FIELD_BY_KEY, headerKey } from "./fields";
import { parseField, prospectKeys, type ProspectKeys } from "./normalise";
import { ProspectIndex, type Match } from "./dedupe";

export interface CategoryRule {
  name: string;
  target: number;
  keywords: string[];
}

/** Founding creator allocation categories (Step 19 defaults). Checked in this order, so the specific ones come first. */
export const DEFAULT_CATEGORIES: CategoryRule[] = [
  { name: "Prenatal and postnatal fitness", target: 10, keywords: ["prenatal", "postnatal", "pregnan", "postpartum", "pre-natal", "post-natal", "antenatal", "mum", "mom"] },
  { name: "Kids and family fitness", target: 15, keywords: ["kids", "kid", "child", "family", "youth", "junior", "teen"] },
  { name: "Low-impact and over-50s fitness", target: 10, keywords: ["low impact", "low-impact", "over 50", "over-50", "over 50s", "senior", "older adult", "chair", "gentle", "active ageing", "active aging"] },
  { name: "Sport-specific conditioning", target: 10, keywords: ["sport", "athlet", "football", "soccer", "tennis", "netball", "basketball", "running", "runner", "golf", "cycling", "swim"] },
  { name: "Pilates and barre", target: 25, keywords: ["pilates", "barre", "reformer"] },
  { name: "Yoga and mobility", target: 20, keywords: ["yoga", "mobility", "stretch", "flexibility", "breathwork"] },
  { name: "Dance fitness", target: 20, keywords: ["dance", "zumba", "aerobics"] },
  { name: "HIIT and cardio", target: 15, keywords: ["hiit", "cardio", "bootcamp", "boot camp", "tabata", "circuit", "boxing", "kickbox"] },
  { name: "Strength and personal training", target: 25, keywords: ["strength", "personal train", "weights", "weight training", "lifting", "kettlebell", "bodybuilding", "functional", "gym", "pt"] },
];

/** Which founding category a researched category belongs to (or null when it isn't clear). */
export function allocationCategory(primary: string | null | undefined, rules: CategoryRule[] = DEFAULT_CATEGORIES): string | null {
  if (!primary) return null;
  const t = ` ${primary.toLowerCase().replace(/[^a-z0-9-]+/g, " ")} `;
  const exact = rules.find((r) => r.name.toLowerCase() === primary.trim().toLowerCase());
  if (exact) return exact.name;
  return rules.find((r) => r.keywords.some((k) => (k.length <= 3 ? t.includes(` ${k} `) : t.includes(k.toLowerCase()))))?.name ?? null;
}

export interface ImportOptions {
  /** A row that is clearly a prospect we already have. */
  duplicates: "skip" | "fill_blanks" | "update_research";
  /** A row that might be a prospect we already have. */
  possible: "skip" | "review";
}

export type RowAction = "insert" | "fill_blanks" | "update_research" | "skip" | "review" | "failed";

export interface RowPlan {
  /** Line in the spreadsheet (the header is line 1). */
  line: number;
  data: Record<string, unknown>;
  keys: ProspectKeys;
  /** Values that couldn't be read; those fields are left unknown. */
  problems: string[];
  warnings: string[];
  match: Match;
  action: RowAction;
  targetId?: string;
  reason?: string;
}

export interface PlanInput {
  headers: string[];
  records: string[][];
  /** For each column: the canonical field it feeds, or null to ignore it. */
  mapping: Array<string | null>;
  existing: ProspectIndex;
  stages: Array<{ key: string; label: string }>;
  staffByEmail: Record<string, string>;
  categories?: CategoryRule[];
  options: ImportOptions;
}

export function planImport(input: PlanInput): RowPlan[] {
  const { headers, records, mapping, existing, options } = input;
  const inFile = new ProspectIndex();
  const stageLookup = new Map<string, string>();
  for (const s of input.stages) {
    stageLookup.set(headerKey(s.key), s.key);
    stageLookup.set(headerKey(s.label), s.key);
  }
  if (mapping.length !== headers.length) throw new Error("Column mapping doesn't match the file's columns");

  return records.map((rec, i) => {
    const line = i + 2;
    const data: Record<string, unknown> = {};
    const problems: string[] = [];
    const warnings: string[] = [];
    mapping.forEach((key, col) => {
      if (!key) return;
      const def = FIELD_BY_KEY[key];
      const raw = rec[col] ?? "";
      if (!def || raw.trim() === "") return;
      if (data[key] !== undefined && data[key] !== null) return; // first mapped column wins
      const r = parseField(def, raw);
      if (r.error) problems.push(r.error);
      if (r.warning) warnings.push(r.warning);
      data[key] = r.value;
    });

    // management fields: stage names and staff emails must match what exists
    if (typeof data.recruitment_status === "string") {
      const k = stageLookup.get(headerKey(data.recruitment_status));
      if (!k) warnings.push(`Unknown recruitment stage “${data.recruitment_status}” — it will start at Identified`);
      data.recruitment_status = k ?? null;
    }
    if (typeof data.assigned_to === "string") {
      const id = input.staffByEmail[data.assigned_to];
      if (!id) warnings.push(`${data.assigned_to} isn't a staff login — left unassigned`);
      data.assigned_to = id ?? null;
    }
    data.allocation_category = allocationCategory(data.primary_category as string | null, input.categories);
    if (data.primary_category && !data.allocation_category) warnings.push(`Category “${data.primary_category}” doesn't match a founding category`);

    const keys = prospectKeys(data);
    const base = { line, data, keys, problems, warnings };
    if (!data.creator_name && !data.business_name) {
      return { ...base, match: { kind: "new" } as Match, action: "failed" as const, reason: "No creator or business name" };
    }
    if (!data.creator_name) data.creator_name = data.business_name;
    if (!keys.instagram && !keys.tiktok && !keys.youtube && !keys.email && !keys.website) {
      warnings.push("No profile link, email or website — duplicates can only be checked by name");
    }

    const fileMatch = inFile.match(keys);
    if (fileMatch.kind === "duplicate") {
      return { ...base, match: fileMatch, action: "skip" as const, reason: `Same creator as line ${fileMatch.id.slice(5)} of this file` };
    }
    inFile.add(`line:${line}`, keys);

    const match = existing.match(keys);
    if (match.kind === "duplicate") {
      return options.duplicates === "skip"
        ? { ...base, match, action: "skip" as const, targetId: match.id, reason: "Already in the CRM" }
        : { ...base, match, action: options.duplicates, targetId: match.id };
    }
    if (match.kind === "possible") {
      return options.possible === "skip" ? { ...base, match, action: "skip" as const, reason: "Possible duplicate (skipped)" } : { ...base, match, action: "review" as const };
    }
    return { ...base, match, action: "insert" as const };
  });
}

export interface PlanSummary {
  total: number;
  insert: number;
  fill_blanks: number;
  update_research: number;
  skip: number;
  review: number;
  failed: number;
  withProblems: number;
}

export function summarisePlan(plan: RowPlan[]): PlanSummary {
  const s: PlanSummary = { total: plan.length, insert: 0, fill_blanks: 0, update_research: 0, skip: 0, review: 0, failed: 0, withProblems: 0 };
  for (const r of plan) {
    s[r.action]++;
    if (r.problems.length) s.withProblems++;
  }
  return s;
}

/** The downloadable error report: one line per skipped, failed or problem row. */
export function errorReportRows(plan: RowPlan[], outcome?: Map<number, string>) {
  return plan
    .filter((r) => r.action === "failed" || r.action === "skip" || r.problems.length || r.warnings.length || outcome?.has(r.line))
    .map((r) => ({
      line: r.line,
      creator_name: (r.data.creator_name as string) ?? "",
      result: outcome?.get(r.line) ?? r.action,
      reason: r.reason ?? "",
      problems: r.problems.join(" | "),
      warnings: r.warnings.join(" | "),
    }));
}
