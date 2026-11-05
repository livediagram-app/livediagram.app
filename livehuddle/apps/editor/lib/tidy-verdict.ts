// Whether Auto-align's result is worth applying (docs/specs/008-canvas/layout-cleanup.md "A tidy never
// trashes the work"). It is offered only when it would make the tab tidier: if it changes nothing, covers a
// shape it did not cover before, or pulls a shape out of the lane or frame that held it, it is greyed out in
// the Tidy Up popover with the reason, and refused with a notice from the command palette. Pure.

import { isBoxed, type BoxedElement, type Element } from '@livehuddle/document';
import { cleanupElements } from '@/lib/tab-cleanup';

export type CleanupVerdict =
  | { kind: 'ok' }
  | { kind: 'unchanged' }
  | { kind: 'covers'; count: number }
  | { kind: 'leaves-container'; count: number };

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

/** The verdict on replacing `before` with `after` (the same elements, tidied). */
export function cleanupVerdict(before: Element[], after: Element[]): CleanupVerdict {
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

/** Run Auto-align and judge it, without applying anything. */
export function assessCleanup(elements: Element[]): CleanupVerdict {
  if (elements.length === 0) return { kind: 'unchanged' };
  return cleanupVerdict(elements, cleanupElements(elements));
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
  }
}
