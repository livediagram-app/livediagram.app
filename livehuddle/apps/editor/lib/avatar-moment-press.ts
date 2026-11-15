import { DOOR_REACH, type Element, type ShapeElement } from '@livehuddle/document';
import { isFixedSeatShape, isSeatingShape } from '@livehuddle/avatar/office-geometry';
import { prefersReducedMotion } from '@liveworkspace/workbench/lib/motion-preference';
import { avatarClickIntent } from '@/lib/avatar-click-intent';
import {
  hasMoment,
  inMomentReach,
  MOMENT_MS,
  momentPiece,
  momentPlaying,
  momentSide,
  playMoment,
  type MomentKind,
  type Side,
} from '@/lib/piece-moments';

// A press beside a moment piece replays its moment (docs/specs/009-elements/piece-moments.md "A press beside it",
// Work Tracker 867): in Avatar mode, a click on a moment piece whose click walks you to it (a tree, a kettle, a
// Window) while you already stand beside it plays its moment again where you stand, instead of a walk that would go
// nowhere. Seats (the Hammock, the Podium's speaker spot) keep walking you to the seat, and the pieces a click uses
// (the Notice Board, the World Clock) keep their own press. One box test per click, never per frame.

type Point = { x: number; y: number };

export type MomentPress = { id: string; kind: MomentKind; side: Side };

/** Whether a click on this kind may replay its moment: a moment piece walked to that is not a seat. */
export function replaysOnPress(kind: string): kind is MomentKind {
  return (
    hasMoment(kind) &&
    avatarClickIntent(kind) === 'walk' &&
    !isSeatingShape(kind) &&
    !isFixedSeatShape(kind)
  );
}

// How far `p` lies outside a box, 0 inside it.
function boxGap(p: Point, el: ShapeElement): number {
  const dx = Math.max(el.x - p.x, 0, p.x - (el.x + el.width));
  const dy = Math.max(el.y - p.y, 0, p.y - (el.y + el.height));
  return Math.hypot(dx, dy);
}

/**
 * The moment a walking click on `hit` replays, or null when the click should walk as before: `hit` is a piece that
 * replays on a press, and `feet` stand beside it, within DOOR_REACH of its box (the reach a Door swings at) or where
 * walking up to it plays its moment (a Microwave's from the floor in front of its counter).
 */
export function avatarMomentPress(hit: Element | null, feet: Point | null): MomentPress | null {
  if (!hit || !feet || hit.type !== 'shape' || !replaysOnPress(hit.shape)) return null;
  const piece = momentPiece({
    id: hit.id,
    kind: hit.shape,
    x: hit.x,
    y: hit.y,
    width: hit.width,
    height: hit.height,
    rotation: hit.rotation,
  });
  if (boxGap(feet, hit) > DOOR_REACH && !inMomentReach(feet, piece)) return null;
  return { id: hit.id, kind: hit.shape, side: momentSide(feet, piece) };
}

/**
 * Plays a press's moment: nothing while it is still playing (never over itself), and nothing under reduced motion,
 * where no moment plays and nothing stands in for it. The press is the click's either way, so it never walks.
 */
export function replayMoment(press: MomentPress, now = Date.now()): void {
  if (prefersReducedMotion() || momentPlaying(press.id, now)) return;
  playMoment(press.id, press.side, MOMENT_MS[press.kind], now);
}
