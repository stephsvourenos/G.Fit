import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { inflateRawSync } from "node:zlib";
import {
  autoMapHeaders,
  allocationCategory,
  computeFitScore,
  csvCell,
  firstName,
  importTemplateCsv,
  instagramKey,
  parseCsv,
  parseField,
  FIELD_BY_KEY,
  planImport,
  prospectKeys,
  ProspectIndex,
  readXlsx,
  renderTemplate,
  hasMissingMarks,
  summarisePlan,
  tiktokKey,
  toTable,
  websiteKey,
  youtubeKey,
  PROSPECT_FIELDS,
  type ImportOptions,
} from "../src/crm";

const inflate = async (d: Uint8Array) => new Uint8Array(inflateRawSync(d));
const STAGES = [
  { key: "identified", label: "Identified" },
  { key: "contacted", label: "Contacted" },
];
const OPTS: ImportOptions = { duplicates: "skip", possible: "review" };

function plan(csv: string, existing = new ProspectIndex(), options = OPTS) {
  const { headers, records } = toTable(parseCsv(csv));
  return planImport({ headers, records, mapping: autoMapHeaders(headers), existing, stages: STAGES, staffByEmail: { "sam@gfit.test": "u-sam" }, options });
}

describe("reading files", () => {
  it("parses CSV with a BOM, quotes, doubled quotes, embedded newlines and CRLF", () => {
    const rows = parseCsv('﻿a,b,c\r\n"x, y","he said ""hi""","line1\nline2"\r\n\r\n1,2,3\r\n');
    expect(rows).toEqual([["a", "b", "c"], ["x, y", 'he said "hi"', "line1\nline2"], ["1", "2", "3"]]);
  });

  it("accepts semicolon-separated files", () => {
    expect(parseCsv("a;b\n1;2")).toEqual([["a", "b"], ["1", "2"]]);
  });

  it("reads every worksheet of an Excel file, never evaluating formulas", async () => {
    const sheets = await readXlsx(new Uint8Array(readFileSync(new URL("./fixtures/crm-multi.xlsx", import.meta.url))), inflate);
    expect(sheets.map((s) => s.name)).toEqual(["Pilates", "Dance & Yoga"]);
    const pil = toTable(sheets[0]!.rows);
    expect(pil.headers[2]).toBe("Instagram");
    expect(pil.records[0]![0]).toBe("FICTIONAL Ava Example");
    expect(pil.records[0]![6]).toBe(""); // =HYPERLINK(...) formula: not run, no value
    expect(parseField(FIELD_BY_KEY.research_date!, pil.records[0]![5]!).value).toBe("2026-11-20"); // Excel date serial
    const dy = toTable(sheets[1]!.rows);
    expect(dy.records[1]![3]).toBe(""); // =40+2 is not calculated
    expect(autoMapHeaders(dy.headers)).toEqual(["creator_name", "country", "tiktok_url", "total_fit_score", "primary_category"]);
  });

  it("refuses files that aren't Excel workbooks", async () => {
    await expect(readXlsx(new Uint8Array([1, 2, 3, 4]), inflate)).rejects.toThrow(/Excel/);
  });
});

describe("values", () => {
  const f = (k: string, v: string) => parseField(FIELD_BY_KEY[k]!, v);
  it("keeps unknown as unknown — never 0 or false", () => {
    for (const v of ["", "unknown", "N/A", "not visible", "?"]) {
      expect(f("instagram_followers", v).value).toBeNull();
      expect(f("full_length_workouts_available", v).value).toBeNull();
    }
    expect(f("instagram_followers", "0").value).toBe(0);
    expect(f("existing_membership", "no").value).toBe(false);
  });
  it("reads follower counts written the way people write them", () => {
    expect(f("instagram_followers", "12.5K").value).toBe(12_500);
    expect(f("instagram_followers", "1.2M").value).toBe(1_200_000);
    expect(f("instagram_followers", "~3,400").value).toBe(3_400);
    expect(f("instagram_followers", "lots").error).toBeTruthy();
  });
  it("reads ISO and Australian day-first dates; rejects impossible ones", () => {
    expect(f("research_date", "2026-11-05").value).toBe("2026-11-05");
    expect(f("research_date", "05/11/2026").value).toBe("2026-11-05");
    expect(f("research_date", "31/02/2026").error).toBeTruthy();
  });
  it("only keeps http(s) links and turns handles into profile links", () => {
    expect(f("website_url", "javascript:alert(1)").error).toBeTruthy();
    expect(f("website_url", "data:text/html,hi").error).toBeTruthy();
    expect(f("website_url", "example.com.au/about").value).toBe("https://example.com.au/about");
    expect(f("instagram_url", "@coach.amy").value).toBe("https://www.instagram.com/coach.amy/");
    expect(f("tiktok_url", "coach_amy").value).toBe("https://www.tiktok.com/@coach_amy");
  });
  it("validates emails and score ranges", () => {
    expect(f("public_business_email", "Hello@Studio.com.au").value).toBe("hello@studio.com.au");
    expect(f("public_business_email", "not an email").error).toBeTruthy();
    expect(f("existing_content_score", "30").error).toBeTruthy(); // max 25
    expect(f("confidence_level", "Med").value).toBe("medium");
    expect(f("priority_tier", "Tier A").value).toBe("a");
  });
  it("stores formula-looking text as plain text and flags it", () => {
    const r = f("notes", '=HYPERLINK("http://x","y")');
    expect(r.value).toBe('=HYPERLINK("http://x","y")');
    expect(r.warning).toMatch(/formula/);
  });
});

describe("export safety", () => {
  it("neutralises spreadsheet formulas and quotes cells", () => {
    expect(csvCell("=1+1")).toBe("'=1+1");
    expect(csvCell("@SUM(A1)")).toBe("'@SUM(A1)");
    expect(csvCell("-5")).toBe("-5");
    expect(csvCell('a,"b"')).toBe('"a,""b"""');
    expect(csvCell(null)).toBe("");
  });
  it("the blank template has every supported field and an example marked fictional", () => {
    const [head, ex] = parseCsv(importTemplateCsv());
    expect(head).toEqual(PROSPECT_FIELDS.map((x) => x.key));
    expect(ex![0]).toMatch(/EXAMPLE ONLY/);
  });
});

describe("recognising the same creator", () => {
  it("normalises profile links and handles", () => {
    expect(instagramKey("https://www.instagram.com/Coach.Amy/?hl=en")).toBe("coach.amy");
    expect(instagramKey("@coach.amy")).toBe("coach.amy");
    expect(instagramKey("https://instagram.com/p/ABC123/")).toBeNull();
    expect(tiktokKey("https://www.tiktok.com/@Coach_Amy?lang=en")).toBe("coach_amy");
    expect(youtubeKey("https://www.youtube.com/channel/UCabcdefghijklmnopqrstuv")).toBe("id:UCabcdefghijklmnopqrstuv");
    expect(youtubeKey("https://youtube.com/@CoachAmy/videos")).toBe("@coachamy");
    expect(websiteKey("https://www.studio.com.au/team")).toBe("studio.com.au");
    expect(websiteKey("https://linktr.ee/coachamy")).toBeNull(); // shared link-in-bio host
  });

  const idx = () => {
    const i = new ProspectIndex();
    i.add("p1", prospectKeys({ creator_name: "Amy Lee", country: "Australia", instagram_url: "https://www.instagram.com/coach.amy/", public_business_email: "hello@studio.com.au", website_url: "https://studio.com.au" }));
    return i;
  };

  it("same Instagram = confident duplicate", () => {
    expect(idx().match(prospectKeys({ instagram_url: "@Coach.Amy" }))).toMatchObject({ kind: "duplicate", id: "p1" });
  });
  it("a colleague sharing the studio email is NOT merged — only offered for review", () => {
    expect(idx().match(prospectKeys({ creator_name: "Bea Chen", country: "Australia", public_business_email: "hello@studio.com.au" })).kind).toBe("possible");
  });
  it("a colleague with her own Instagram at the same studio is a different person", () => {
    const m = idx().match(prospectKeys({ creator_name: "Bea Chen", instagram_url: "@bea.moves", public_business_email: "hello@studio.com.au", website_url: "https://studio.com.au" }));
    expect(m.kind).toBe("new");
  });
  it("same name and country alone is only a possible duplicate", () => {
    expect(idx().match(prospectKeys({ creator_name: "Amy Lee", country: "Australia" })).kind).toBe("possible");
  });
  it("name + email together is a confident duplicate", () => {
    expect(idx().match(prospectKeys({ creator_name: "amy lee", country: "australia", public_business_email: "HELLO@studio.com.au" }))).toMatchObject({ kind: "duplicate", id: "p1" });
  });
});

describe("planning an import", () => {
  const csv = [
    "creator_name,country,instagram_url,instagram_followers,primary_category,recruitment_status,assigned_to,notes",
    "FICTIONAL Amy Lee,Australia,@coach.amy,12k,Reformer Pilates,Contacted,sam@gfit.test,met at expo",
    "FICTIONAL Bo Park,Australia,https://instagram.com/bo.park,unknown,Yoga,,,",
    "FICTIONAL Amy Lee again,Australia,https://www.instagram.com/coach.amy/,,,,,",
    ",,,,,,,",
    ",Australia,@noname,,,,,",
  ].join("\n");

  it("maps, cleans, spots in-file duplicates and fails rows without a name", () => {
    const p = plan(csv);
    expect(p.map((r) => r.action)).toEqual(["insert", "insert", "skip", "failed"]);
    expect(p[0]!.data).toMatchObject({ instagram_followers: 12_000, recruitment_status: "contacted", assigned_to: "u-sam", allocation_category: "Pilates and barre" });
    expect(p[1]!.data.instagram_followers).toBeNull();
    expect(p[2]!.reason).toMatch(/line 2/);
  });

  it("importing the same file twice creates nothing new", () => {
    const first = plan(csv);
    const existing = new ProspectIndex();
    first.filter((r) => r.action === "insert").forEach((r, i) => existing.add(`db${i}`, r.keys));
    const again = plan(csv, existing);
    expect(again.filter((r) => r.action === "insert")).toHaveLength(0);
    expect(summarisePlan(again)).toMatchObject({ insert: 0, skip: 3, failed: 1 });
  });

  it("can update existing prospects instead of skipping, and sends uncertain matches to review", () => {
    const existing = new ProspectIndex();
    existing.add("db1", prospectKeys({ instagram_url: "@coach.amy" }));
    existing.add("db2", prospectKeys({ creator_name: "FICTIONAL Bo Park", country: "Australia" }));
    const p = plan(csv, existing, { duplicates: "update_research", possible: "review" });
    expect(p[0]).toMatchObject({ action: "update_research", targetId: "db1" });
    expect(p[1]!.action).toBe("review"); // name-only match: a person decides
  });

  it("handles 1,000 rows quickly", () => {
    const lines = ["creator_name,country,instagram_url,public_business_email"];
    for (let i = 0; i < 1000; i++) lines.push(`FICTIONAL Creator ${i},Australia,@fict.creator${i},coach${i}@example.invalid`);
    const t = Date.now();
    const p = plan(lines.join("\n"));
    expect(p.filter((r) => r.action === "insert")).toHaveLength(1000);
    expect(Date.now() - t).toBeLessThan(2000);
  });
});

describe("scoring", () => {
  it("adds the criteria to a score out of 100 and picks the tier", () => {
    const s = computeFitScore({ existing_content_score: 25, audience_engagement_score: 18, monetisation_score: 16, promotion_potential_score: 16, qualification_quality_score: 8, catalogue_gap_score: 4 });
    expect(s).toMatchObject({ score: 87, tier: "A", criteriaKnown: 6, source: "criteria" });
  });
  it("missing criteria earn nothing (never assumed positive)", () => {
    expect(computeFitScore({ existing_content_score: 25 })).toMatchObject({ score: 25, tier: "D", criteriaKnown: 1 });
  });
  it("nothing known means no score at all, not zero", () => {
    expect(computeFitScore({})).toMatchObject({ score: null, tier: null, source: "none" });
  });
  it("uses the researched total when there are no criteria, and a manual adjustment beats both", () => {
    expect(computeFitScore({ total_fit_score: 78 })).toMatchObject({ score: 78, tier: "B", source: "research-total" });
    expect(computeFitScore({ total_fit_score: 78, fit_score_manual: 61 })).toMatchObject({ score: 61, tier: "C", source: "manual" });
  });
});

describe("categories", () => {
  it("maps researched categories to founding categories without guessing", () => {
    expect(allocationCategory("Reformer Pilates")).toBe("Pilates and barre");
    expect(allocationCategory("Postnatal pilates")).toBe("Prenatal and postnatal fitness");
    expect(allocationCategory("Kids dance")).toBe("Kids and family fitness");
    expect(allocationCategory("PT and strength")).toBe("Strength and personal training");
    expect(allocationCategory("Calisthenics")).toBeNull();
  });
});

describe("message templates", () => {
  it("fills merge fields from facts and uses fallbacks", () => {
    const r = renderTemplate("Hi {{creator_first_name|there}}, loved {{specific_personalisation_detail}}.", { creator_first_name: null, specific_personalisation_detail: "your 30-day reformer series" });
    expect(r.text).toBe("Hi there, loved your 30-day reformer series.");
    expect(r.missing).toEqual([]);
  });
  it("never invents a missing fact — the gap is marked and must be edited", () => {
    const r = renderTemplate("Your programme {{programme_name}} would fit.", {});
    expect(r.missing).toEqual(["programme_name"]);
    expect(hasMissingMarks(r.text)).toBe(true);
  });
  it("only uses a first name when the name is clearly a person", () => {
    expect(firstName("Amy Lee")).toBe("Amy");
    expect(firstName("Coach amy")).toBe("Amy");
    expect(firstName("Pilates Lab Sydney")).toBeNull();
    expect(firstName("Amy | Reformer Pilates")).toBe("Amy");
  });
});
