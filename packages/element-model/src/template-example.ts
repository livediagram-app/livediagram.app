// A template's example content (liveworkspace/docs/specs/002-architecture/blueprints/template-examples.md): the
// values a person-picked template lands with to show how its board is used (a sticky's text, a checklist's rows and
// ticks, a table's body cells, a chart's numbers), marked as they land so Clear Example Content can empty exactly
// those and nothing a person wrote.
//
// The mark is a fingerprint of the element's example values, not a bare flag: an element still holding the values it
// landed with matches its mark, and any change to them (typed text, a tick, an edited cell, from any editor path, an
// agent or a peer) breaks the match, so no edit path has to remember to clear a flag. Structure (headings, a table's
// header row and column, lanes, quadrant titles, the template note, shape labels) is never marked, so it stays.
//
// Generic over each product's element union: every function reads the fields structurally and hands the caller's own
// element type back.

/** The field an element carries its mark in. */
export const TEMPLATE_EXAMPLE_FIELD = 'templateExample';

type ChecklistRow = { readonly text: string; readonly done: boolean };
type Slice = { readonly label: string; readonly value: number };
type Series = { readonly name: string; readonly values: readonly number[] };

// The fields an example is read from, as any product stores them.
type ExampleFields = {
  type: string;
  locked?: boolean;
  templateExample?: string;
  label?: string;
  richText?: unknown;
  checklistItems?: readonly ChecklistRow[];
  cells?: readonly (readonly string[])[];
  headerRow?: boolean;
  headerColumn?: boolean;
  pieSlices?: readonly Slice[];
  lineSeries?: readonly Series[];
};

const fieldsOf = (el: { type: string }) => el as ExampleFields;

// A table's body: every cell outside its header row and header column, which are structure.
function bodyCells(el: ExampleFields): string[] {
  const top = el.headerRow ? 1 : 0;
  const left = el.headerColumn ? 1 : 0;
  const out: string[] = [];
  const rows = el.cells ?? [];
  for (let r = top; r < rows.length; r++) {
    const row = rows[r]!;
    for (let c = left; c < row.length; c++) out.push(row[c]!);
  }
  return out;
}

/**
 * The example values an element holds, as one string, or null when it holds none: a sticky's text, a checklist's rows
 * and ticks, a table's body cells, a chart's numbers. Empty values are none, so a blank sticky or an empty table is
 * never an example.
 */
export function exampleValuesOf<E extends { type: string }>(el: E): string | null {
  const f = fieldsOf(el);
  if (f.type === 'sticky') return f.label?.trim() ? `s${f.label}` : null;
  if (f.type === 'table') {
    const body = bodyCells(f);
    return body.some((cell) => cell.trim() !== '') ? `t${JSON.stringify(body)}` : null;
  }
  if (f.type !== 'shape') return null;
  if (f.checklistItems?.some((row) => row.text.trim() !== '' || row.done)) {
    return `c${JSON.stringify(f.checklistItems.map((row) => [row.text, row.done]))}`;
  }
  const slices = f.pieSlices?.map((s) => s.value) ?? [];
  const series = f.lineSeries?.map((s) => s.values) ?? [];
  if (slices.some((v) => v !== 0) || series.some((vs) => vs.some((v) => v !== 0))) {
    return `g${JSON.stringify([slices, series])}`;
  }
  return null;
}

// FNV-1a over the UTF-16 code units, in base 36: short, stable, and cheap enough to run over a whole tab per render.
function fingerprint(values: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < values.length; i++) {
    hash ^= values.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

/** Marks every element holding example values with their fingerprint; the rest come back as they were. */
export function markTemplateExamples<E extends { type: string }>(elements: readonly E[]): E[] {
  return elements.map((el) => {
    const values = exampleValuesOf(el);
    return values === null ? el : { ...el, [TEMPLATE_EXAMPLE_FIELD]: fingerprint(values) };
  });
}

/** Whether an element still holds the example values it was marked with (nobody has changed them). */
export function isUntouchedExample<E extends { type: string }>(el: E): boolean {
  const mark = fieldsOf(el).templateExample;
  if (typeof mark !== 'string') return false;
  const values = exampleValuesOf(el);
  return values !== null && fingerprint(values) === mark;
}

/** How many elements still hold their template's example values: what Clear Example Content would empty. */
export function untouchedExampleCount<E extends { type: string }>(elements: readonly E[]): number {
  let count = 0;
  for (const el of elements) if (isUntouchedExample(el)) count++;
  return count;
}

// Answers per elements array: an editor's commit makes a new one, so a render or a store read between commits asks
// again for free.
const untouchedCache = new WeakMap<readonly object[], boolean>();

// Elements whose mark no longer matches (a person changed their values), remembered per element object: an edit makes a
// new object, so a changed example is fingerprinted once rather than on every commit after it, and a tab whose
// examples were all changed but never cleared or kept rescans only cheap lookups. Only the broken verdict is
// remembered, never an untouched one, so Clear Example Content always re-checks what it empties.
const brokenMarks = new WeakSet<object>();

function isUntouchedExampleOnce(el: { type: string }): boolean {
  if (typeof fieldsOf(el).templateExample !== 'string' || brokenMarks.has(el)) return false;
  if (isUntouchedExample(el)) return true;
  brokenMarks.add(el);
  return false;
}

/** Whether a tab's elements still hold any untouched example: whether an Editor is offered Clear Example Content. */
export function hasUntouchedExamples<E extends { type: string }>(elements: readonly E[]): boolean {
  const known = untouchedCache.get(elements);
  if (known !== undefined) return known;
  const answer = elements.some(isUntouchedExampleOnce);
  untouchedCache.set(elements, answer);
  return answer;
}

const hasMark = (el: { type: string }) => TEMPLATE_EXAMPLE_FIELD in el;

function withoutMark<E extends { type: string }>(el: E): E {
  const { [TEMPLATE_EXAMPLE_FIELD]: _mark, ...rest } = el as E & { templateExample?: string };
  return rest as E;
}

// An element with its example values emptied and its mark gone; everything else (place, size, look, header cells,
// row count, a chart's names) kept.
function emptied<E extends { type: string }>(el: E): E {
  const f = fieldsOf(el);
  const base = withoutMark(el) as E & ExampleFields;
  if (f.type === 'sticky') {
    const { richText: _runs, ...rest } = base;
    return { ...rest, label: '' } as unknown as E;
  }
  if (f.type === 'table') {
    const top = f.headerRow ? 1 : 0;
    const left = f.headerColumn ? 1 : 0;
    // Untouched, so it holds a body: its cells are there.
    const cells = f.cells!.map((row, r) =>
      r < top ? row : row.map((cell, c) => (c < left ? cell : '')),
    );
    return { ...base, cells };
  }
  if (f.checklistItems?.length) {
    return { ...base, checklistItems: f.checklistItems.map(() => ({ text: '', done: false })) };
  }
  return {
    ...base,
    ...(f.pieSlices ? { pieSlices: f.pieSlices.map((s) => ({ ...s, value: 0 })) } : {}),
    ...(f.lineSeries
      ? { lineSeries: f.lineSeries.map((s) => ({ ...s, values: s.values.map(() => 0) })) }
      : {}),
  };
}

/**
 * Clear Example Content: every unlocked element still holding its example values is emptied, and every mark goes
 * (an element a person changed keeps what it holds, and a locked one is left as it is). Elements without a mark come
 * back as the same objects. `cleared` is how many were emptied.
 */
export function clearTemplateExamples<E extends { type: string }>(
  elements: readonly E[],
): { elements: E[]; cleared: number } {
  let cleared = 0;
  const next = elements.map((el) => {
    if (!hasMark(el)) return el;
    if (isUntouchedExample(el) && fieldsOf(el).locked !== true) {
      cleared++;
      return emptied(el);
    }
    return withoutMark(el);
  });
  return { elements: next, cleared };
}

/** Keep It: every mark goes, so the example values are the person's own from now on. */
export function keepTemplateExamples<E extends { type: string }>(elements: readonly E[]): E[] {
  return elements.map((el) => (hasMark(el) ? withoutMark(el) : el));
}

type TabOf<E> = { id: string; elements: E[] };

// One tab's elements through `change`, every other tab (and a tab with no mark) the same object, so the editor's
// commit sees only the tab it changed.
function onTab<E extends { type: string }, T extends TabOf<E>>(
  tabs: readonly T[],
  tabId: string,
  change: (elements: readonly E[]) => E[],
): T[] {
  return tabs.map((tab) =>
    tab.id === tabId && tab.elements.some(hasMark)
      ? { ...tab, elements: change(tab.elements) }
      : tab,
  );
}

/** Clear Example Content on one tab, for an editor's commit (one undo step). */
export function clearTabExamples<E extends { type: string }, T extends TabOf<E>>(
  tabs: readonly T[],
  tabId: string,
): T[] {
  return onTab<E, T>(tabs, tabId, (elements) => clearTemplateExamples(elements).elements);
}

/** Keep It on one tab, for an editor's commit (one undo step). */
export function keepTabExamples<E extends { type: string }, T extends TabOf<E>>(
  tabs: readonly T[],
  tabId: string,
): T[] {
  return onTab<E, T>(tabs, tabId, keepTemplateExamples);
}
