// A drafted page's unused slots (docs/specs/007-editor/describe-a-page.md "Every kind", Describe a Page): the api writes "" into a slot
// the content does not need (four figures on a layout of six), and the page drops it rather than keep the layout's
// sample. The engine writes words in, never takes elements out, so the slot is first marked (a mark nobody types),
// written in by the engine as any words, then taken off here: the text, its bullet dot, the card it sat in once the
// card holds no other words (with the icon or rule inside it), and a compound element's stat, step or row.
import { partsOf } from '@liveworkspace/edit-operations/layout-slots';
import type { LayoutText } from '@liveworkspace/edit-operations/layout-slots';
import type { Element, Tab } from '@livedocuments/document';

// Two invisible separators: never in a person's or a model's words.
export const DROPPED_SLOT = '⁣⁣';

/** The draft's words with each empty slot marked for dropping (a table is written as given). */
export function markDropped(text: LayoutText): LayoutText {
  const mark = (t: string) => (t.trim() === '' ? DROPPED_SLOT : t);
  const out: LayoutText = { ...text };
  if (text.title !== undefined) out.title = mark(text.title);
  if (text.subtitle !== undefined) out.subtitle = mark(text.subtitle);
  for (const name of ['bullets', 'body', 'figures'] as const)
    if (text[name]) out[name] = text[name].map(mark);
  return out;
}

type Box = { x: number; y: number; width: number; height: number };
type Loose = Element & Record<string, unknown>;

const boxOf = (el: Loose): Box | null =>
  typeof el.x === 'number' && typeof el.y === 'number'
    ? {
        x: el.x,
        y: el.y,
        width: typeof el.width === 'number' ? el.width : 0,
        height: typeof el.height === 'number' ? el.height : 0,
      }
    : null;
const centreIn = (inner: Box, outer: Box) => {
  const cx = inner.x + inner.width / 2;
  const cy = inner.y + inner.height / 2;
  return (
    cx >= outer.x && cx <= outer.x + outer.width && cy >= outer.y && cy <= outer.y + outer.height
  );
};
const within = (inner: Box, outer: Box) =>
  inner.x >= outer.x &&
  inner.y >= outer.y &&
  inner.x + inner.width <= outer.x + outer.width &&
  inner.y + inner.height <= outer.y + outer.height;
const isMark = (v: unknown) => v === DROPPED_SLOT;
const hasWords = (el: Loose) =>
  (typeof el.label === 'string' && el.label.trim() !== '' && !isMark(el.label)) ||
  partsOf(el).some((p) => !isMark(p.text));
const plainShape = (el: Loose) => el.type === 'shape' && !hasWords(el) && partsOf(el).length === 0;

// A compound element's rows with the marked ones taken out, a half-marked row's mark cleared; null when none is left.
// Called only for an element with a marked part, so something always changes.
function withoutMarkedParts(el: Loose): Loose | null {
  const rows = (field: string, keep: (row: unknown) => unknown) => {
    const v = el[field];
    if (!Array.isArray(v)) return undefined;
    return v.flatMap((row) => {
      const kept = keep(row);
      return kept === null ? [] : [kept];
    });
  };
  const keyed =
    (main: string, other?: string) =>
    (row: unknown): unknown => {
      if (!row || typeof row !== 'object') return row;
      const r = row as Record<string, unknown>;
      if (isMark(r[main]) && (!other || isMark(r[other]) || !r[other])) return null;
      const out = { ...r };
      let cleared = false;
      for (const key of [main, other])
        if (key && isMark(out[key])) {
          out[key] = '';
          cleared = true;
        }
      return cleared ? out : row;
    };
  const next: Loose = { ...el };
  const stats = rows('stats', keyed('value', 'caption'));
  const steps = rows('processSteps', (row) => (isMark(row) ? null : row));
  const checks = rows('checklistItems', keyed('text'));
  const concepts = rows('conceptRows', keyed('label', 'note'));
  if (stats) next.stats = stats;
  if (steps) next.processSteps = steps;
  if (checks) next.checklistItems = checks;
  if (concepts) next.conceptRows = concepts;
  const left = [stats, steps, checks, concepts].some((r) => r && r.length > 0);
  return left ? next : null;
}

/** The tab with every marked slot taken off: its text, its dot, its card once empty, and the card's own marks. */
export function withoutDroppedSlots(tab: Tab): Tab {
  const elements = tab.elements as Loose[];
  const removed = new Set<string>();
  const updated = new Map<string, Loose>();
  const gone: Box[] = [];
  elements.forEach((el, i) => {
    if (isMark(el.label) && !partsOf(el).length) {
      removed.add(el.id);
      const box = boxOf(el);
      if (box) gone.push(box);
      // A bullet's dot: the empty circle set just before its line.
      const dot = elements[i - 1];
      const dotBox = dot ? boxOf(dot) : null;
      if (
        dot &&
        dotBox &&
        box &&
        dot.shape === 'circle' &&
        plainShape(dot) &&
        dotBox.height < box.height
      )
        removed.add(dot.id);
      return;
    }
    if (partsOf(el).some((p) => isMark(p.text))) {
      const next = withoutMarkedParts(el);
      if (next) updated.set(el.id, next);
      else {
        removed.add(el.id);
        const box = boxOf(el);
        if (box) gone.push(box);
      }
    } else if (isMark(el.label)) {
      updated.set(el.id, { ...el, label: '' });
    }
  });
  if (removed.size === 0 && updated.size === 0) return tab;
  // A card a dropped text sat in, once no words are left in it: it goes, with what is drawn inside it.
  const worded = elements.filter((el) => !removed.has(el.id) && hasWords(updated.get(el.id) ?? el));
  for (const card of elements) {
    const box = boxOf(card);
    if (!box || removed.has(card.id) || !plainShape(card)) continue;
    if (!gone.some((g) => centreIn(g, box))) continue;
    if (worded.some((w) => w.id !== card.id && boxOf(w) && centreIn(boxOf(w)!, box))) continue;
    removed.add(card.id);
    for (const inner of elements) {
      const b = boxOf(inner);
      if (inner.id !== card.id && b && within(b, box) && !hasWords(inner)) removed.add(inner.id);
    }
  }
  return {
    ...tab,
    elements: elements.flatMap((el) =>
      removed.has(el.id) ? [] : [updated.get(el.id) ?? el],
    ) as Tab['elements'],
  };
}
