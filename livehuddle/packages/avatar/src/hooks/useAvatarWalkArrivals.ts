// Where the feet are taking the character (useAvatarWalk.ts): carried with a piece it sits in, and arriving on a
// portal, a chair, a reaction pad or a drink. Called by useAvatarWalk in its place.

import { useEffect, useEffectEvent } from 'react';
import { drinkFrom, seatsACharacter } from '../office-geometry';
import { hasSceneBox, isSceneShape, type AvatarSceneElement, type SceneShapeOf } from '../scene';
import { clearOfFences, fenceReachFor, type FenceSegment } from '../collision';
import { avatarScale, type AvatarConfig } from '../config';
import { seatPoints } from '../seats';
import { catchArea } from '../lectern';
import { besideBox, claimOf, SEAT_GONE, type SeatClaim } from '../seat-claims';
import { sitsOnEntry, type AvatarFacing, type AvatarPoint } from '../walk';
import type { Dispatch, RefObject, SetStateAction } from 'react';
import { SEAT_FOLLOW_EPSILON } from './avatarWalkTypes';

export function useAvatarWalkArrivals<E extends AvatarSceneElement>({
  active,
  isActive,
  standingOnId,
  elements,
  fences,
  config,
  seatedRef,
  claimRef,
  posRef,
  facingRef,
  destRef,
  aimRef,
  targetRef,
  lastUnderFeetRef,
  arrivedPortalRef,
  setPos,
  setFacing,
  publishIdle,
  setSeatClaim,
  stepAside,
  onWalkIntoPortal,
  onWalkIntoChair,
  onWalkIntoReactionPad,
  onWalkIntoDrink,
}: {
  active: boolean;
  isActive: boolean;
  standingOnId: string | null;
  elements: readonly E[];
  fences: FenceSegment[];
  config: AvatarConfig;
  seatedRef: RefObject<string | null>;
  claimRef: RefObject<SeatClaim | null>;
  posRef: RefObject<AvatarPoint | null>;
  facingRef: RefObject<AvatarFacing>;
  destRef: RefObject<AvatarPoint | null>;
  aimRef: RefObject<AvatarPoint | null>;
  targetRef: RefObject<AvatarPoint | null>;
  lastUnderFeetRef: RefObject<string | null>;
  arrivedPortalRef: RefObject<string | null>;
  setPos: (at: AvatarPoint) => void;
  setFacing: (facing: AvatarFacing) => void;
  publishIdle: (at: AvatarPoint, faceTo?: AvatarFacing) => void;
  setSeatClaim: Dispatch<SetStateAction<SeatClaim | null>>;
  // Stand up at a point without walking (useAvatarWalk's `stepAside`).
  stepAside: (to: AvatarPoint) => void;
  onWalkIntoPortal?: (element: SceneShapeOf<E>) => void;
  onWalkIntoChair?: (element: SceneShapeOf<E>, feet: AvatarPoint, aim?: AvatarPoint) => void;
  onWalkIntoReactionPad?: (element: SceneShapeOf<E>) => void;
  onWalkIntoDrink?: (element: SceneShapeOf<E>) => void;
}) {
  // A piece turned or moved while we sit in it carries us (docs/specs/009-elements/furniture-facing.md
  // "Somebody sitting in it is carried round"): our feet go to the seat we hold, at its new place, facing its new way,
  // and we stay seated. Read off the board on every change of it; a piece that is gone, or no longer seats anyone,
  // leaves us where we are. Only the sitter's own machine moves them, as with every move, so the room sees it in our
  // presence rather than working it out itself.
  // A table that changed how many seats it has (a Long Table made shorter, a type change in place; chair.md "A table
  // that loses seats", Work Tracker 831) keeps us on our seat while it still has it, renumbered with the same `at` and
  // `tie`, and stands us up beside it when it has lost it, never leaving us floating where the old chair was.
  const followSeat = useEffectEvent(() => {
    const id = seatedRef.current;
    const from = posRef.current;
    if (!id || !from) return;
    const el = elements.find((e) => e.id === id);
    if (!el || !isSceneShape(el) || !seatsACharacter(el.shape) || !hasSceneBox(el)) return;
    const seats = seatPoints({ ...el, shape: el.shape });
    const claim = claimRef.current;
    let index = claim?.index ?? 0;
    let renumbered = false;
    if (claim && claim.of !== undefined && claim.of !== seats.length) {
      const moved = claimOf(seats, { ...from, seat: claim });
      if (moved.index === SEAT_GONE) {
        stepAside(besideBox(el, from));
        return;
      }
      claimRef.current = moved;
      setSeatClaim(moved);
      index = moved.index;
      renumbered = true;
    }
    const seat = seats[index];
    if (!seat) return;
    const at = clearOfFences(
      { x: seat.x, y: seat.y },
      fences,
      fenceReachFor(avatarScale(config.size)),
    );
    if (
      Math.abs(at.x - from.x) < SEAT_FOLLOW_EPSILON &&
      Math.abs(at.y - from.y) < SEAT_FOLLOW_EPSILON
    ) {
      if (seat.facing !== facingRef.current || renumbered) {
        setFacing(seat.facing);
        publishIdle(from, seat.facing);
      }
      return;
    }
    posRef.current = at;
    setPos(at);
    setFacing(seat.facing);
    lastUnderFeetRef.current = id;
    publishIdle(at, seat.facing);
  });
  useEffect(() => {
    if (active) followSeat();
  }, [active, elements]);

  // Portals (docs/specs/009-elements/portal-element.md): walking a character ONTO a portal travels through it. Fired
  // from an effect on ARRIVAL (the element under the feet changed) rather than
  // every frame it stands there, and skipped for the portal it was just teleported
  // into until it steps off; otherwise the pair would bounce the character back
  // and forth forever.
  const arriveOn = useEffectEvent((standingOnId: string | null) => {
    const previous = lastUnderFeetRef.current;
    lastUnderFeetRef.current = standingOnId;
    if (standingOnId === null) {
      // Stepped off whatever it was on, including the portal it arrived in.
      arrivedPortalRef.current = null;
      return;
    }
    if (standingOnId === previous || standingOnId === arrivedPortalRef.current) return;
    const el = elements.find((e) => e.id === standingOnId);
    if (el && isSceneShape(el) && el.shape === 'portal') onWalkIntoPortal?.(el);
    // Chair (docs/specs/009-elements/chair.md): the same arrival hook, so sitting down costs no second
    // mechanism. Skipped while already seated somewhere.
    // A desk and a sofa seat a character the same way (docs/specs/009-elements/chair.md "Desk and sofa").
    // Only the chair a click-walk is going to (docs/specs/009-elements/chair.md "Only the chair you are going to"):
    // one crossed on the way somewhere else is walked through.
    if (
      el &&
      isSceneShape(el) &&
      seatsACharacter(el.shape) &&
      !seatedRef.current &&
      posRef.current &&
      hasSceneBox(el) &&
      // A Podium's walk ends on its speaker spot, which can lie just outside its box (lectern.ts catchArea).
      sitsOnEntry(catchArea(el), destRef.current ?? targetRef.current)
    ) {
      // The seat taken is the one nearest where the click that walked here landed (the walk's aim, inside the piece),
      // or, walked in by keys (no aim), the one nearest where the feet arrived (chair.md "Which seat").
      const aim = aimRef.current;
      aimRef.current = null;
      const box = catchArea(el);
      onWalkIntoChair?.(el, posRef.current, aim && sitsOnEntry(box, aim) ? aim : undefined);
    }
    // Reaction pad (livediagram/docs/specs/009-elements/reaction-pad.md). Fires on ARRIVAL like the others, so standing
    // on a pad throws one burst rather than one per frame; stepping off and
    // back on is a deliberate second press.
    if (el && isSceneShape(el) && el.shape === 'reaction-pad') onWalkIntoReactionPad?.(el);
    // Water cooler and coffee machine (docs/specs/009-elements/office.md "Using it"): a drink, on arrival.
    if (el && isSceneShape(el) && drinkFrom(el.shape)) onWalkIntoDrink?.(el);
  });
  // `elements` is read for the arrival lookup only (an effect event); the trigger is the change in what
  // the feet are on. The two refs are useAvatarWalk's, the same objects every render, so naming them never re-runs it.
  useEffect(() => {
    if (!active) {
      lastUnderFeetRef.current = null;
      arrivedPortalRef.current = null;
      return;
    }
    arriveOn(isActive ? standingOnId : null);
  }, [active, isActive, standingOnId, lastUnderFeetRef, arrivedPortalRef]);
}
