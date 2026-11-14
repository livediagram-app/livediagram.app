'use client';

// Piece moments (docs/specs/009-elements/piece-moments.md): walking right up to a tree, a pond, a kettle or any other
// still piece plays a small moment on it, every time, on your screen alone. The pieces are picked out of the board once per change of the
// elements; each step of your feet then asks the trigger, one box test a piece and nothing built, and a moment
// re-renders only the piece it plays on.

import { useEffect, useMemo, useRef } from 'react';
import type { Element } from '@livehuddle/document';
import { prefersReducedMotion } from '@liveworkspace/workbench/lib/motion-preference';
import {
  createMomentTrigger,
  hasMoment,
  momentPiece,
  playMoment,
  type MomentPiece,
  type MomentTrigger,
} from '@/lib/piece-moments';

type Point = { x: number; y: number };

/** The pieces on the board that play a moment. */
export function momentPiecesOf(elements: readonly Element[]): MomentPiece[] {
  const out: MomentPiece[] = [];
  for (const el of elements) {
    if (el.type !== 'shape' || !hasMoment(el.shape)) continue;
    out.push(
      momentPiece({
        id: el.id,
        kind: el.shape,
        x: el.x,
        y: el.y,
        width: el.width,
        height: el.height,
        rotation: el.rotation,
      }),
    );
  }
  return out;
}

export function usePieceMoments({
  active,
  feet,
  elements,
}: {
  // In Avatar mode: out of it, nothing plays.
  active: boolean;
  feet: Point | null;
  elements: readonly Element[];
}): void {
  const pieces = useMemo(() => momentPiecesOf(elements), [elements]);
  const trigger = useRef<MomentTrigger | null>(null);
  trigger.current ??= createMomentTrigger();
  const fx = feet?.x;
  const fy = feet?.y;
  useEffect(() => {
    const t = trigger.current!;
    if (!active || fx === undefined || fy === undefined) {
      t.reset();
      return;
    }
    if (pieces.length === 0) return;
    const hits = t.step({ x: fx, y: fy }, pieces);
    // Reduced motion plays nothing, and nothing stands in for it.
    if (hits.length === 0 || prefersReducedMotion()) return;
    for (const hit of hits) playMoment(hit.id, hit.side);
  }, [active, fx, fy, pieces]);
}
