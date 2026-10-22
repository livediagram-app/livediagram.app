// `connect <a> -> <b> [id=] [label=…] [line=…] [again]` and `rewire <arrow> from=<x> | to=<y> | both`
// (docs/specs/024-agents/blueprints/edit-operations.md "Operations", EO29, EO31): a pinned arrow
// between boxes, anchors facing each other; a second arrow a→b needs `again`. Rewiring moves one end
// and re-anchors both, dropping the old route.

import type { EditRejection } from '@liveplanner/api-schema';
import {
  anchorPrimarySide,
  bestAnchorTowards,
  createPinnedArrow,
  recolourElementForTheme,
  endpointPosition,
  orthogonalBends,
  type ArrowElement,
  type BoxedElement,
  type Element,
  type Endpoint,
} from '@liveplanner/project';
import { describeElement } from '../element-text';
import { writeFieldsOnto } from '../fields';
import { newElementId } from '../ids';
import { arrowExists } from '../rejections';
import { resolveOne } from '../selectors';
import {
  boxedOf,
  currentElements,
  insertElement,
  namingOf,
  refsOf,
  refuseLocked,
  type EditState,
  writeFields,
} from '../state';
import type { ConnectOperation, RewireOperation } from '../types';
import { layerFor } from './add-kind';

const centreOf = (el: BoxedElement) => ({ x: el.x + el.width / 2, y: el.y + el.height / 2 });

// The anchors two boxes face each other with.
export function facing(a: BoxedElement, b: BoxedElement) {
  return { from: bestAnchorTowards(a, centreOf(b)), to: bestAnchorTowards(b, centreOf(a)) };
}

// The route fields an arrow drops when its ends move (EO31).
export const ROUTE_KEYS = [
  'curveOffset',
  'curvePoints',
  'elbowOffset',
] as const satisfies readonly (keyof ArrowElement)[];

export function withoutRoute(arrow: ArrowElement): ArrowElement {
  const rest = { ...arrow };
  for (const key of ROUTE_KEYS) delete rest[key];
  return rest;
}

// An arrow whose ends moved drawn afresh between them: its old route dropped, and an angled one bent twice along
// the axis its start anchor faces, so it meets both ends square rather than drawing one L (EO31). `elements` holds
// the tab as it now stands.
export function rerouted(arrow: ArrowElement, elements: readonly Element[]): ArrowElement {
  const bare = withoutRoute(arrow);
  if (bare.arrowStyle !== 'angled' || bare.from.kind !== 'pinned') return bare;
  const side = anchorPrimarySide(bare.from.anchor);
  const all = elements.map((el) => (el.id === bare.id ? bare : el));
  const bends = orthogonalBends(bare, all, side === 'n' || side === 's' ? 'TB' : 'LR');
  return bends ? { ...bare, curvePoints: bends } : bare;
}

export const pinnedFromTo = (arrow: Element, a: string, b: string) =>
  arrow.type === 'arrow' &&
  arrow.from.kind === 'pinned' &&
  arrow.from.elementId === a &&
  arrow.to.kind === 'pinned' &&
  arrow.to.elementId === b;

// One box a word names, or why not.
export function resolveBox(
  state: EditState,
  word: string,
  operation: number,
): { el: BoxedElement } | { rejection: EditRejection } {
  const resolved = resolveOne(state, word, operation);
  if ('rejection' in resolved) return resolved;
  const { el } = resolved;
  if (el.type !== 'arrow') return { el };
  return {
    rejection: {
      code: 'invalid_value',
      operation,
      details: [`${word}: ${refsOf(state).refOf(el.id)} is an arrow; arrows connect boxes`],
      hint: 'name the boxes at its ends instead',
    },
  };
}

export function applyConnect(
  state: EditState,
  operation: ConnectOperation,
  index: number,
): EditRejection | null {
  const a = resolveBox(state, operation.from, index);
  if ('rejection' in a) return a.rejection;
  const b = resolveBox(state, operation.to, index);
  if ('rejection' in b) return b.rejection;
  const refOf = refsOf(state).refOf;
  if (a.el.id === b.el.id)
    return {
      code: 'invalid_value',
      operation: index,
      details: [`${operation.from} -> ${operation.to}: an arrow joins two different boxes`],
      hint: 'name another box for one end',
    };
  const existing = currentElements(state).find((el) => pinnedFromTo(el, a.el.id, b.el.id));
  if (existing && !operation.again)
    return arrowExists(
      index,
      `${refOf(a.el.id)}→${refOf(b.el.id)}`,
      describeElement(existing, namingOf(state)),
    );
  const label = operation.fields?.label;
  const id = newElementId(
    state,
    { given: operation.id, label: typeof label === 'string' ? label : undefined, kind: 'arrow' },
    index,
  );
  if (typeof id !== 'string') return id;
  const anchors = facing(a.el, b.el);
  const base = { ...createPinnedArrow(a.el.id, anchors.from, b.el.id, anchors.to), id };
  const written = writeFieldsOnto(base, operation.fields ?? {}, state.theme, id, index);
  if ('code' in written) return written;
  // No line asked for: the line most of the tab's arrows are drawn with, so an arrow added to a flow of elbows is an
  // elbow (docs/specs/024-agents/edit-operations.md "Layout on edit").
  const fields = operation.fields ?? {};
  if (!('line' in fields) && !('arrowStyle' in fields)) {
    const styled = prevailingLine(state, written.next, a.el, b.el);
    if (styled) written.next = styled;
  }
  const layerId = layerFor(state, a.el);
  const arrow = recolourElementForTheme(
    layerId === undefined ? written.next : { ...written.next, layerId },
    state.theme,
  );
  state.warnings.push(...written.warnings);
  const later = state.order.indexOf(a.el.id) > state.order.indexOf(b.el.id) ? a.el.id : b.el.id;
  insertElement(state, arrow, index, { after: later });
  state.created.push(id);
  return null;
}

// The tab's prevailing line on a new arrow: angled (anchors along the axis the two boxes lie on, bent twice as graph
// input bends an elbow) or curved; null when most of the tab's pinned arrows are straight, or it has none.
function prevailingLine(
  state: EditState,
  arrow: ArrowElement,
  a: BoxedElement,
  b: BoxedElement,
): ArrowElement | null {
  const counts = new Map<string, number>();
  for (const el of currentElements(state)) {
    if (el.type !== 'arrow' || el.from.kind !== 'pinned' || el.to.kind !== 'pinned') continue;
    const style = el.arrowStyle ?? 'straight';
    counts.set(style, (counts.get(style) ?? 0) + 1);
  }
  const [style] = [...counts.entries()].sort((p, q) => q[1] - p[1])[0] ?? ['straight'];
  if (style === 'curved') return { ...arrow, arrowStyle: 'curved' };
  if (style !== 'angled') return null;
  const joined = joinTrunk(state, arrow, a, b);
  if (joined) return joined;
  const [ca, cb] = [centreOf(a), centreOf(b)];
  const down = Math.abs(cb.y - ca.y) >= Math.abs(cb.x - ca.x);
  const turned: ArrowElement = {
    ...arrow,
    arrowStyle: 'angled',
    from: {
      kind: 'pinned',
      elementId: a.id,
      anchor: down ? (cb.y > ca.y ? 's' : 'n') : cb.x > ca.x ? 'e' : 'w',
    },
    to: {
      kind: 'pinned',
      elementId: b.id,
      anchor: down ? (cb.y > ca.y ? 'n' : 's') : cb.x > ca.x ? 'w' : 'e',
    },
  };
  const bends = orthogonalBends(turned, [...currentElements(state), turned], down ? 'TB' : 'LR');
  return bends ? { ...turned, curvePoints: bends } : { ...turned, arrowStyle: 'straight' };
}

// Each side's way out, and its opposite.
const OUT = {
  n: { x: 0, y: -1 },
  s: { x: 0, y: 1 },
  e: { x: 1, y: 0 },
  w: { x: -1, y: 0 },
} as const;
const OPPOSITE = { n: 's', s: 'n', e: 'w', w: 'e' } as const;
type Side = keyof typeof OUT;
const isSide = (anchor: string): anchor is Side => anchor in OUT;

// Whether `b` lies wholly past `a`'s `side` (a box below a gateway faces its south side): along the side's way out,
// the gap between their centres is at least their two half-extents.
function facesAll(side: Side, a: BoxedElement, b: BoxedElement): boolean {
  const d = OUT[side];
  const along =
    d.x * (b.x + b.width / 2 - (a.x + a.width / 2)) +
    d.y * (b.y + b.height / 2 - (a.y + a.height / 2));
  const reach =
    (Math.abs(d.x) * (a.width + b.width)) / 2 + (Math.abs(d.y) * (a.height + b.height)) / 2;
  return along >= reach;
}

// An angled arrow from a box that already sends a trunk (an exact-started angled arrow, its two bends on one cross
// line) out of the side facing `b` leaves from that point too and bends in the trunk's channel, into `b`'s facing side
// (docs/specs/024-agents/edit-operations.md "Layout on edit"); null when there is no such trunk or its channel does
// not lie between the two boxes.
function joinTrunk(
  state: EditState,
  arrow: ArrowElement,
  a: BoxedElement,
  b: BoxedElement,
): ArrowElement | null {
  const sideOf = (el: Element): Side | null =>
    el.type === 'arrow' &&
    el.arrowStyle === 'angled' &&
    el.exactStart === true &&
    el.curvePoints?.length === 2 &&
    el.from.kind === 'pinned' &&
    el.from.elementId === a.id &&
    isSide(el.from.anchor) &&
    facesAll(el.from.anchor, a, b)
      ? el.from.anchor
      : null;
  const trunk = currentElements(state).find((el) => sideOf(el) !== null) as
    ArrowElement | undefined;
  if (!trunk) return null;
  const side = sideOf(trunk)!;
  const down = side === 'n' || side === 's';
  // The trunk's channel: its bends' position along the flow, from the midpoint its curvePoints are measured from.
  const [p0, p1] = [
    endpointPosition(trunk.from, state.byId),
    endpointPosition(trunk.to, state.byId),
  ];
  const bend = trunk.curvePoints![0]!;
  const channel = down ? (p0.y + p1.y) / 2 + bend.dy : (p0.x + p1.x) / 2 + bend.dx;
  const joined: ArrowElement = {
    ...arrow,
    arrowStyle: 'angled',
    exactStart: true,
    exactEnd: true,
    from: { kind: 'pinned', elementId: a.id, anchor: side },
    to: { kind: 'pinned', elementId: b.id, anchor: OPPOSITE[side] },
  };
  const [from, to] = [
    endpointPosition(joined.from, state.byId),
    endpointPosition(joined.to, state.byId),
  ];
  const [lo, hi] = down ? [from.y, to.y] : [from.x, to.x];
  if (!(Math.min(lo, hi) < channel && channel < Math.max(lo, hi))) return null;
  const mid = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
  const points = down
    ? [
        { x: from.x, y: channel },
        { x: to.x, y: channel },
      ]
    : [
        { x: channel, y: from.y },
        { x: channel, y: to.y },
      ];
  return { ...joined, curvePoints: points.map((p) => ({ dx: p.x - mid.x, dy: p.y - mid.y })) };
}

export function applyRewire(
  state: EditState,
  operation: RewireOperation,
  index: number,
): EditRejection | null {
  const resolved = resolveOne(state, operation.target, index);
  if ('rejection' in resolved) return resolved.rejection;
  const arrow = resolved.el;
  if (arrow.type !== 'arrow')
    return {
      code: 'invalid_value',
      operation: index,
      details: [`${operation.target}: ${refsOf(state).refOf(arrow.id)} is not an arrow`],
      hint: 'rewire an arrow by its ref, from the graph view',
    };
  const lock = state.locked.get(arrow.id);
  if (lock) return refuseLocked(state, 'rewire', index, arrow, lock);
  const fromBox = operation.from !== undefined ? resolveBox(state, operation.from, index) : null;
  if (fromBox && 'rejection' in fromBox) return fromBox.rejection;
  const toBox = operation.to !== undefined ? resolveBox(state, operation.to, index) : null;
  if (toBox && 'rejection' in toBox) return toBox.rejection;
  // The box each end lands on: a named one, or the box an unnamed pinned end already holds.
  const fromId = fromBox ? fromBox.el.id : pinnedId(arrow.from);
  const toId = toBox ? toBox.el.id : pinnedId(arrow.to);
  // As connect refuses (E18): an arrow joins two different boxes, so rewire never makes a self-loop.
  if (fromId !== undefined && fromId === toId) {
    const named = [
      operation.from !== undefined ? `from=${operation.from}` : '',
      operation.to !== undefined ? `to=${operation.to}` : '',
    ].filter(Boolean);
    return {
      code: 'invalid_value',
      operation: index,
      details: [`${operation.target} ${named.join(' ')}: an arrow joins two different boxes`],
      hint: 'name another box for that end',
    };
  }
  const endFacing = (
    end: Endpoint,
    box: BoxedElement | undefined,
    towards: { x: number; y: number },
  ): Endpoint =>
    box ? { kind: 'pinned', elementId: box.id, anchor: bestAnchorTowards(box, towards) } : end;
  const fromEl =
    fromBox?.el ??
    (arrow.from.kind === 'pinned' ? boxedOf(state, arrow.from.elementId) : undefined);
  const toEl =
    toBox?.el ?? (arrow.to.kind === 'pinned' ? boxedOf(state, arrow.to.elementId) : undefined);
  // A moved end faces the other end's box when that moved too, else its current point.
  const towardsTo = toBox ? centreOf(toBox.el) : endpointPosition(arrow.to, state.byId);
  const towardsFrom = fromBox ? centreOf(fromBox.el) : endpointPosition(arrow.from, state.byId);
  const next = withoutRoute({
    ...arrow,
    from:
      arrow.from.kind === 'pinned' || fromBox
        ? endFacing(arrow.from, fromEl, towardsTo)
        : arrow.from,
    to: arrow.to.kind === 'pinned' || toBox ? endFacing(arrow.to, toEl, towardsFrom) : arrow.to,
  });
  const moved = [...(fromBox ? (['from'] as const) : []), ...(toBox ? (['to'] as const) : [])];
  writeFields(state, next, index, moved);
  return null;
}

function pinnedId(end: Endpoint): string | undefined {
  return end.kind === 'pinned' ? end.elementId : undefined;
}
