// What a changeset did, one line per element (docs/specs/024-agents/blueprints/edit-operations.md
// "Result lines", EO42): `+ ~ -` in the order operations first touched each element, then warnings. Elements
// print by ref (a removed one by its ref in the input tab); coordinates are rounded and relative to the
// content origin. An element touched that ends as it began prints nothing (E1), and so does one
// created and removed again (E2).

import type { EditWarning, FieldChange, JsonValue, ResultLine } from '@liveplanner/api-schema';
import { computeRefs, type Element, type ElementId } from '@liveplanner/project';
import { kindOf, labelOf } from './element-text';
import { sameValue as same } from './equality';
import type { Touch } from './state';

// How a result names elements and places points: by ref, relative to the content origin.
type LineNaming = { refOf: (id: ElementId) => string; origin: { x: number; y: number } };

const pointIn = (naming: LineNaming, x: number, y: number): [number, number] => [
  Math.round(x - naming.origin.x),
  Math.round(y - naming.origin.y),
];
const size = (w: number, h: number): [number, number] => [Math.round(w), Math.round(h)];

// A box's place and size; an element without one (none a Plan tab holds) has neither.
function boxOf(el: Element): { x: number; y: number; width: number; height: number } | null {
  return el.type === 'arrow' ? null : el;
}

// The `+` line of a new element.
export function addedLine(el: Element, naming: LineNaming): Extract<ResultLine, { mark: '+' }> {
  const label = labelOf(el);
  const box = boxOf(el);
  return {
    mark: '+',
    ref: naming.refOf(el.id),
    kind: kindOf(el),
    ...(label ? { label } : {}),
    ...(box ? { at: pointIn(naming, box.x, box.y), size: size(box.width, box.height) } : {}),
  };
}

// The `-` line of a removed element.
export function removedLine(el: Element, naming: LineNaming): ResultLine {
  const label = labelOf(el);
  return { mark: '-', ref: naming.refOf(el.id), kind: kindOf(el), ...(label ? { label } : {}) };
}

// Keys a change line prints its own way, or not at all.
const PLACED_KEYS: ReadonlySet<string> = new Set(['id', 'type', 'x', 'y']);

// The place of a change in its line: fields in the order operations wrote them (a position where
// its x or y was written), then the rest in the element's own key order.
function rankOf(change: FieldChange, written: readonly string[]): number {
  const keys = change.key === 'at' ? ['x', 'y'] : [change.key];
  const ranks = keys.map((key) => written.indexOf(key)).filter((rank) => rank >= 0);
  return ranks.length ? Math.min(...ranks) : written.length;
}

function fieldChanges(
  prev: Element,
  cur: Element,
  written: readonly string[],
  naming: LineNaming,
): FieldChange[] {
  const changes: FieldChange[] = [];
  const [was, now] = [boxOf(prev), boxOf(cur)];
  if (was && now && (was.x !== now.x || was.y !== now.y))
    changes.push({
      key: 'at',
      from: pointIn(naming, was.x, was.y),
      to: pointIn(naming, now.x, now.y),
    });
  const before = prev as unknown as Record<string, JsonValue | undefined>;
  const after = cur as unknown as Record<string, JsonValue | undefined>;
  for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
    if (PLACED_KEYS.has(key) || same(before[key], after[key])) continue;
    changes.push({
      key,
      ...(before[key] !== undefined ? { from: before[key] } : {}),
      ...(after[key] !== undefined ? { to: after[key] } : {}),
    });
  }
  return changes
    .map((change, index) => ({ change, index, rank: rankOf(change, written) }))
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map(({ change }) => change);
}

type ResultSource = {
  before: ReadonlyMap<ElementId, Element>;
  // The input tab's elements, in order.
  beforeElements: readonly Element[];
  // Ids in the order operations first touched them, with the fields they wrote.
  touched: ReadonlyMap<ElementId, Omit<Touch, 'operation'>>;
  warnings: readonly EditWarning[];
  origin: { x: number; y: number };
};

// An element's ref in the next tab, or in the input tab when it is gone.
export function lineNaming(
  beforeElements: readonly Element[],
  next: readonly Element[],
  origin: { x: number; y: number },
): LineNaming {
  const after = computeRefs(next.map((el) => el.id));
  const before = computeRefs(beforeElements.map((el) => el.id));
  const present = new Set(next.map((el) => el.id));
  return { refOf: (id) => (present.has(id) ? after.refOf(id) : before.refOf(id)), origin };
}

export function buildResultLines(source: ResultSource, next: readonly Element[]): ResultLine[] {
  const after = new Map(next.map((el) => [el.id, el]));
  const naming = lineNaming(source.beforeElements, next, source.origin);
  const lines: ResultLine[] = [];
  for (const [id, { written }] of source.touched) {
    const [prev, cur] = [source.before.get(id), after.get(id)];
    if (cur && !prev) lines.push(addedLine(cur, naming));
    else if (prev && !cur) lines.push(removedLine(prev, naming));
    else if (prev && cur) {
      const changes = fieldChanges(prev, cur, written, naming);
      if (changes.length) lines.push({ mark: '~', ref: naming.refOf(id), changes });
    }
  }
  return [...lines, ...source.warnings.map((warning) => ({ mark: '!' as const, warning }))];
}
