import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ZUSTAENDE = ["offen", "erledigt", "abgelehnt", "unfertig"] as const;

export type Zustand = (typeof ZUSTAENDE)[number];

export interface AssignmentRecord {
  mitarbeiter: string;
  bank: string;
  nummer: string;
  zustand: Zustand;
  datum: string;
}

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

export const assignmentsPath = path.join(projectRoot, "data", "assignments.json");

const LABEL_SPECS = [
  { key: "mitarbeiter", re: /\bmitarbeiter(?:in)?\b/gi },
  { key: "bank", re: /\bbank\b/gi },
  { key: "nummer", re: /\b(?:telefonnummer|telefon|tel|nummer)\b/gi },
  { key: "zustand", re: /\bzustand\b/gi },
] as const;

type LabelKey = (typeof LABEL_SPECS)[number]["key"];

interface LabelHit {
  key: LabelKey;
  start: number;
  end: number;
}

const PHONE_RE = /(?:\+\d|00\d|0\d)[\d\s/().-]{3,22}\d/g;
const ZUSTAND_RE = /\b(offen|erledigt|abgelehnt|unfertig)\b/gi;

const writeTails = new Map<string, Promise<void>>();

function cleanup(raw: string): string {
  return raw
    .replace(/\s+/g, " ")
    .replace(/^[\s:=–—-]+/, "")
    .replace(/[\s,;|]+$/, "")
    .replace(/^["„«]+|["“»]+$/g, "")
    .replace(/[.:]+$/, "")
    .trim();
}

function findLabels(text: string): LabelHit[] {
  const hits: LabelHit[] = [];
  for (const spec of LABEL_SPECS) {
    for (const match of text.matchAll(spec.re)) {
      if (match.index === undefined) continue;
      hits.push({
        key: spec.key,
        start: match.index,
        end: match.index + match[0].length,
      });
    }
  }

  hits.sort((a, b) => a.start - b.start || b.end - a.end);

  const kept: LabelHit[] = [];
  const seen = new Set<LabelKey>();
  let lastEnd = -1;
  for (const hit of hits) {
    if (hit.start < lastEnd || seen.has(hit.key)) continue;
    seen.add(hit.key);
    kept.push(hit);
    lastEnd = hit.end;
  }
  return kept;
}

function valueFor(text: string, hit: LabelHit, hits: LabelHit[]): string {
  const next = hits.find((other) => other.start >= hit.end);
  const end = next ? next.start : text.length;
  const newline = text.indexOf("\n", hit.end);
  const lineEnd = newline !== -1 && newline < end ? newline : end;
  const sameLine = cleanup(text.slice(hit.end, lineEnd));
  if (sameLine || lineEnd === end) return sameLine;

  const afterBreak = lineEnd + 1;
  const nextNewline = text.indexOf("\n", afterBreak);
  const nextLineEnd =
    nextNewline !== -1 && nextNewline < end ? nextNewline : end;
  return cleanup(text.slice(afterBreak, nextLineEnd));
}

function phonesIn(text: string): string[] {
  const found: string[] = [];
  for (const match of text.matchAll(PHONE_RE)) {
    const raw = match[0].replace(/\s+/g, " ").trim();
    const digits = raw.replace(/\D/g, "");
    if (digits.length >= 8 && digits.length <= 18) found.push(raw);
  }
  return found;
}

function asZustand(token: string | undefined): Zustand | null {
  if (!token) return null;
  const normalized = token.replace(/[.,;:!?]+$/g, "").toLowerCase();
  return (ZUSTAENDE as readonly string[]).includes(normalized)
    ? (normalized as Zustand)
    : null;
}

function bareZustand(text: string): Zustand | null {
  const unique = new Set<Zustand>();
  for (const match of text.matchAll(ZUSTAND_RE)) {
    const value = asZustand(match[1]);
    if (value) unique.add(value);
  }
  if (unique.size !== 1) return null;
  return [...unique][0];
}

function namedValue(value: string): string | null {
  if (value.length < 2 || value.length > 80) return null;
  if (!/\p{L}/u.test(value)) return null;
  if (asZustand(value)) return null;
  return value;
}

export function parseAssignmentMessage(
  text: string,
): Omit<AssignmentRecord, "datum"> | null {
  const source = text.trim();
  if (!source) return null;

  const hits = findLabels(source);
  const byKey = new Map(hits.map((hit) => [hit.key, hit]));

  const mitarbeiterHit = byKey.get("mitarbeiter");
  const bankHit = byKey.get("bank");
  if (!mitarbeiterHit || !bankHit) return null;

  const mitarbeiter = namedValue(valueFor(source, mitarbeiterHit, hits));
  const bank = namedValue(valueFor(source, bankHit, hits));
  if (!mitarbeiter || !bank) return null;

  const nummerHit = byKey.get("nummer");
  const nummerSource = nummerHit
    ? valueFor(source, nummerHit, hits)
    : source;
  const numbers = phonesIn(nummerSource);
  if (numbers.length !== 1) return null;

  const zustandHit = byKey.get("zustand");
  const zustand = zustandHit
    ? asZustand(valueFor(source, zustandHit, hits).split(/\s+/)[0])
    : bareZustand(source);
  if (!zustand) return null;

  return {
    mitarbeiter,
    bank,
    nummer: numbers[0],
    zustand,
  };
}

function isEnoent(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: string }).code === "ENOENT"
  );
}

async function readAssignments(filePath: string): Promise<unknown[]> {
  let raw: string;
  try {
    raw = await readFile(filePath, "utf8");
  } catch (err) {
    if (isEnoent(err)) return [];
    throw err;
  }

  const trimmed = raw.trim();
  if (!trimmed) return [];

  const parsed: unknown = JSON.parse(trimmed);
  if (!Array.isArray(parsed)) {
    throw new Error("data/assignments.json muss ein JSON-Array sein.");
  }
  return parsed;
}

export async function loadAssignments(
  filePath: string = assignmentsPath,
): Promise<unknown[]> {
  return withFileLock(filePath, () => readAssignments(filePath));
}

async function withFileLock<T>(filePath: string, fn: () => Promise<T>): Promise<T> {
  const previous = writeTails.get(filePath) ?? Promise.resolve();
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  writeTails.set(
    filePath,
    previous.then(() => gate, () => gate),
  );

  await previous.catch(() => {});
  try {
    return await fn();
  } finally {
    release();
  }
}

async function appendRecord(
  record: AssignmentRecord,
  filePath: string,
): Promise<void> {
  await withFileLock(filePath, async () => {
    const records = await readAssignments(filePath);
    records.push(record);
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, `${JSON.stringify(records, null, 2)}\n`, "utf8");
  });
}

export async function saveAssignmentFromMessage(
  text: string,
  options?: { datum?: string; filePath?: string },
): Promise<boolean> {
  const parsed = parseAssignmentMessage(text);
  if (!parsed) return false;

  const record: AssignmentRecord = {
    mitarbeiter: parsed.mitarbeiter,
    bank: parsed.bank,
    nummer: parsed.nummer,
    zustand: parsed.zustand,
    datum: options?.datum ?? new Date().toISOString(),
  };
  await appendRecord(record, options?.filePath ?? assignmentsPath);
  return true;
}
