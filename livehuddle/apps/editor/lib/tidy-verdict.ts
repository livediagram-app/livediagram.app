// Whether a tidier's result is worth applying (docs/specs/008-canvas/layout-cleanup.md "A tidy never
// trashes the work"). A tidier is offered only when it would make the tab tidier: one that changes
// nothing, covers a shape it did not cover before, or pulls a shape out of the lane or frame that
// held it is greyed out in the Tidy Up popover with the reason, and refused with a notice from the
// command palette. Pure.

import {
  isBoxed,
  tidyMindmapFits,
  type BoxedElement,
  type Element,
  type Layer,
} from '@livehuddle/document';
import { cleanupElements, type CleanupKind } from '@/lib/tab-cleanup';
import { lockedElementIds } from '@/lib/locked-element-ids';

export type CleanupVerdict =
  | { kind: 'ok' }
  | { kind: 'unchanged' }
  | { kind: 'covers'; count: number }
  | { kind: 'leaves-container'; count: number }
  // A set of lanes would come out in another order or arrangement.
  | { kind: 'rearranges-lanes' }
  // The style does not suit this graph (a mindmap of a graph that loops back on itself).
  | { kind: 'unsuited' };

// Movement below this is rounding, not a change.
const EPSILON = 0.5;
// A box sits in a container when it is inside it to within this.
const INSIDE_SLACK = 1;

const contains = (outer: BoxedElement, inner: BoxedElement) =>
  inner.x >= outer.x - INSIDE_SLACK &&
  inner.y >= outer.y - INSIDE_SLACK &&
  inner.x + inner.width <= outer.x + outer.width + INSIDE_SLACK &&
  inner.y + inner.height <= outer.y + outer.height + INSIDE_SLACK;

const overlaps = (a: BoxedElement, b: BoxedElement) =>
  a.x < b.x + b.width - EPSILON &&
  b.x < a.x + a.width - EPSILON &&
  a.y < b.y + b.height - EPSILON &&
  b.y < a.y + a.height - EPSILON;

const moved = (a: BoxedElement, b: BoxedElement) =>
  Math.abs(a.x - b.x) > EPSILON ||
  Math.abs(a.y - b.y) > EPSILON ||
  Math.abs(a.width - b.width) > EPSILON ||
  Math.abs(a.height - b.height) > EPSILON;

// What an arrow's route is made of, for telling whether a tidy changed it.
const arrowShape = (a: Extract<Element, { type: 'arrow' }>) =>
  JSON.stringify([
    a.from,
    a.to,
    a.arrowStyle ?? 'straight',
    a.curvePoints ?? null,
    a.elbowOffset ?? null,
  ]);

/**
 * The verdict on replacing `before` with `after` (the same elements, tidied). `lanes` false skips the
 * lane check: Auto-align nudges each lane onto the grid by a few px, which tidies it.
 */
export function cleanupVerdict(
  before: Element[],
  after: Element[],
  opts: { lanes?: boolean } = {},
): CleanupVerdict {
  const was = new Map(before.filter(isBoxed).map((b) => [b.id, b]));
  const now = after.filter(isBoxed);
  const changedBoxes = now.filter((b) => {
    const w = was.get(b.id);
    return !w || moved(w, b);
  });
  const wasArrow = new Map(before.map((e) => [e.id, e]));
  const changedArrows = after.some((el) => {
    if (el.type !== 'arrow') return false;
    const w = wasArrow.get(el.id);
    return !w || w.type !== 'arrow' || arrowShape(w) !== arrowShape(el);
  });
  if (changedBoxes.length === 0 && !changedArrows) return { kind: 'unchanged' };

  // A moved box that left a box which held it (and did not move with it).
  const nowById = new Map(now.map((b) => [b.id, b]));
  let left = 0;
  for (const b of changedBoxes) {
    const w = was.get(b.id);
    if (!w) continue;
    for (const c of was.values()) {
      if (c.id === b.id || c.width * c.height <= w.width * w.height || !contains(c, w)) continue;
      const cNow = nowById.get(c.id) ?? c;
      if (!contains(cNow, b)) {
        left++;
        break;
      }
    }
  }
  if (left > 0) return { kind: 'leaves-container', count: left };
  const wired = new Set<string>();
  for (const el of before)
    if (el.type === 'arrow')
      for (const ep of [el.from, el.to]) if (ep.kind === 'pinned') wired.add(ep.elementId);
  if (opts.lanes !== false && lanesRearranged(before.filter(isBoxed), nowById, wired))
    return { kind: 'rearranges-lanes' };

  // Pairs that overlap now and did not before, at least one of them moved. A sweep along x keeps
  // it near-linear for a spread-out tab.
  const changed = new Set(changedBoxes.map((b) => b.id));
  const sorted = [...now].sort((a, b) => a.x - b.x);
  const covered = new Set<string>();
  for (let i = 0; i < sorted.length; i++) {
    const a = sorted[i]!;
    for (let j = i + 1; j < sorted.length; j++) {
      const b = sorted[j]!;
      if (b.x >= a.x + a.width) break;
      if (!changed.has(a.id) && !changed.has(b.id)) continue;
      if (!overlaps(a, b)) continue;
      const wa = was.get(a.id);
      const wb = was.get(b.id);
      if (wa && wb && overlaps(wa, wb)) continue;
      covered.add(changed.has(a.id) ? b.id : a.id);
    }
  }
  if (covered.size > 0) return { kind: 'covers', count: covered.size };
  return { kind: 'ok' };
}

// Lanes: two or more boxes that each hold a wired shape, the same length along one axis, lined up
// on it and stacked with at most LANE_GAP between them (swimlane rows, process columns, a tree's
// level bands). They are the author's structure: a layout may move the set as a whole and adjust
// the gaps a little, but must keep each lane in order and in line with the others. Stringing a swimlane's rows into one long
// line keeps every shape in its lane and still destroys the diagram.
const LANE_GAP = 48;
const LANE_SLACK = 2;
// How much a gap between two lanes may grow or shrink: a layout's own spacing, not a reshuffle.
const LANE_GAP_DRIFT = 16;

function lanesRearranged(
  before: BoxedElement[],
  now: Map<string, BoxedElement>,
  wired: Set<string>,
): boolean {
  // A lane holds a wired shape and is not wired itself (a node holding its own badge is not a lane).
  const holders = before.filter(
    (c) =>
      !wired.has(c.id) &&
      before.some(
        (b) => wired.has(b.id) && b.width * b.height < c.width * c.height && contains(c, b),
      ),
  );
  for (const axis of ['x', 'y'] as const) {
    const len = axis === 'x' ? 'width' : 'height';
    const cross = axis === 'x' ? 'y' : 'x';
    const crossLen = axis === 'x' ? 'height' : 'width';
    // Group by start and length on `axis`, then by a stack along the other axis.
    const groups = new Map<string, BoxedElement[]>();
    for (const h of holders) {
      const key = `${Math.round(h[axis] / LANE_SLACK)}:${Math.round(h[len] / LANE_SLACK)}`;
      groups.set(key, [...(groups.get(key) ?? []), h]);
    }
    for (const group of groups.values()) {
      if (group.length < 2) continue;
      const stack = [...group].sort((a, b) => a[cross] - b[cross]);
      const lanes = stack.filter((l, i) => {
        const prev = stack[i - 1];
        const next = stack[i + 1];
        const gap = (a: BoxedElement, b: BoxedElement) => b[cross] - (a[cross] + a[crossLen]);
        return (prev && gap(prev, l) <= LANE_GAP) || (next && gap(l, next) <= LANE_GAP);
      });
      if (lanes.length < 2) continue;
      // Lanes keep their places relative to each other: the set may move as a whole, and each gap
      // between neighbours may change a little, but not reorder, fall out of line or spread.
      const after = lanes.map((l) => now.get(l.id) ?? l);
      const kept = after.every((a, i) => {
        if (Math.abs(a[axis] - after[0]![axis]) > LANE_SLACK) return false;
        if (i === 0) return true;
        const was = lanes[i]![cross] - (lanes[i - 1]![cross] + lanes[i - 1]![crossLen]);
        const is = a[cross] - (after[i - 1]![cross] + after[i - 1]![crossLen]);
        return is > 0 && Math.abs(is - was) <= LANE_GAP_DRIFT;
      });
      if (!kept) return true;
    }
  }
  return false;
}

/** Run a tidier and judge it, without applying anything. */
export function assessCleanup(
  elements: Element[],
  kind: CleanupKind,
  layers?: Layer[],
): CleanupVerdict {
  if (elements.length === 0) return { kind: 'unchanged' };
  if (kind === 'mindmap' && !tidyMindmapFits(elements, lockedElementIds(elements, layers)))
    return { kind: 'unsuited' };
  return cleanupVerdict(elements, cleanupElements(elements, kind, layers), {
    lanes: kind !== 'align',
  });
}

/** The short reason a tile shows under its name when it is greyed out; null when it is offered. */
export function verdictLine(v: CleanupVerdict): string | null {
  switch (v.kind) {
    case 'ok':
      return null;
    case 'unchanged':
      return 'Already tidy';
    case 'covers':
      return v.count === 1 ? 'Would cover a shape' : `Would cover ${v.count} shapes`;
    case 'leaves-container':
      return 'Would pull shapes out of their lanes';
    case 'rearranges-lanes':
      return 'Would rearrange your lanes';
    case 'unsuited':
      return 'For ideas that branch, not loop';
  }
}

/** The notice the command palette shows when it refuses a tidier, naming it. */
export function verdictNotice(name: string, v: CleanupVerdict): string | null {
  switch (v.kind) {
    case 'ok':
      return null;
    case 'unchanged':
      return `${name}: the tab is already tidy, so nothing moved.`;
    case 'covers':
      return `${name} would cover ${v.count === 1 ? 'a shape' : `${v.count} shapes`}, so nothing moved.`;
    case 'leaves-container':
      return `${name} would pull shapes out of their lanes or frames, so nothing moved.`;
    case 'rearranges-lanes':
      return `${name} would rearrange your lanes, so nothing moved.`;
    case 'unsuited':
      return `${name} needs a centre to branch from; these arrows loop, so nothing moved.`;
  }
}
