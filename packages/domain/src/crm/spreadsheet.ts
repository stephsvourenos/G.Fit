// Reading prospect files: UTF-8 CSV and Excel (.xlsx), with no third-party libraries.
// Excel formulas are never evaluated: only the value Excel saved for the cell is read.

export interface Sheet {
  name: string;
  rows: string[][];
}

/** RFC 4180 CSV: quoted fields, doubled quotes, CR/LF/CRLF, an optional byte-order mark. Also accepts ; or tab when the header clearly uses them. */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, "");
  const firstLine = src.slice(0, src.search(/\r|\n|$/));
  const counts = { ",": (firstLine.match(/,/g) ?? []).length, ";": (firstLine.match(/;/g) ?? []).length, "\t": (firstLine.match(/\t/g) ?? []).length };
  const sep = counts[","] >= counts[";"] && counts[","] >= counts["\t"] ? "," : counts[";"] >= counts["\t"] ? ";" : "\t";
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i]!;
    if (quoted) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else cell += c;
    } else if (c === '"' && cell === "") quoted = true;
    else if (c === sep) {
      row.push(cell);
      cell = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  if (cell !== "" || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return dropEmptyRows(rows);
}

function dropEmptyRows(rows: string[][]): string[][] {
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

/** Decompresses raw DEFLATE data. Passed in so this module stays platform-neutral (browser: DecompressionStream; Node: zlib). */
export type InflateRaw = (data: Uint8Array) => Promise<Uint8Array>;

const MAX_UNZIPPED = 200 * 1024 * 1024; // refuse "zip bombs"

/** Reads the parts of a ZIP file we need (central directory → each entry). */
async function unzip(bytes: Uint8Array, inflateRaw: InflateRaw, want: (name: string) => boolean): Promise<Map<string, string>> {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let eocd = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65_557); i--) {
    if (dv.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("This doesn't look like an Excel (.xlsx) file.");
  const count = dv.getUint16(eocd + 10, true);
  let p = dv.getUint32(eocd + 16, true);
  const out = new Map<string, string>();
  const dec = new TextDecoder("utf-8");
  let total = 0;
  for (let n = 0; n < count; n++) {
    if (dv.getUint32(p, true) !== 0x02014b50) throw new Error("The Excel file is damaged (bad directory).");
    const method = dv.getUint16(p + 10, true);
    const csize = dv.getUint32(p + 20, true);
    const usize = dv.getUint32(p + 24, true);
    const nlen = dv.getUint16(p + 28, true);
    const xlen = dv.getUint16(p + 30, true);
    const clen = dv.getUint16(p + 32, true);
    const local = dv.getUint32(p + 42, true);
    const name = dec.decode(bytes.subarray(p + 46, p + 46 + nlen));
    p += 46 + nlen + xlen + clen;
    if (!want(name)) continue;
    total += usize;
    if (total > MAX_UNZIPPED) throw new Error("The Excel file is too large to read.");
    const lnlen = dv.getUint16(local + 26, true);
    const lxlen = dv.getUint16(local + 28, true);
    const start = local + 30 + lnlen + lxlen;
    const data = bytes.subarray(start, start + csize);
    let raw: Uint8Array;
    if (method === 0) raw = data;
    else if (method === 8) raw = await inflateRaw(data);
    else throw new Error("The Excel file uses an unsupported compression method.");
    out.set(name, dec.decode(raw));
  }
  return out;
}

const XML_ENT: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
function unescapeXml(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (_, e: string) =>
    e[0] === "#" ? String.fromCodePoint(e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)) : XML_ENT[e.toLowerCase()] ?? _,
  );
}
function attr(tag: string, name: string): string | undefined {
  const m = new RegExp(`\\s${name}="([^"]*)"`).exec(tag);
  return m ? unescapeXml(m[1]!) : undefined;
}
/** All <t> text inside a fragment (shared strings and inline strings may be split into rich-text runs). */
function textRuns(fragment: string): string {
  let s = "";
  for (const m of fragment.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)) s += unescapeXml(m[1]!);
  // phonetic hints (<rPh>) are not part of the value
  return s;
}
function colIndex(ref: string): number {
  let n = 0;
  for (const ch of ref.replace(/\d+$/, "")) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

/** Reads every worksheet of an .xlsx file into rows of text. Dates stay as Excel serial numbers (the import turns them into dates). */
export async function readXlsx(bytes: Uint8Array, inflateRaw: InflateRaw): Promise<Sheet[]> {
  const files = await unzip(bytes, inflateRaw, (n) => n === "xl/workbook.xml" || n === "xl/_rels/workbook.xml.rels" || n === "xl/sharedStrings.xml" || /^xl\/worksheets\/[^/]+\.xml$/.test(n));
  const wb = files.get("xl/workbook.xml");
  if (!wb) throw new Error("This doesn't look like an Excel (.xlsx) workbook.");
  const rels = new Map<string, string>();
  for (const m of (files.get("xl/_rels/workbook.xml.rels") ?? "").matchAll(/<Relationship\b[^>]*>/g)) {
    const id = attr(m[0], "Id");
    const target = attr(m[0], "Target");
    if (id && target) rels.set(id, target.replace(/^\/?(xl\/)?/, "xl/"));
  }
  const shared: string[] = [];
  for (const m of (files.get("xl/sharedStrings.xml") ?? "").matchAll(/<si>([\s\S]*?)<\/si>/g)) shared.push(textRuns(m[1]!.replace(/<rPh\b[\s\S]*?<\/rPh>/g, "")));

  const sheets: Sheet[] = [];
  for (const m of wb.matchAll(/<sheet\b[^>]*>/g)) {
    const name = attr(m[0], "name") ?? `Sheet${sheets.length + 1}`;
    const rid = attr(m[0], "r:id");
    const path = (rid && rels.get(rid)) || `xl/worksheets/sheet${sheets.length + 1}.xml`;
    const xml = files.get(path);
    if (!xml) continue;
    const rows: string[][] = [];
    for (const r of xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>|<row\b[^>]*\/>/g)) {
      const cells: string[] = [];
      let next = 0;
      for (const c of (r[1] ?? "").matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const tag = `<c${c[1]}>`;
        const ref = attr(tag, "r");
        const idx = ref ? colIndex(ref) : next;
        next = idx + 1;
        const type = attr(tag, "t");
        const body = c[2] ?? "";
        const v = /<v>([\s\S]*?)<\/v>/.exec(body)?.[1];
        let value = "";
        if (type === "s") value = shared[Number(v)] ?? "";
        else if (type === "inlineStr") value = textRuns(body);
        else if (type === "b") value = v === "1" ? "TRUE" : v === "0" ? "FALSE" : "";
        else if (type === "e") value = ""; // a formula error (#N/A etc.) — treat as blank
        else value = v !== undefined ? unescapeXml(v) : "";
        while (cells.length < idx) cells.push("");
        cells[idx] = value;
      }
      rows.push(cells);
    }
    sheets.push({ name, rows: dropEmptyRows(rows) });
  }
  if (!sheets.length) throw new Error("No worksheets were found in this Excel file.");
  return sheets;
}

/** Turn rows into a header + records, padding short rows. Duplicate or blank headers get a suffix so nothing is silently lost. */
export function toTable(rows: string[][]): { headers: string[]; records: string[][] } {
  const [head = [], ...rest] = rows;
  const seen = new Map<string, number>();
  const headers = head.map((h, i) => {
    const base = h.trim() || `Column ${i + 1}`;
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    return n > 1 ? `${base} (${n})` : base;
  });
  const width = Math.max(headers.length, ...rest.map((r) => r.length));
  while (headers.length < width) headers.push(`Column ${headers.length + 1}`);
  return { headers, records: rest.map((r) => Array.from({ length: width }, (_, i) => r[i] ?? "")) };
}
