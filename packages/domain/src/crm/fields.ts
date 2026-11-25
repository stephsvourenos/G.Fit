// Creator Acquisition CRM — the canonical prospect fields (the column names ChatGPT Work files use).
// One list drives the import template, automatic column matching, validation, the database column names and export.

export type FieldType = "text" | "longtext" | "int" | "number" | "bool" | "date" | "url" | "email" | "list" | "enum";

export interface FieldDef {
  key: string;
  label: string;
  group: FieldGroup;
  type: FieldType;
  /** Allowed values for enum fields (lower-case). */
  values?: readonly string[];
  /** Numeric range for scores and counts. */
  min?: number;
  max?: number;
  /** Research fields may be refreshed by a later research file; management fields are only set when a prospect is first created. */
  kind: "research" | "contact" | "management";
  /** Other header spellings that should be matched to this field automatically. */
  aliases?: readonly string[];
}

export type FieldGroup = "Identity and classification" | "Social media and audience" | "Content and monetisation" | "Professional contact details" | "Recruitment intelligence" | "Recruitment management";

export const RISK_LEVELS = ["low", "medium", "high"] as const;
export const CONFIDENCE_LEVELS = ["high", "medium", "low"] as const;
export const PRIORITY_TIERS = ["a", "b", "c", "d"] as const;
export const CHANNELS = ["instagram", "tiktok", "youtube", "facebook", "linkedin", "email", "contact_form", "phone", "website"] as const;
export type Channel = (typeof CHANNELS)[number];

const F = (key: string, label: string, group: FieldGroup, type: FieldType, kind: FieldDef["kind"], extra: Partial<FieldDef> = {}): FieldDef => ({ key, label, group, type, kind, ...extra });
const ID: FieldGroup = "Identity and classification";
const SO: FieldGroup = "Social media and audience";
const CM: FieldGroup = "Content and monetisation";
const CO: FieldGroup = "Professional contact details";
const RI: FieldGroup = "Recruitment intelligence";
const RM: FieldGroup = "Recruitment management";

export const PROSPECT_FIELDS: readonly FieldDef[] = [
  F("creator_name", "Creator name", ID, "text", "research", { aliases: ["name", "creator", "full_name", "instructor_name"] }),
  F("business_name", "Business name", ID, "text", "research", { aliases: ["brand", "studio", "business"] }),
  F("country", "Country", ID, "text", "research"),
  F("city", "City", ID, "text", "research"),
  F("primary_language", "Primary language", ID, "text", "research", { aliases: ["language"] }),
  F("primary_category", "Primary category", ID, "text", "research", { aliases: ["category", "fitness_category", "niche"] }),
  F("secondary_categories", "Secondary categories", ID, "list", "research", { aliases: ["other_categories"] }),
  F("creator_type", "Creator type", ID, "text", "research", { aliases: ["type"] }),

  F("instagram_url", "Instagram", SO, "url", "contact", { aliases: ["instagram", "instagram_handle", "ig", "ig_url"] }),
  F("instagram_followers", "Instagram followers", SO, "int", "research", { min: 0, aliases: ["ig_followers"] }),
  F("tiktok_url", "TikTok", SO, "url", "contact", { aliases: ["tiktok", "tiktok_handle"] }),
  F("tiktok_followers", "TikTok followers", SO, "int", "research", { min: 0 }),
  F("youtube_url", "YouTube", SO, "url", "contact", { aliases: ["youtube", "youtube_channel"] }),
  F("youtube_subscribers", "YouTube subscribers", SO, "int", "research", { min: 0, aliases: ["youtube_followers"] }),
  F("facebook_url", "Facebook", SO, "url", "contact", { aliases: ["facebook"] }),
  F("facebook_followers", "Facebook followers", SO, "int", "research", { min: 0 }),
  F("linkedin_url", "LinkedIn", SO, "url", "contact", { aliases: ["linkedin"] }),
  F("website_url", "Website", SO, "url", "contact", { aliases: ["website", "site", "url"] }),
  F("primary_platform", "Primary platform", SO, "enum", "research", { values: CHANNELS }),
  F("estimated_combined_followers", "Combined followers (estimate)", SO, "int", "research", { min: 0, aliases: ["combined_followers", "total_followers", "audience_size"] }),
  F("engagement_observations", "Engagement observations", SO, "longtext", "research"),
  F("last_active_date", "Last active", SO, "date", "research"),

  F("full_length_workouts_available", "Full-length workouts available", CM, "bool", "research"),
  F("estimated_workout_video_count", "Workout videos (estimate)", CM, "int", "research", { min: 0, aliases: ["workout_video_count", "video_count"] }),
  F("example_workout_url", "Example workout", CM, "url", "research"),
  F("existing_paid_products", "Existing paid products", CM, "longtext", "research"),
  F("existing_membership", "Has a membership", CM, "bool", "research"),
  F("monetisation_platform", "Monetisation platform", CM, "text", "research"),
  F("current_programme_price", "Current programme price", CM, "number", "research", { min: 0 }),
  F("current_programme_currency", "Programme currency", CM, "text", "research"),
  F("current_programme_billing_frequency", "Programme billing frequency", CM, "text", "research"),
  F("existing_fitness_app", "Existing fitness app", CM, "text", "research"),
  F("qualifications_visible", "Qualifications visible", CM, "bool", "research"),
  F("qualifications_details", "Qualifications", CM, "longtext", "research"),
  F("content_rights_risk", "Content rights risk", CM, "enum", "research", { values: RISK_LEVELS }),
  F("music_licensing_risk", "Music licensing risk", CM, "enum", "research", { values: RISK_LEVELS }),
  F("audience_demographic", "Audience demographic", CM, "longtext", "research"),

  F("public_business_email", "Public business email", CO, "email", "contact", { aliases: ["email", "business_email", "contact_email"] }),
  F("public_business_phone", "Public business phone", CO, "text", "contact", { aliases: ["phone", "business_phone"] }),
  F("contact_form_url", "Contact form", CO, "url", "contact"),
  F("preferred_outreach_channel", "Preferred outreach channel", CO, "enum", "research", { values: CHANNELS, aliases: ["outreach_channel"] }),
  F("contact_source_url", "Where the contact details were published", CO, "url", "contact"),
  F("outreach_permission_notes", "Outreach permission notes", CO, "longtext", "contact"),

  F("why_gfit_is_relevant", "Why G.Fit is relevant", RI, "longtext", "research"),
  F("specific_personalisation_detail", "Personalisation detail", RI, "longtext", "research", { aliases: ["personalisation_detail", "personalization_detail", "specific_personalization_detail"] }),
  F("recommended_pitch_angle", "Recommended pitch angle", RI, "longtext", "research", { aliases: ["pitch_angle"] }),
  F("potential_objections", "Potential objections", RI, "longtext", "research", { aliases: ["objections"] }),
  F("estimated_recruitment_difficulty", "Recruitment difficulty (estimate)", RI, "enum", "research", { values: RISK_LEVELS, aliases: ["recruitment_difficulty"] }),
  F("existing_content_score", "Existing content score", RI, "number", "research", { min: 0, max: 25 }),
  F("audience_engagement_score", "Audience engagement score", RI, "number", "research", { min: 0, max: 20 }),
  F("monetisation_score", "Monetisation score", RI, "number", "research", { min: 0, max: 20 }),
  F("promotion_potential_score", "Promotion potential score", RI, "number", "research", { min: 0, max: 20 }),
  F("qualification_quality_score", "Qualifications and quality score", RI, "number", "research", { min: 0, max: 10 }),
  F("catalogue_gap_score", "Catalogue gap score", RI, "number", "research", { min: 0, max: 5 }),
  F("total_fit_score", "Total fit score", RI, "number", "research", { min: 0, max: 100, aliases: ["fit_score", "score"] }),
  F("confidence_level", "Confidence", RI, "enum", "research", { values: CONFIDENCE_LEVELS, aliases: ["confidence"] }),
  F("priority_tier", "Priority tier (research)", RI, "enum", "research", { values: PRIORITY_TIERS, aliases: ["tier"] }),
  F("personalised_initial_dm", "Prepared DM", RI, "longtext", "research", { aliases: ["personalized_initial_dm", "initial_dm", "dm"] }),
  F("personalised_initial_email", "Prepared email", RI, "longtext", "research", { aliases: ["personalized_initial_email", "initial_email"] }),
  F("research_source_urls", "Research sources", RI, "list", "research", { aliases: ["sources", "source_urls"] }),
  F("research_date", "Research date", RI, "date", "research"),

  F("recruitment_status", "Recruitment stage", RM, "text", "management", { aliases: ["status", "stage"] }),
  F("assigned_to", "Assigned to (staff email)", RM, "email", "management"),
  F("last_contact_date", "Last contact", RM, "date", "management"),
  F("next_follow_up_date", "Next follow-up", RM, "date", "management", { aliases: ["follow_up_date"] }),
  F("notes", "Notes", RM, "longtext", "management"),
  F("tags", "Tags", RM, "list", "management"),
  F("original_recruitment_source", "Recruitment source", RM, "text", "management", { aliases: ["source", "recruitment_source"] }),
];

export const FIELD_BY_KEY: Readonly<Record<string, FieldDef>> = Object.fromEntries(PROSPECT_FIELDS.map((f) => [f.key, f]));
export const RESEARCH_FIELD_KEYS = PROSPECT_FIELDS.filter((f) => f.kind !== "management").map((f) => f.key);

/** The six score criteria and their default maximum points (Step 8). */
export const SCORE_CRITERIA = [
  { key: "existing_content_score", label: "Existing full-length workout content", max: 25 },
  { key: "audience_engagement_score", label: "Audience engagement", max: 20 },
  { key: "monetisation_score", label: "Existing monetisation activity", max: 20 },
  { key: "promotion_potential_score", label: "Promotion potential", max: 20 },
  { key: "qualification_quality_score", label: "Qualifications and content quality", max: 10 },
  { key: "catalogue_gap_score", label: "Catalogue gap", max: 5 },
] as const;

/** Header text → canonical key: lower-case, spaces/dashes to underscores, punctuation dropped, British/US spelling folded. */
export function headerKey(h: string): string {
  return h
    .replace(/^﻿/, "")
    .trim()
    .toLowerCase()
    .replace(/personaliz/g, "personalis")
    .replace(/[\s\-/]+/g, "_")
    .replace(/[^a-z0-9_]/g, "")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

/** Suggest a mapping from file headers to canonical fields. Exact names win over aliases; each field is used once. */
export function autoMapHeaders(headers: readonly string[]): Array<string | null> {
  const used = new Set<string>();
  const out: Array<string | null> = headers.map(() => null);
  const keys = headers.map(headerKey);
  keys.forEach((k, i) => {
    if (FIELD_BY_KEY[k] && !used.has(k)) {
      out[i] = k;
      used.add(k);
    }
  });
  keys.forEach((k, i) => {
    if (out[i]) return;
    const f = PROSPECT_FIELDS.find((d) => !used.has(d.key) && d.aliases?.some((a) => headerKey(a) === k));
    if (f) {
      out[i] = f.key;
      used.add(f.key);
    }
  });
  return out;
}

/** A blank import template: one header row with every supported field, then an example row clearly marked as fictional. */
export function importTemplateCsv(): string {
  const head = PROSPECT_FIELDS.map((f) => f.key);
  const example: Record<string, string> = {
    creator_name: "EXAMPLE ONLY – Fictional Coach",
    country: "Australia",
    primary_category: "Pilates and barre",
    instagram_url: "https://www.instagram.com/example.fictional.coach/",
    full_length_workouts_available: "yes",
    estimated_workout_video_count: "40",
    confidence_level: "medium",
    research_date: "2026-11-25",
    notes: "Delete this example row before importing.",
  };
  return [head.join(","), head.map((k) => csvCell(example[k] ?? "")).join(",")].join("\r\n") + "\r\n";
}

/** One CSV cell, quoted when needed, with spreadsheet formula characters neutralised (so =HYPERLINK(...) can't run when opened in Excel). */
export function csvCell(v: unknown): string {
  if (v === null || v === undefined) return "";
  let s = Array.isArray(v) ? v.join("; ") : String(v);
  if (/^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s)) s = "'" + s;
  return /[",\r\n]/.test(s) || s !== s.trim() ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(headers: readonly string[], rows: ReadonlyArray<Record<string, unknown>>): string {
  return [headers.map(csvCell).join(","), ...rows.map((r) => headers.map((h) => csvCell(r[h])).join(","))].join("\r\n") + "\r\n";
}
