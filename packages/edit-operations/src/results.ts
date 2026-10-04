// What a changeset did, one line per element (docs/specs/024-agents/blueprints/edit-operations.md
// "Result lines"): `+ ~ -` in the order operations first touched each element, then warnings.
// Coordinates are stored ones, rounded; an element's ref is its id. An element an operation touched
// that ends as it began prints nothing (E1), and so does one created and removed again (E2).

import type { EditWarning, FieldChange, JsonValue, ResultLine } from '@livediagram/api-schema';
import {
  quickSwatches,
  type ArrowElement,
  type Element,
  type ElementId,
  type ThemeDefinition,
} from '@livediagram/document';
import type { Fit } from './labels';
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

const aliasesWriting = (key: string) =>
  Object.entries(ALIAS_FIELDS)
    .filter(([, stored]) => stored.includes(key))
    .map(([alias]) => alias);

// The place of a change in its line: fields in the order operations wrote them (a position where
// its x or y was written), then the rest in the element's own key order.
function rankOf(change: FieldChange, written: readonly string[]): number {
  const keys = change.key === 'at' ? ['x', 'y'] : [change.key, ...aliasesWriting(change.key)];
  const ranks = keys.map((key) => written.indexOf(key)).filter((rank) => rank >= 0);
  return ranks.length ? Math.min(...ranks) : written.length;
}

// The stored fields an alias writes, so a ~ line prints the change under the name the agent used.
const ALIAS_FIELDS: Readonly<Record<string, readonly string[]>> = {
  fill: ['fillColor', 'fillSwatch'],
  text: ['textSize'],
  line: ['arrowStyle'],
};

// A fill as it reads: its slot's name when bound to one, else the colour.
function fillValue(el: Element, theme: ThemeDefinition): JsonValue | undefined {
  const slot = Reflect.get(el, 'fillSwatch');
  const swatch = quickSwatches(theme, 'fill').find((s) => s.slot !== 0 && s.slot === slot);
  if (swatch) return swatch.name.toLowerCase().replace(/\s+/g, '-');
  const colour = Reflect.get(el, 'fillColor');
  return typeof colour === 'string' ? colour : undefined;
}

// Changes under the aliases written, and fit to label as `widened` / `taller`.
function aliasChanges(
  changes: FieldChange[],
  prev: Element,
  cur: Element,
  touched: { written: readonly string[]; fit?: Fit },
  theme: ThemeDefinition,
): FieldChange[] {
  let out = changes;
  for (const [alias, stored] of Object.entries(ALIAS_FIELDS)) {
    if (!touched.written.includes(alias)) continue;
    const index = out.findIndex((c) => stored.includes(c.key));
    if (index < 0) continue;
    const renamed: FieldChange =
      alias === 'fill'
        ? {
            key: 'fill',
            ...defined('from', fillValue(prev, theme)),
            ...defined('to', fillValue(cur, theme)),
          }
        : { ...out[index]!, key: alias };
    out = [
      ...out.slice(0, index),
      renamed,
      ...out.slice(index + 1).filter((c) => !stored.includes(c.key)),
    ];
  }
  const { fit } = touched;
  if (!fit) return out;
  const named = touched.written.some((key) => key === 'x' || key === 'y');
  out = out.filter(
    (c) =>
      !(c.key === 'width' && fit.widened) &&
      !(c.key === 'height' && fit.taller) &&
      !(c.key === 'at' && !named),
  );
  if (fit.widened) out.push({ key: 'widened', from: fit.widened[0], to: fit.widened[1] });
  if (fit.taller) out.push({ key: 'taller', from: fit.taller[0], to: fit.taller[1] });
  return out;
}

const defined = (key: 'from' | 'to', value: JsonValue | undefined) =>
  value === undefined ? {} : { [key]: value };

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
  touched: ReadonlyMap<ElementId, { written: readonly string[]; fit?: Fit }>;
  removed: ReadonlyMap<ElementId, Removal>;
  warnings: readonly EditWarning[];
  theme: ThemeDefinition;
};

export function buildResultLines(source: ResultSource, next: readonly Element[]): ResultLine[] {
  const after = new Map(next.map((el) => [el.id, el]));
  const lines: ResultLine[] = [];
  for (const [id, touched] of source.touched) {
    const { written } = touched;
    const [prev, cur] = [source.before.get(id), after.get(id)];
    if (cur && !prev) lines.push(addedLine(cur));
    else if (prev && !cur) lines.push(removedLine(prev, source.removed.get(id)));
    else if (prev && cur) {
      const changes = aliasChanges(
        fieldChanges(prev, cur, written),
        prev,
        cur,
        touched,
        source.theme,
      );
      if (changes.length) lines.push({ mark: '~', ref: id, changes });
    }
  }
  return [...lines, ...source.warnings.map((warning) => ({ mark: '!' as const, warning }))];
}
