// Where a walking click on a Reception Desk or an Arcade Machine ends when the spot in front of it is taken
// (docs/specs/009-elements/social-pieces.md "A crowded machine stays reachable", Work Tracker 635): walkPointFor's
// spot when it is free, else the nearest free spot along the piece's front that still stands at this piece (its
// Insert Coin or Welcome shows), never a neighbour's in a bank of machines (front-spot.ts). Runs once per click.

import { pieceFacing, type Element } from '@livehuddle/document';
import type { FenceSegment } from '@livehuddle/avatar/collision';
import { freeFrontSpot } from '@livehuddle/avatar/front-spot';
import { arcadeAt } from '@/components/canvas/collab/useSocialPieces';
import { isFrontPiece, walkPointFor } from './avatar-click-intent';
import { receptionAt } from './office/useWorkdayPieces';

type Point = { x: number; y: number };

export function frontWalkPoint(
  el: Element | null,
  point: Point,
  // The other standing characters' feet.
  others: readonly Point[],
  elements: readonly Element[],
  fences: readonly FenceSegment[],
): Point {
  const want = walkPointFor(el, point);
  if (!el || el.type !== 'shape' || !isFrontPiece(el) || others.length === 0) return want;
  // The pieces of its kind, so a spot at a neighbour's front is not this one's.
  const kind = el.shape;
  const same = elements.filter((e): e is typeof el => e.type === 'shape' && e.shape === kind);
  const at = kind === 'arcade-machine' ? arcadeAt : receptionAt;
  const facing = pieceFacing(el);
  return freeFrontSpot({
    want,
    axis: facing === 'e' || facing === 'w' ? 'y' : 'x',
    others,
    inReach: (p) => at(p, same) === el.id,
    fences,
  });
}
