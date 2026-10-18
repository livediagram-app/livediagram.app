// The diagram key (docs/specs/009-elements/diagram-key.md, blueprint diagram-key.md): a legend whose rows are what the
// tab uses (its arrows' line patterns, then its tag colours), each with a meaning the author types. The rows are
// derived at the commit point and stored on the key (`keyRows`), so every reader draws them without re-deriving.
//
// A LEAF module: types only from './index'.

import type { Element, ShapeElement } from './index';
import type { LayoutRect } from './web-components';
import { tagKey, type TagColour } from './tag-colours';

export type KeyRow = {
  id: string;
  kind: 'line' | 'tag';
  // A line row's pattern (an arrow's `strokeStyle`), or a tag row's tag and colour.
  style?: string;
  tag?: string;
  color?: string;
};

const KEY_ROWS_MAX = 12;
export const KEY_ROW_H = 28;
const KEY_TITLE_H = 32;
export const KEY_PAD = 8;
export const KEY_MEANING_MAX = 60;
export const KEY_MEANINGS_MAX = 24;

function isDiagramKey(el: Element): el is ShapeElement & { shape: 'diagram-key' } {
  return el.type === 'shape' && el.shape === 'diagram-key';
}

/** The rows a tab's key lists: one per line pattern its arrows use (in the order they first appear), then one per
 *  tag colour; at most twelve. */
export function keyRowsOf(
  elements: readonly Element[],
  tagColours?: readonly TagColour[],
): KeyRow[] {
  const rows: KeyRow[] = [];
  const seen = new Set<string>();
  for (const el of elements) {
    if (el.type !== 'arrow') continue;
    const style = (el as { strokeStyle?: string }).strokeStyle ?? 'solid';
    const id = `line:${style}`;
    if (seen.has(id)) continue;
    seen.add(id);
    rows.push({ id, kind: 'line', style });
  }
  for (const r of tagColours ?? []) {
    const id = `tag:${tagKey(r.tag)}`;
    if (seen.has(id)) continue;
    seen.add(id);
    rows.push({ id, kind: 'tag', tag: r.tag, color: r.color });
  }
  return rows.slice(0, KEY_ROWS_MAX);
}

/** The key's height for `n` rows (an empty key keeps room for its one hint row). */
export function diagramKeyHeight(n: number): number {
  return KEY_TITLE_H + Math.max(1, n) * KEY_ROW_H + KEY_PAD;
}

const sameRows = (a: readonly KeyRow[] | undefined, b: readonly KeyRow[]) =>
  !!a &&
  a.length === b.length &&
  a.every(
    (r, i) =>
      r.id === b[i]!.id &&
      r.style === b[i]!.style &&
      r.tag === b[i]!.tag &&
      r.color === b[i]!.color,
  );

/** Every key on the tab with its rows re-derived and its height fitted to them; the same array when no key changed. */
export function settleDiagramKeys(
  elements: Element[],
  tagColours?: readonly TagColour[],
): Element[] {
  if (!elements.some(isDiagramKey)) return elements;
  const rows = keyRowsOf(elements, tagColours);
  const height = diagramKeyHeight(rows.length);
  let changed = false;
  const out = elements.map((el) => {
    if (!isDiagramKey(el)) return el;
    if (sameRows(el.keyRows, rows) && el.height === height) return el;
    changed = true;
    return { ...el, keyRows: rows, height };
  });
  return changed ? out : elements;
}

const PATTERN_NAME: Record<string, string> = {
  solid: 'Solid',
  dashed: 'Dashed',
  dotted: 'Dotted',
  'dash-dot': 'Dash-dot',
  'long-dash': 'Long dash',
  'dash-dot-dot': 'Dash-dot-dot',
};

/** What a row says: the author's meaning, else its starting one ("Dashed line", or the tag as the map writes it). */
export function meaningOf(el: ShapeElement, row: KeyRow): string {
  const own = el.keyMeanings?.[row.id];
  if (own) return own;
  if (row.kind === 'tag') return row.tag ?? '';
  return `${PATTERN_NAME[row.style ?? 'solid'] ?? row.style} line`;
}

/** The key with a row's meaning written (trimmed, bounded); an empty text clears it. Past 24 meanings, the oldest whose
 *  row the key no longer lists is dropped. */
export function withKeyMeaning<T extends Element>(el: T, rowId: string, text: string): T {
  if (!isDiagramKey(el)) return el;
  const clean = text.replace(/\s+/g, ' ').trim().slice(0, KEY_MEANING_MAX);
  const next: Record<string, string> = { ...(el.keyMeanings ?? {}) };
  if (clean) next[rowId] = clean;
  else delete next[rowId];
  const live = new Set((el.keyRows ?? []).map((r) => r.id));
  const ids = Object.keys(next);
  for (const id of ids) {
    if (Object.keys(next).length <= KEY_MEANINGS_MAX) break;
    if (!live.has(id) && id !== rowId) delete next[id];
  }
  if (Object.keys(next).length === 0) {
    const { keyMeanings: _gone, ...rest } = el;
    return rest as T;
  }
  return { ...el, keyMeanings: next };
}

type DiagramKeyLayout = {
  title: LayoutRect;
  rows: { swatch: LayoutRect; meaning: LayoutRect }[];
};

/** Where the title and each row's swatch and meaning sit, for `n` rows across `w`. */
export function diagramKeyLayout(w: number, n: number): DiagramKeyLayout {
  return {
    title: { x: 12, y: 8, width: Math.max(0, w - 24), height: 20 },
    rows: Array.from({ length: Math.max(1, n) }, (_, i) => {
      const y = KEY_TITLE_H + i * KEY_ROW_H;
      return {
        swatch: { x: 12, y: y + 4, width: 40, height: 20 },
        meaning: { x: 64, y, width: Math.max(0, w - 76), height: KEY_ROW_H },
      };
    }),
  };
}

/** The hint an empty key shows in place of rows. */
export const KEY_EMPTY_HINT = 'Your line styles show here';
