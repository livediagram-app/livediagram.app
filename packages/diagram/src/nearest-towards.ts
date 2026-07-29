// "Which element is straight out that way?" — the target picker behind the
// touch quick-connect (spec/09).
//
// On a phone the quick-add ring can't be dragged the way a mouse drags it, so
// tapping the + used to drop an arrow with a free end hanging 50px into space,
// leaving the user to place it by hand on the surface least suited to fine
// dragging. Almost always the thing they wanted was the box already sitting
// on that side. This finds it.
//
// Pure and side-effect free so the rule is testable without a canvas.

import type { Anchor, BoxedElement, Element } from './index';
import { isBoxed } from './index';

// How far off the source's own span a candidate may sit and still count as
// "on that side". A fraction of the SOURCE's width/height rather than a fixed
// px, so the rule reads the same on a dense diagram and a sparse one.
const LATERAL_SLACK = 0.75;

// Beyond this (again relative to the source) a box is not "just over there"
// any more and the user meant to place the end themselves.
const MAX_REACH = 6;

type Box = { x: number; y: number; width: number; height: number };

const overlaps = (aMin: number, aMax: number, bMin: number, bMax: number, slack: number): boolean =>
  aMin - slack < bMax && bMin < aMax + slack;

/**
 * The nearest boxed element directly beyond `anchor`'s side of `source`.
 *
 * Returns null when nothing qualifies — no candidate on that side, none within
 * reach, or the anchor is a corner (a diagonal has no unambiguous "next box",
 * so it declines rather than guessing).
 */
export function nearestElementTowards(
  elements: Element[],
  source: BoxedElement,
  anchor: Anchor,
  // Ignored as candidates: the source's own group members, which are being
  // moved as one thing and are never what an arrow out of the group means.
  excludeIds: ReadonlySet<string> = new Set(),
): BoxedElement | null {
  if (anchor !== 'n' && anchor !== 's' && anchor !== 'e' && anchor !== 'w') return null;
  const vertical = anchor === 'n' || anchor === 's';
  const span = vertical ? source.height : source.width;
  const slack = (vertical ? source.width : source.height) * LATERAL_SLACK;
  const reach = Math.max(span, 1) * MAX_REACH;

  let best: BoxedElement | null = null;
  let bestGap = Infinity;
  for (const el of elements) {
    if (el.id === source.id || excludeIds.has(el.id) || !isBoxed(el)) continue;
    // A frame is a section backdrop, not a node — an arrow into one reads as
    // pointing at the whole section rather than at anything in particular.
    if (el.type === 'shape' && el.shape === 'frame') continue;
    const gap = gapTowards(source, el, anchor);
    if (gap === null || gap > reach) continue;
    const laterallyAligned = vertical
      ? overlaps(source.x, source.x + source.width, el.x, el.x + el.width, slack)
      : overlaps(source.y, source.y + source.height, el.y, el.y + el.height, slack);
    if (!laterallyAligned) continue;
    if (gap < bestGap) {
      bestGap = gap;
      best = el;
    }
  }
  return best;
}

// Distance from the source's edge to the candidate's near edge along the
// anchor's axis, or null when the candidate isn't on that side at all.
// A candidate that merely overlaps the source contributes gap 0 rather than a
// negative, so "sitting on top of it" never beats a real neighbour.
function gapTowards(source: Box, el: Box, anchor: 'n' | 's' | 'e' | 'w'): number | null {
  if (anchor === 's')
    return el.y + el.height > source.y + source.height
      ? Math.max(0, el.y - (source.y + source.height))
      : null;
  if (anchor === 'n') return el.y < source.y ? Math.max(0, source.y - (el.y + el.height)) : null;
  if (anchor === 'e')
    return el.x + el.width > source.x + source.width
      ? Math.max(0, el.x - (source.x + source.width))
      : null;
  return el.x < source.x ? Math.max(0, source.x - (el.x + el.width)) : null;
}

/** The anchor an arrow should land on when arriving from `anchor`'s side. */
export function opposingAnchor(anchor: 'n' | 's' | 'e' | 'w'): Anchor {
  return anchor === 'n' ? 's' : anchor === 's' ? 'n' : anchor === 'e' ? 'w' : 'e';
}
