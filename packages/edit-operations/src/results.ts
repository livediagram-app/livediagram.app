// What a changeset did, one line per element (docs/specs/024-agents/blueprints/edit-operations.md
// "Result lines"): `+ ~ -` in the order operations first touched each element, then warnings.
// Coordinates are stored ones, rounded; an element's ref is its id. An element an operation touched
// that ends as it began prints nothing (E1), and so does one created and removed again (E2).

import type { EditWarning, FieldChange, JsonValue, ResultLine } from '@livediagram/api-schema';
import type { ArrowElement, Element, ElementId } from '@livediagram/document';
import { endRef, kindOf, labelOf } from './element-text';
import { sameValue as same } from './equality';
import type { Removal } from './state';

const point = (x: number, y: number): [number, number] => [Math.round(x), Math.round(y)];

// The `+` line of a new element.
export function addedLine(el: Element): ResultLine {
  const label = labelOf(el);
  const common = { mark: '+' as const, ref: el.id, kind: kindOf(el), ...(label ? { label } : {}) };
  return el.type === 'arrow'
    ? { ...common, ends: [endRef(el.from), endRef(el.to)] }
    : { ...common, at: point(el.x, el.y), size: point(el.width, el.height) };
}

// The `-` line of a removed element, noting the element it was pinned to when it went with one.
export function removedLine(el: Element, removal: Removal = {}): ResultLine {
  const label = labelOf(el);
  return {
    mark: '-',
    ref: el.id,
    kind: kindOf(el),
    ...(label ? { label } : {}),
    ...(el.type === 'arrow' ? { ends: [endRef(el.from), endRef(el.to)] as [string, string] } : {}),
    ...(removal.pinnedTo ? { reason: 'pinned' as const, pinnedTo: removal.pinnedTo } : {}),
  };
}

// An arrow end as a change prints it: the element it is attached to, or the point of a free end.
const endValue = (arrow: ArrowElement, end: 'from' | 'to'): JsonValue => {
  const ep = arrow[end];
  return ep.kind === 'free' ? point(ep.x, ep.y) : endRef(ep);
};

// Keys a change line prints its own way, or not at all.
const PLACED_KEYS: ReadonlySet<string> = new Set(['id', 'type', 'x', 'y', 'from', 'to']);

// The place of a change in its line: fields in the order operations wrote them (a position where
// its x or y was written), then the rest in the element's own key order.
function rankOf(change: FieldChange, written: readonly string[]): number {
  const keys = change.key === 'at' ? ['x', 'y'] : [change.key];
  const ranks = keys.map((key) => written.indexOf(key)).filter((rank) => rank >= 0);
  return ranks.length ? Math.min(...ranks) : written.length;
}

function fieldChanges(prev: Element, cur: Element, written: readonly string[]): FieldChange[] {
  const changes: FieldChange[] = [];
  if (prev.type !== 'arrow' && cur.type !== 'arrow' && (prev.x !== cur.x || prev.y !== cur.y))
    changes.push({ key: 'at', from: point(prev.x, prev.y), to: point(cur.x, cur.y) });
  if (prev.type === 'arrow' && cur.type === 'arrow')
    for (const end of ['from', 'to'] as const) {
      const [from, to] = [endValue(prev, end), endValue(cur, end)];
      if (!same(from, to)) changes.push({ key: end, from, to });
    }
  const was = prev as unknown as Record<string, JsonValue | undefined>;
  const now = cur as unknown as Record<string, JsonValue | undefined>;
  for (const key of new Set([...Object.keys(was), ...Object.keys(now)])) {
    if (PLACED_KEYS.has(key) || same(was[key], now[key])) continue;
    changes.push({
      key,
      ...(was[key] !== undefined ? { from: was[key] } : {}),
      ...(now[key] !== undefined ? { to: now[key] } : {}),
    });
  }
  return changes
    .map((change, index) => ({ change, index, rank: rankOf(change, written) }))
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map(({ change }) => change);
}

export type ResultSource = {
  before: ReadonlyMap<ElementId, Element>;
  // Ids in the order operations first touched them, with the fields they wrote.
  touched: ReadonlyMap<ElementId, { written: readonly string[] }>;
  removed: ReadonlyMap<ElementId, Removal>;
  warnings: readonly EditWarning[];
};

export function buildResultLines(source: ResultSource, next: readonly Element[]): ResultLine[] {
  const after = new Map(next.map((el) => [el.id, el]));
  const lines: ResultLine[] = [];
  for (const [id, { written }] of source.touched) {
    const [prev, cur] = [source.before.get(id), after.get(id)];
    if (cur && !prev) lines.push(addedLine(cur));
    else if (prev && !cur) lines.push(removedLine(prev, source.removed.get(id)));
    else if (prev && cur) {
      const changes = fieldChanges(prev, cur, written);
      if (changes.length) lines.push({ mark: '~', ref: id, changes });
    }
  }
  return [...lines, ...source.warnings.map((warning) => ({ mark: '!' as const, warning }))];
}
