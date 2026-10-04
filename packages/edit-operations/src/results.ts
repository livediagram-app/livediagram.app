// What a changeset did, one line per element (docs/specs/024-agents/blueprints/edit-operations.md
// "Result lines", EO42): `+ ~ -` in the order operations first touched each element, then `»` lines for
// what moved without being named, then each container whose members changed, then warnings. Elements
// print by ref (a removed one by its ref in the input tab); coordinates are rounded and relative to the
// content origin. An element touched that ends as it began prints nothing (E1), and so does one
// created and removed again (E2).

import type { EditWarning, FieldChange, JsonValue, ResultLine } from '@livediagram/api-schema';
import {
  computeRefs,
  deriveContainers,
  quickSwatches,
  type ArrowElement,
  type Element,
  type ElementId,
  type ThemeDefinition,
} from '@livediagram/document';
import type { Fit } from './labels';
import { endRef, kindOf, labelOf } from './element-text';
import { sameValue as same } from './equality';
import type { MoveReason, Removal } from './state';

// How a result names elements and places points: by ref, relative to the content origin.
export type LineNaming = { refOf: (id: ElementId) => string; origin: { x: number; y: number } };

const pointIn = (naming: LineNaming, x: number, y: number): [number, number] => [
  Math.round(x - naming.origin.x),
  Math.round(y - naming.origin.y),
];
const size = (w: number, h: number): [number, number] => [Math.round(w), Math.round(h)];

// The `+` line of a new element.
export function addedLine(el: Element, naming: LineNaming): ResultLine {
  const label = labelOf(el);
  const ref = naming.refOf(el.id);
  const common = { mark: '+' as const, ref, kind: kindOf(el), ...(label ? { label } : {}) };
  return el.type === 'arrow'
    ? { ...common, ends: [endText(el, 'from', naming), endText(el, 'to', naming)] }
    : { ...common, at: pointIn(naming, el.x, el.y), size: size(el.width, el.height) };
}

// The `-` line of a removed element, noting the element it was pinned to when it went with one.
export function removedLine(el: Element, naming: LineNaming, removal: Removal = {}): ResultLine {
  const label = labelOf(el);
  return {
    mark: '-',
    ref: naming.refOf(el.id),
    kind: kindOf(el),
    ...(label ? { label } : {}),
    ...(el.type === 'arrow'
      ? { ends: [endText(el, 'from', naming), endText(el, 'to', naming)] as [string, string] }
      : {}),
    ...(removal.pinnedTo
      ? { reason: 'pinned' as const, pinnedTo: naming.refOf(removal.pinnedTo) }
      : {}),
  };
}

// An arrow end on a + or - line: the element it is attached to, or `@x,y` when free.
function endText(arrow: ArrowElement, end: 'from' | 'to', naming: LineNaming): string {
  const ep = arrow[end];
  if (ep.kind !== 'free') return endRef(ep, naming.refOf);
  const [x, y] = pointIn(naming, ep.x, ep.y);
  return `@${x},${y}`;
}

// An arrow end as a change prints it: the element it is attached to, or the point of a free end.
const endValue = (arrow: ArrowElement, end: 'from' | 'to', naming: LineNaming): JsonValue => {
  const ep = arrow[end];
  return ep.kind === 'free' ? pointIn(naming, ep.x, ep.y) : endRef(ep, naming.refOf);
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

function fieldChanges(
  prev: Element,
  cur: Element,
  written: readonly string[],
  naming: LineNaming,
): FieldChange[] {
  const changes: FieldChange[] = [];
  if (prev.type !== 'arrow' && cur.type !== 'arrow' && (prev.x !== cur.x || prev.y !== cur.y))
    changes.push({
      key: 'at',
      from: pointIn(naming, prev.x, prev.y),
      to: pointIn(naming, cur.x, cur.y),
    });
  if (prev.type === 'arrow' && cur.type === 'arrow')
    for (const end of ['from', 'to'] as const) {
      const [from, to] = [endValue(prev, end, naming), endValue(cur, end, naming)];
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
  // The input tab's elements, in order.
  beforeElements: readonly Element[];
  // Ids in the order operations first touched them, with the fields they wrote.
  touched: ReadonlyMap<
    ElementId,
    { written: readonly string[]; fit?: Fit; moved?: MoveReason; shift?: [number, number] }
  >;
  removed: ReadonlyMap<ElementId, Removal>;
  warnings: readonly EditWarning[];
  theme: ThemeDefinition;
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

// One `»` line per distinct shift and reason, refs in element order.
function movedLines(
  source: ResultSource,
  after: ReadonlyMap<ElementId, Element>,
  next: readonly Element[],
  naming: LineNaming,
): ResultLine[] {
  const groups = new Map<
    string,
    { delta?: [number, number]; reason: MoveReason; ids: Set<ElementId> }
  >();
  for (const [id, touched] of source.touched) {
    if (!touched.moved || !after.has(id)) continue;
    const delta: [number, number] | undefined = touched.shift
      ? [Math.round(touched.shift[0]), Math.round(touched.shift[1])]
      : undefined;
    // Moved and moved back.
    if (delta && delta[0] === 0 && delta[1] === 0) continue;
    const key = `${delta?.join(',') ?? ''},${touched.moved}`;
    const group = groups.get(key) ?? {
      ...(delta ? { delta } : {}),
      reason: touched.moved,
      ids: new Set<ElementId>(),
    };
    group.ids.add(id);
    groups.set(key, group);
  }
  return [...groups.values()].map(({ delta, reason, ids }) => ({
    mark: '»' as const,
    refs: next.filter((el) => ids.has(el.id)).map((el) => naming.refOf(el.id)),
    ...(delta ? { delta } : {}),
    reason,
  }));
}

// Each container present after whose members changed: who joined and who left, removed elements
// aside (their - line says it).
function containerLines(
  source: ResultSource,
  next: readonly Element[],
  naming: LineNaming,
): ResultLine[] {
  const was = deriveContainers(source.beforeElements);
  const now = deriveContainers(next);
  const joined = new Map<ElementId, ElementId[]>();
  const left = new Map<ElementId, ElementId[]>();
  const add = (map: Map<ElementId, ElementId[]>, container: ElementId, id: ElementId) =>
    map.set(container, [...(map.get(container) ?? []), id]);
  for (const el of next) {
    if (el.type === 'arrow') continue;
    const [before, after] = [was.get(el.id) ?? null, now.get(el.id) ?? null];
    if (before === after) continue;
    if (after) add(joined, after, el.id);
    if (before && source.before.has(el.id)) add(left, before, el.id);
  }
  return next
    .filter((el) => joined.has(el.id) || left.has(el.id))
    .map((el) => ({
      mark: 'container' as const,
      ref: naming.refOf(el.id),
      joined: (joined.get(el.id) ?? []).map(naming.refOf),
      left: (left.get(el.id) ?? []).map(naming.refOf),
    }));
}

export function buildResultLines(source: ResultSource, next: readonly Element[]): ResultLine[] {
  const after = new Map(next.map((el) => [el.id, el]));
  const naming = lineNaming(source.beforeElements, next, source.origin);
  const lines: ResultLine[] = [];
  for (const [id, touched] of source.touched) {
    const { written } = touched;
    const [prev, cur] = [source.before.get(id), after.get(id)];
    if (cur && !prev) lines.push(addedLine(cur, naming));
    else if (prev && !cur) lines.push(removedLine(prev, naming, source.removed.get(id)));
    else if (prev && cur && !touched.moved) {
      const changes = aliasChanges(
        fieldChanges(prev, cur, written, naming),
        prev,
        cur,
        touched,
        source.theme,
      );
      if (changes.length) lines.push({ mark: '~', ref: naming.refOf(id), changes });
    }
  }
  return [
    ...lines,
    ...movedLines(source, after, next, naming),
    ...containerLines(source, next, naming),
    ...source.warnings.map((warning) => ({ mark: '!' as const, warning })),
  ];
}
