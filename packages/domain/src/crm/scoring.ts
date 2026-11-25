// Creator fit score (Step 8). Research scores are assessments, not commitments. Missing evidence earns no points
// and lowers completeness — it is never treated as positive.

import { SCORE_CRITERIA } from "./fields";

export interface ScoringConfig {
  /** Maximum points per criterion (defaults: 25/20/20/20/10/5). */
  weights: Record<string, number>;
  /** Lowest score for each tier, highest first. */
  tiers: Array<{ tier: string; min: number }>;
}

export const DEFAULT_SCORING: ScoringConfig = {
  weights: Object.fromEntries(SCORE_CRITERIA.map((c) => [c.key, c.max])),
  tiers: [
    { tier: "A", min: 85 },
    { tier: "B", min: 75 },
    { tier: "C", min: 60 },
    { tier: "D", min: 0 },
  ],
};

export interface FitScore {
  /** 0–100, or null when nothing is known. */
  score: number | null;
  tier: string | null;
  /** How many of the criteria had evidence (0–6). */
  criteriaKnown: number;
  source: "manual" | "criteria" | "research-total" | "none";
}

export function computeFitScore(p: Record<string, unknown>, config: ScoringConfig = DEFAULT_SCORING): FitScore {
  const num = (k: string) => (typeof p[k] === "number" && Number.isFinite(p[k]) ? (p[k] as number) : null);
  const totalWeight = SCORE_CRITERIA.reduce((s, c) => s + (config.weights[c.key] ?? c.max), 0) || 100;
  let known = 0;
  let points = 0;
  for (const c of SCORE_CRITERIA) {
    const v = num(c.key);
    if (v === null) continue;
    known++;
    // research files score each criterion out of its default maximum; re-weight if the admin changed the weights
    points += (Math.min(Math.max(v, 0), c.max) / c.max) * (config.weights[c.key] ?? c.max);
  }
  const manual = num("fit_score_manual");
  let score: number | null;
  let source: FitScore["source"];
  if (manual !== null) {
    score = manual;
    source = "manual";
  } else if (known > 0) {
    score = (points / totalWeight) * 100;
    source = "criteria";
  } else if (num("total_fit_score") !== null) {
    score = num("total_fit_score");
    source = "research-total";
  } else {
    score = null;
    source = "none";
  }
  if (score !== null) score = Math.round(Math.min(Math.max(score, 0), 100) * 10) / 10;
  return { score, tier: tierFor(score, config), criteriaKnown: known, source };
}

export function tierFor(score: number | null, config: ScoringConfig = DEFAULT_SCORING): string | null {
  if (score === null) return null;
  const sorted = [...config.tiers].sort((a, b) => b.min - a.min);
  return sorted.find((t) => score >= t.min)?.tier ?? sorted[sorted.length - 1]?.tier ?? null;
}
