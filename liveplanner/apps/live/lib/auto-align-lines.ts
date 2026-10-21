// Auto-align's positions (docs/specs/008-canvas/layout-cleanup.md "Auto-align (grid snap)"): boxes
// snap by the LINES they share, not one by one.
//
// Rounding each box's top-left on its own broke the very alignment it was meant to tidy: a
// 250-wide input step and a 220-wide process step centred on one column have top-lefts 15 px
// apart, which round to different grid lines, so their centres came out 5 px apart and the arrow
// between them leaned. Here each axis is worked out separately:
//
//   1. Every box offers three lines: its start, its centre, its end.
//   2. Lines of one kind within ALIGN_TOLERANCE of each other form a group. Two boxes joined by an
//      arrow that runs along the axis (a bottom-to-top arrow lines up centres across) also join
//      a centre group within LINK_TOLERANCE.
//   3. Groups are settled largest first. A box takes the first group it belongs to and moves so
//      that line lands on the group's grid-snapped value (or on the value a box already settled,
//      or a locked box, holds). A box in no group just snaps its start to the grid.
//   4. A snap that makes two boxes overlap that did not before, or moves a box part-way out of a
//      box that held it, is undone for both.
//
// Pure: same input, same output; idempotent on its own output.

import { isBoxed, type BoxedElement, type Element, type ElementId } from '@liveplanner/document';

const GRID = 10;
// How far apart two lines may be and still count as one (a few px of hand drift), and the wider
// reach of two boxes an arrow runs straight between.
const ALIGN_TOLERANCE = 8;
export const LINK_TOLERANCE = 16;

type Kind = 'start' | 'centre' | 'end';
const KINDS: Kind[] = ['centre', 'start', 'end'];

type Item = { id: ElementId; lo: number; size: number; next: number; locked: boolean };
type Group = { kind: Kind; members: Item[]; links: number };

const snap = (v: number) => Math.round(v / GRID) * GRID;
// A centre line snaps to the half grid: a box whose start and size are on the grid has its centre
// there, so a settled box's every line is already on its grid and a second run moves nothing.
const snapLine = (kind: Kind, v: number) =>
  kind === 'centre' ? Math.round(v / (GRID / 2)) * (GRID / 2) : snap(v);
const lineOf = (kind: Kind, lo: number, size: number) =>
  kind === 'start' ? lo : kind === 'centre' ? lo + size / 2 : lo + size;
const loFor = (kind: Kind, line: number, size: number) =>
  kind === 'start' ? line : kind === 'centre' ? line - size / 2 : line - size;

// The arrow faces that run along each axis: a bottom-to-top arrow joins centres across x.
const VERTICAL = new Set(['n', 's']);
const HORIZONTAL = new Set(['e', 'w']);

export function alignBoxes(
  elements: Element[],
  sizeSnap: (el: Element) => Element,
  lockedIds?: ReadonlySet<ElementId>,
): Element[] {
  const boxes = elements.filter(isBoxed);
  if (boxes.length === 0) return elements;
  const sized = new Map<ElementId, BoxedElement>();
  for (const b of boxes) sized.set(b.id, lockedIds?.has(b.id) ? b : (sizeSnap(b) as BoxedElement));
  const linksX: [ElementId, ElementId][] = [];
  const linksY: [ElementId, ElementId][] = [];
  for (const el of elements) {
    if (el.type !== 'arrow' || el.from.kind !== 'pinned' || el.to.kind !== 'pinned') continue;
    const a = el.from.anchor;
    const b = el.to.anchor;
    const pair: [ElementId, ElementId] = [el.from.elementId, el.to.elementId];
    if (VERTICAL.has(a) && VERTICAL.has(b)) linksX.push(pair);
    else if (HORIZONTAL.has(a) && HORIZONTAL.has(b)) linksY.push(pair);
  }
  const axis = (pick: 'x' | 'y', links: [ElementId, ElementId][]) =>
    settleAxis(
      boxes.map((b) => ({
        id: b.id,
        lo: b[pick],
        size: pick === 'x' ? b.width : b.height,
        next: pick === 'x' ? sized.get(b.id)!.width : sized.get(b.id)!.height,
        locked: lockedIds?.has(b.id) ?? false,
      })),
      links,
    );
  const xs = axis('x', linksX);
  const ys = axis('y', linksY);
  // Even spacing is kept: rows of a key, a column of steps.
  const sizes = (pick: 'x' | 'y') =>
    new Map(
      boxes.map((b) => [b.id, pick === 'x' ? sized.get(b.id)!.width : sized.get(b.id)!.height]),
    );
  const movable = new Set(boxes.filter((b) => !lockedIds?.has(b.id)).map((b) => b.id));
  keepEvenSpacing(boxes, 'y', ys, sizes('y'), xs, sizes('x'), movable);
  keepEvenSpacing(boxes, 'x', xs, sizes('x'), ys, sizes('y'), movable);

  const next = new Map<ElementId, BoxedElement>();
  for (const b of boxes) {
    if (lockedIds?.has(b.id)) continue;
    const s = sized.get(b.id)!;
    next.set(b.id, { ...s, x: xs.get(b.id)!, y: ys.get(b.id)! });
  }
  undoNewOverlaps(boxes, next);
  // A box that ends where it started stays the same object, so a caller can tell a settled pass.
  return elements.map((el) => {
    const n = next.get(el.id);
    if (!n || !isBoxed(el)) return el;
    const same = n.x === el.x && n.y === el.y && n.width === el.width && n.height === el.height;
    return same ? el : n;
  });
}

function settleAxis(items: Item[], links: [ElementId, ElementId][]): Map<ElementId, number> {
  const byId = new Map(items.map((i) => [i.id, i]));
  const groups: Group[] = [];
  for (const kind of KINDS) {
    const sorted = [...items].sort(
      (a, b) => lineOf(kind, a.lo, a.size) - lineOf(kind, b.lo, b.size),
    );
    // Greedy runs, each no wider than the tolerance, so a long drift never chains into one line.
    let run: Item[] = [];
    const flush = () => {
      if (run.length > 1) groups.push({ kind, members: run, links: 0 });
      run = [];
    };
    for (const it of sorted) {
      const first = run[0];
      if (
        first &&
        lineOf(kind, it.lo, it.size) - lineOf(kind, first.lo, first.size) > ALIGN_TOLERANCE
      )
        flush();
      run.push(it);
    }
    flush();
  }
  // Arrow-joined pairs line up their centres from further apart.
  for (const [a, b] of links) {
    const ia = byId.get(a);
    const ib = byId.get(b);
    if (!ia || !ib) continue;
    const gap = Math.abs(lineOf('centre', ia.lo, ia.size) - lineOf('centre', ib.lo, ib.size));
    if (gap > LINK_TOLERANCE) continue;
    const ga = groups.find((g) => g.kind === 'centre' && g.members.includes(ia));
    const gb = groups.find((g) => g.kind === 'centre' && g.members.includes(ib));
    if (ga && ga === gb) ga.links++;
    else if (ga && gb) {
      ga.members.push(...gb.members);
      ga.links += gb.links + 1;
      groups.splice(groups.indexOf(gb), 1);
    } else if (ga || gb) {
      const g = (ga ?? gb)!;
      g.members.push(ga ? ib : ia);
      g.links++;
    } else groups.push({ kind: 'centre', members: [ia, ib], links: 1 });
  }
  groups.sort(
    (a, b) =>
      b.members.length + b.links - (a.members.length + a.links) ||
      KINDS.indexOf(a.kind) - KINDS.indexOf(b.kind),
  );

  const settled = new Map<ElementId, number>();
  for (const it of items) if (it.locked) settled.set(it.id, it.lo);
  for (const g of groups) {
    const free = g.members.filter((m) => !settled.has(m.id));
    if (free.length === 0) continue;
    const held = g.members.find((m) => settled.has(m.id));
    const target = held
      ? lineOf(g.kind, settled.get(held.id)!, held.next)
      : snapLine(g.kind, median(g.members.map((m) => lineOf(g.kind, m.lo, m.size))));
    for (const m of free) settled.set(m.id, loFor(g.kind, target, m.next));
  }
  for (const it of items) if (!settled.has(it.id)) settled.set(it.id, snap(it.lo));
  return settled;
}

// A stack of three or more boxes in one line across (sharing a centre on the other axis), drawn
// with an even step between their centres, keeps an even step: snapping each box to its own grid
// line made a key's rows 43, 39, 38 and 31 px apart where they had been 40 each. The step snaps to
// the grid when that moves the last box no further than the tolerance, and is kept as drawn
// otherwise; the first box keeps its settled place.
const MIN_STACK = 3;
const STEP_SLACK = 1;

function keepEvenSpacing(
  boxes: BoxedElement[],
  pick: 'x' | 'y',
  lo: Map<ElementId, number>,
  size: Map<ElementId, number>,
  crossLo: Map<ElementId, number>,
  crossSize: Map<ElementId, number>,
  movable: Set<ElementId>,
): void {
  const len = pick === 'x' ? 'width' : 'height';
  const lines = new Map<number, BoxedElement[]>();
  for (const b of boxes) {
    const key = Math.round((crossLo.get(b.id)! + crossSize.get(b.id)! / 2) * 2);
    lines.set(key, [...(lines.get(key) ?? []), b]);
  }
  const centre = (b: BoxedElement) => b[pick] + b[len] / 2;
  for (const line of lines.values()) {
    if (line.length < MIN_STACK) continue;
    const sorted = [...line].sort((a, b) => centre(a) - centre(b));
    let start = 0;
    while (start < sorted.length - 1) {
      const step = centre(sorted[start + 1]!) - centre(sorted[start]!);
      let end = start + 1;
      while (
        end + 1 < sorted.length &&
        Math.abs(centre(sorted[end + 1]!) - centre(sorted[end]!) - step) <= STEP_SLACK
      )
        end++;
      const run = sorted.slice(start, end + 1);
      if (run.length >= MIN_STACK && step > 0 && run.every((b) => movable.has(b.id))) {
        const snapped = snap(step);
        const pitch =
          Math.abs(snapped - step) * (run.length - 1) <= ALIGN_TOLERANCE ? snapped : step;
        const first = lo.get(run[0]!.id)! + size.get(run[0]!.id)! / 2;
        run.forEach((b, k) => lo.set(b.id, first + k * pitch - size.get(b.id)! / 2));
      }
      start = end;
    }
  }
}

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

const overlaps = (a: BoxedElement, b: BoxedElement) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

const holds = (outer: BoxedElement, inner: BoxedElement) =>
  inner.x >= outer.x &&
  inner.y >= outer.y &&
  inner.x + inner.width <= outer.x + outer.width &&
  inner.y + inner.height <= outer.y + outer.height;

// Put back, for both boxes, any snap that made two boxes overlap that did not overlap before, or
// nudged a box part-way out of a lane or frame that held it. A revert can only undo what the snap
// did, so a few passes settle it.
function undoNewOverlaps(before: BoxedElement[], next: Map<ElementId, BoxedElement>): void {
  const original = new Map(before.map((b) => [b.id, b]));
  for (let pass = 0; pass < 4; pass++) {
    let changed = false;
    const now = before.map((b) => next.get(b.id) ?? b);
    const sorted = [...now].sort((a, b) => a.x - b.x);
    for (let i = 0; i < sorted.length; i++) {
      const a = sorted[i]!;
      for (let j = i + 1; j < sorted.length; j++) {
        const b = sorted[j]!;
        if (b.x >= a.x + a.width) break;
        const oa = original.get(a.id)!;
        const ob = original.get(b.id)!;
        // A new overlap, or a box nudged part-way out of one that held it.
        const broke =
          (overlaps(a, b) && !overlaps(oa, ob)) ||
          (holds(oa, ob) && !holds(a, b)) ||
          (holds(ob, oa) && !holds(b, a));
        if (!broke) continue;
        for (const id of [a.id, b.id])
          if (next.has(id) && next.get(id) !== original.get(id)) {
            next.set(id, original.get(id)!);
            changed = true;
          }
      }
    }
    if (!changed) return;
  }
}
