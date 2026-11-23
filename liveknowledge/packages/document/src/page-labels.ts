// Page labels (docs/specs/030-knowledgebase/page-surface.md "Page labels"; blueprint
// docs/specs/030-knowledgebase/blueprints/page-labels.md): the knowledgebase's labels, each an id, a name and a
// colour, kept once with its settings (`KnowledgeSettings.labels`), and the ids a page carries (`Tab.labels`). A
// rename, a new colour or a deleted label is one change to the knowledgebase's list: no page is rewritten. Reading is
// forgiving (what is valid is kept), a change is strict (it answers a refusal by name).
import { STANDARD_COLOUR_NAMES, isHexColour, type StandardColourName } from './standard-colours';

/** A label's colour: a standard colour's name (`StandardColourName`, drawn in its version for the appearance) or a
 *  custom `#rrggbb`; `isLabelColour` says which strings are either. */
export type LabelColour = string;

export type KnowledgeLabel = { id: string; name: string; colour: LabelColour };

export const LABEL_NAME_MAX = 40;
export const MAX_KNOWLEDGEBASE_LABELS = 100;
export const MAX_PAGE_LABELS = 10;

/** The colours new labels take in turn: the standard colours that read as a hue first, grey last. */
export const LABEL_COLOUR_ORDER: readonly StandardColourName[] = [
  'blue',
  'green',
  'orange',
  'violet',
  'teal',
  'pink',
  'red',
  'yellow',
  'grey',
];

const LABEL_ID = /^[A-Za-z0-9_-]{1,40}$/;
// C0, DEL and C1 controls, which no name keeps.
const hasControl = (text: string): boolean => {
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code <= 0x1f || (code >= 0x7f && code <= 0x9f)) return true;
  }
  return false;
};
const SPACES = /\s+/gu;

export const isLabelId = (v: unknown): v is string => typeof v === 'string' && LABEL_ID.test(v);

export function isLabelColour(v: unknown): v is LabelColour {
  return (
    (typeof v === 'string' && (STANDARD_COLOUR_NAMES as readonly string[]).includes(v)) ||
    isHexColour(v)
  );
}

/** A name as kept: NFC, trimmed, each run of white space one space; undefined when empty, too long, or holding a
 *  control character or a comma (a comma separates the labels of a search's scope). */
export function labelName(raw: unknown): string | undefined {
  if (typeof raw !== 'string' || hasControl(raw) || raw.includes(',')) return undefined;
  const name = raw.normalize('NFC').replace(SPACES, ' ').trim();
  return name.length > 0 && name.length <= LABEL_NAME_MAX ? name : undefined;
}

/** What two names are compared by: the same label whatever their case. */
export const labelKey = (name: string): string => name.normalize('NFKC').toLowerCase();

/** A new label's id: `lbl_` and ten random base-36 characters. */
export function newLabelId(random: () => number = Math.random): string {
  let id = 'lbl_';
  for (let i = 0; i < 10; i++) id += Math.floor(random() * 36).toString(36);
  return id;
}

/** The knowledgebase's labels as stored: valid entries only, the first of a repeated id or name kept, at most
 *  MAX_KNOWLEDGEBASE_LABELS. A colour is kept in lower case. */
export function parseKnowledgeLabels(v: unknown): KnowledgeLabel[] {
  if (!Array.isArray(v)) return [];
  const out: KnowledgeLabel[] = [];
  const ids = new Set<string>();
  const names = new Set<string>();
  for (const entry of v) {
    if (out.length === MAX_KNOWLEDGEBASE_LABELS) break;
    if (!entry || typeof entry !== 'object') continue;
    const raw = entry as Record<string, unknown>;
    const name = labelName(raw.name);
    if (!isLabelId(raw.id) || !name || !isLabelColour(raw.colour)) continue;
    const key = labelKey(name);
    if (ids.has(raw.id) || names.has(key)) continue;
    ids.add(raw.id);
    names.add(key);
    out.push({ id: raw.id, name, colour: raw.colour.toLowerCase() });
  }
  return out;
}

/** The ids a page carries as stored: ids only, no repeat, at most MAX_PAGE_LABELS, in their order. */
export function parseTabLabels(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  for (const id of v) {
    if (out.length === MAX_PAGE_LABELS) break;
    if (isLabelId(id) && !out.includes(id)) out.push(id);
  }
  return out;
}

const sameIds = (a: readonly unknown[], b: readonly string[]) =>
  a.length === b.length && a.every((x, i) => x === b[i]);

/** The tab as a reader takes it: its labels settled (none when nothing of them is valid). The same tab when there is
 *  nothing to settle, so a tab without labels costs one property read. */
export function withSettledLabels<T extends object>(tab: T): T {
  if (!('labels' in tab)) return tab;
  const stored = (tab as { labels?: unknown }).labels;
  const labels = parseTabLabels(stored);
  if (labels.length > 0 && Array.isArray(stored) && sameIds(stored, labels)) return tab;
  const { labels: _dropped, ...rest } = tab as T & { labels?: unknown };
  void _dropped;
  return (labels.length > 0 ? { ...rest, labels } : rest) as T;
}

/** Puts `ids` on a tab (none takes the field away); the same tab when nothing changes. */
export function withTabLabels<T extends object>(tab: T, ids: readonly string[]): T {
  const now = parseTabLabels((tab as { labels?: unknown }).labels);
  const next = parseTabLabels(ids);
  if (sameIds(now, next) && (next.length > 0 || !('labels' in tab))) return tab;
  const { labels: _gone, ...rest } = tab as T & { labels?: unknown };
  void _gone;
  return (next.length > 0 ? { ...rest, labels: next } : rest) as T;
}

/** The page's labels that exist, in the page's order. */
export function pageLabelsOf(ids: unknown, labels: readonly KnowledgeLabel[]): KnowledgeLabel[] {
  const list = parseTabLabels(ids);
  if (list.length === 0) return [];
  const byId = new Map(labels.map((l) => [l.id, l]));
  return list.flatMap((id) => {
    const label = byId.get(id);
    return label ? [label] : [];
  });
}

export type LabelChange =
  | { kind: 'add'; id: string; name: string; colour: LabelColour }
  | { kind: 'rename'; id: string; name: string }
  | { kind: 'recolour'; id: string; colour: LabelColour }
  | { kind: 'delete'; id: string };

export type LabelRefusal =
  | 'invalid_label_id'
  | 'invalid_label_name'
  | 'invalid_label_colour'
  | 'label_name_taken'
  | 'label_limit'
  | 'unknown_label';

/** What each refusal says, in words a person reads. */
export const LABEL_REFUSAL_WORDS: Record<LabelRefusal, string> = {
  invalid_label_id: 'A label id is 1 to 40 letters, digits, - or _.',
  invalid_label_name: `A label's name is 1 to ${LABEL_NAME_MAX} characters, with no comma.`,
  invalid_label_colour: "A label's colour is a standard colour's name or #rrggbb.",
  label_name_taken: 'A label is already called that.',
  label_limit: `This knowledgebase has ${MAX_KNOWLEDGEBASE_LABELS} labels, the most it can hold.`,
  unknown_label: 'That label is not in this knowledgebase.',
};

export type LabelChangeResult =
  { labels: KnowledgeLabel[]; label?: KnowledgeLabel } | { refusal: LabelRefusal };

const taken = (labels: readonly KnowledgeLabel[], name: string, except?: string) => {
  const key = labelKey(name);
  return labels.some((l) => l.id !== except && labelKey(l.name) === key);
};

/** A change to the knowledgebase's labels, judged strictly: the new list and the label it made or changed, or why
 *  not. The list given is never changed. */
export function applyLabelChange(
  labels: readonly KnowledgeLabel[],
  change: LabelChange,
): LabelChangeResult {
  if (!isLabelId(change.id)) return { refusal: 'invalid_label_id' };
  const at = labels.findIndex((l) => l.id === change.id);
  if (change.kind === 'add') {
    if (at >= 0) return { refusal: 'invalid_label_id' };
    const name = labelName(change.name);
    if (!name) return { refusal: 'invalid_label_name' };
    if (!isLabelColour(change.colour)) return { refusal: 'invalid_label_colour' };
    if (taken(labels, name)) return { refusal: 'label_name_taken' };
    if (labels.length >= MAX_KNOWLEDGEBASE_LABELS) return { refusal: 'label_limit' };
    const label = { id: change.id, name, colour: change.colour.toLowerCase() };
    return { labels: [...labels, label], label };
  }
  const was = labels[at];
  if (!was) return { refusal: 'unknown_label' };
  if (change.kind === 'delete') return { labels: labels.filter((l) => l.id !== change.id) };
  let label: KnowledgeLabel;
  if (change.kind === 'rename') {
    const name = labelName(change.name);
    if (!name) return { refusal: 'invalid_label_name' };
    if (taken(labels, name, change.id)) return { refusal: 'label_name_taken' };
    label = { ...was, name };
  } else {
    if (!isLabelColour(change.colour)) return { refusal: 'invalid_label_colour' };
    label = { ...was, colour: change.colour.toLowerCase() };
  }
  return { labels: labels.map((l) => (l.id === change.id ? label : l)), label };
}

/** How many pages carry each label, by id: one pass over the pages. */
export function labelPageCounts(pages: readonly { labels?: unknown }[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const page of pages) {
    if (!page.labels) continue;
    for (const id of parseTabLabels(page.labels)) counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return counts;
}

/** The labels most used first, then by name: the order the picker, the filter's menu and the api list them in. */
export function labelsByUse(
  labels: readonly KnowledgeLabel[],
  counts: ReadonlyMap<string, number>,
): KnowledgeLabel[] {
  return [...labels].sort(
    (a, b) =>
      (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0) ||
      a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }),
  );
}

/** The labels a scope names, each value an id or a name ignoring case: their ids, or the first value no label has. */
export function resolveLabels(
  labels: readonly KnowledgeLabel[],
  values: readonly string[],
): { ids: string[] } | { unknown: string } {
  const ids: string[] = [];
  for (const raw of values) {
    const value = raw.trim();
    if (!value) continue;
    const key = labelKey(value);
    const label =
      labels.find((l) => l.id === value) ?? labels.find((l) => labelKey(l.name) === key);
    if (!label) return { unknown: value };
    if (!ids.includes(label.id)) ids.push(label.id);
  }
  return { ids };
}

/** The pages carrying any of `ids`: one pass over the pages. */
export function pagesLabelled(
  pages: readonly { id: string; labels?: unknown }[],
  ids: readonly string[],
): Set<string> {
  const out = new Set<string>();
  if (ids.length === 0) return out;
  const wanted = new Set(ids);
  for (const page of pages) {
    if (!page.labels) continue;
    if (parseTabLabels(page.labels).some((id) => wanted.has(id))) out.add(page.id);
  }
  return out;
}

/** A new label's colour: the first of LABEL_COLOUR_ORDER no label has, else round the order again. */
export function nextLabelColour(labels: readonly KnowledgeLabel[]): StandardColourName {
  const used = new Set(labels.map((l) => l.colour));
  return (
    LABEL_COLOUR_ORDER.find((c) => !used.has(c)) ??
    LABEL_COLOUR_ORDER[labels.length % LABEL_COLOUR_ORDER.length]!
  );
}
