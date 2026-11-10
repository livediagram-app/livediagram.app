// Avatar mode state (docs/specs/008-canvas/avatar-mode.md), lifted out of Canvas the same way
// useSpotlight is: the click-to-walk handler, the jump, the look toggle, the
// per-frame animation loop, and the camera nudge all read one source of truth.
//
// The avatar lives in CANVAS coordinates (unlike the spotlight beam, which
// is screen-space): it stands ON the canvas, so it has to pan and zoom
// with the content. Position is the FEET, so it stands on the point you
// clicked rather than being centred over it. Nothing here is persisted or
// written to the change log; the only thing that leaves the browser is the
// ephemeral presence snapshot handed to `onPresence` for peers (docs/specs/008-canvas/avatar-mode.md
// Realtime), which the room relays like a cursor.

import { useInsertionEffect, useMemo, useRef, useState } from 'react';
import { createStateStore } from '@liveworkspace/workbench/lib/state-store';
import { mergePose, NO_POSE, type AvatarPose } from '../pose';
import type { DrinkKind } from '../office-geometry';
import type { AvatarSceneElement } from '../scene';
import {
  clearOfFences,
  fenceReachFor,
  shutDoorLines,
  fenceSegments,
  sameFences,
  type FenceSegment,
} from '../collision';
import { avatarScale } from '../config';
import type { AvatarReactionKind } from '../reactions';
import { useAvatarKeys, NO_KEYS_HELD, type AvatarHeldKeys } from './useAvatarKeys';
import { newSeatClaim, type SeatClaim } from '../seat-claims';
import { avatarBindings } from '../bindings';
import { buildNavGrid, findWalkPath, type NavGrid } from '../pathing';
import {
  arrowDirection,
  centredCamera,
  elementUnderFeet,
  followCorrection,
  hitTestAvatar,
  AVATAR_JUMP_VELOCITY,
  AVATAR_SHOVE_DISTANCE,
  type AvatarFacing,
  type AvatarPoint,
} from '../walk';
import { NO_FENCES, type UseAvatarWalkOptions } from './avatarWalkTypes';
import { useAvatarWalkArrivals } from './useAvatarWalkArrivals';
import { useAvatarWalkEntry } from './useAvatarWalkEntry';
import { useAvatarWalkLoop } from './useAvatarWalkLoop';
import { useAvatarWalkPresence } from './useAvatarWalkPresence';

export { FENCE_SETTLE_MS } from './avatarWalkTypes';

export function useAvatarWalk<E extends AvatarSceneElement>({
  active,
  config,
  status = null,
  onToggleGender,
  elements,
  mainRef,
  wrapperRef,
  viewportOffset,
  readViewportOffset,
  viewportZoom,
  setViewportOffset,
  spawnAtRef,
  spawnPadRef,
  onPresence,
  peers,
  onWalkIntoPortal,
  onWalkIntoChair,
  onWalkIntoReactionPad,
  onWalkIntoDrink,
  camera = 'edge',
}: UseAvatarWalkOptions<E>) {
  // What the sprite draws frame to frame (the feet, facing, step, hop, wave and a reaction's pose), held in a store
  // rather than state (docs/specs/008-canvas/canvas-performance.md "Walking renders the characters, not the canvas";
  // blueprint: avatar-pose-store.md): a step renders what subscribes to it, never the canvas that owns this hook.
  // Its `pos` is null outside the mode; the loop's `posRef` remembers the spot through a detour to another tool
  // (Canvas stays mounted), so coming back finds the avatar where you left it.
  const [poseStore] = useState(() => createStateStore<AvatarPose>(NO_POSE));
  // Whether the mode is on, as the last enter or leave set it: a position set while it is off moves the ref only.
  const activeRef = useRef(false);
  // The facing as last drawn, for the presence snapshots and the seat's turn.
  const facingRef = useRef<AvatarFacing>('down');
  const show = (patch: Partial<AvatarPose>) => {
    if (patch.facing) facingRef.current = patch.facing;
    if (!activeRef.current) return;
    poseStore.set((prev) => mergePose(prev, patch));
  };
  const setPos = (at: AvatarPoint) => show({ pos: at });
  const setFacing = (facing: AvatarFacing) => show({ facing });
  // Chair (docs/specs/009-elements/chair.md): the chair this character is sitting on, or null when
  // standing. Kept in state (the sprite and the presence packet both read it)
  // AND in a ref (the rAF tick and walkTo read it between renders).
  const [seatedOn, setSeatedOn] = useState<string | null>(null);
  // Our claim on the seat (docs/specs/009-elements/chair.md "Occupancy is presence"): which one, when and the
  // tiebreak, so a peer who sat on it at the same moment settles who keeps it the way we do.
  const [seatClaim, setSeatClaim] = useState<SeatClaim | null>(null);
  const claimRef = useRef<SeatClaim | null>(null);
  // A drink in the hand (docs/specs/009-elements/office.md "Using it"): presence, like the seat, and put down
  // after DRINK_HOLD_MS or on leaving the mode.
  // `seq` changes with every drink taken, so taking the same drink again restarts its minute.
  const [drink, setDrink] = useState<{ kind: DrinkKind; seq: number } | null>(null);
  const holdingRef = useRef<DrinkKind | null>(null);

  // Loop-internal state. Refs (not state) because the rAF tick reads and
  // writes these many times between renders.
  const posRef = useRef<AvatarPoint | null>(null);
  // Fences (docs/specs/009-elements/fence.md): the lines the walk may not cross, worked out once per
  // change to the elements rather than per frame.
  // Only while the mode is on: a scan of the whole tab on every edit is wasted when nobody is walking.
  const fences = useMemo(() => (active ? fenceSegments(elements) : NO_FENCES), [active, elements]);
  // Shut Doors, which a walk into the room behind one heads for (pathing.ts shutDoorCell).
  const shutDoors = useMemo(
    () => (active ? shutDoorLines(elements) : NO_FENCES),
    [active, elements],
  );
  const targetRef = useRef<AvatarPoint | null>(null);
  // Finding the way (docs/specs/008-canvas/avatar-mode.md "Finding the way"): the route's legs still to walk after
  // the one `targetRef` holds, and where the walk is going in the end (the click), which sitting and arriving ask.
  const legsRef = useRef<AvatarPoint[]>([]);
  const destRef = useRef<AvatarPoint | null>(null);
  // The route grid, built when someone walks after the walls changed (never per frame, never while nobody walks).
  const navRef = useRef<{
    fences: readonly FenceSegment[];
    shutDoors: readonly FenceSegment[];
    reach: number;
    grid: NavGrid | null;
  } | null>(null);
  // The route grid for the walls as they are now: the one already built, else built here (useAvatarWalk builds it
  // ahead in idle time, below, so a click seldom pays for it).
  const navGrid = (): NavGrid | null => {
    if (fences.length === 0) return null;
    const reach = fenceReachFor(avatarScale(config.size));
    const nav = navRef.current;
    // By value: an edit that moves no wall (typing on a sticky, a peer dragging a card) makes new lists of the same
    // lines, and the grid built over them still stands rather than being built again (~20 ms on a big office).
    if (
      nav &&
      nav.reach === reach &&
      sameFences(nav.fences, fences) &&
      sameFences(nav.shutDoors, shutDoors)
    ) {
      nav.fences = fences;
      nav.shutDoors = shutDoors;
      return nav.grid;
    }
    const grid = buildNavGrid(fences, reach, shutDoors);
    navRef.current = { fences, shutDoors, reach, grid };
    return grid;
  };
  const stopWalk = () => {
    targetRef.current = null;
    legsRef.current = [];
    destRef.current = null;
  };
  const heldRef = useRef<AvatarHeldKeys>({ ...NO_KEYS_HELD });
  const travelledRef = useRef(0);
  // Jump physics + when the current wave started (null = not waving).
  const liftRef = useRef(0);
  const jumpVyRef = useRef(0);
  const waveStartRef = useRef<number | null>(null);
  // Which reaction is playing and when it started (performance.now()).
  const reactionRef = useRef<{ kind: AvatarReactionKind; startedAt: number } | null>(null);
  // Portals (docs/specs/009-elements/portal-element.md): the element the feet were on last frame (so a walk-in
  // fires once, on arrival), and the portal the character was just teleported
  // into — ignored until it steps off, so a portal doesn't ping-pong.
  const lastUnderFeetRef = useRef<string | null>(null);
  const arrivedPortalRef = useRef<string | null>(null);
  // Fires once when the current walk target is reached, then clears itself.
  const arriveRef = useRef<(() => void) | null>(null);
  const seatedRef = useRef<string | null>(null);
  // The costume last published as a standing snapshot; null = nothing published
  // since the mode was entered. Keeps the entry publish to once per change.
  const publishedLookRef = useRef<string | null>(null);
  // The seat in a presence snapshot: the piece, and our claim on it only while seated (a walk sends ~30 a second).
  const seatFields = () => ({
    seatedOn: seatedRef.current,
    ...(claimRef.current ? { seat: claimRef.current } : null),
  });
  // NOTE: posRef is deliberately NOT re-synced from `pos` on every render. The
  // LOOP owns the position; `pos` is a copy for rendering. Assigning
  // `posRef.current = pos` here used to walk the character BACKWARDS whenever
  // two animation frames landed between React commits (the render reset the ref
  // to the older committed position, so the next frame stepped from there
  // again) — which is why a diagonal, where the camera-follow queues extra
  // renders on both axes at once, jittered visibly.
  //
  // Camera follow. The loop can't take a functional state update (Canvas's prop
  // is a value setter), so it accumulates into this ref and remembers what it
  // wrote: a second frame before the commit then builds on the first instead of
  // overwriting it. A viewport change from ANYWHERE ELSE (pan, zoom, fit) won't
  // match what we last wrote, and is adopted.
  // The adoption runs in an insertion effect, before the loop's next frame can read the ref, rather
  // than during render.
  const offsetRef = useRef(viewportOffset ?? readViewportOffset?.() ?? { x: 0, y: 0 });
  const offsetWrittenRef = useRef<AvatarPoint | null>(null);
  const adoptOffset = (offset: AvatarPoint) => {
    const written = offsetWrittenRef.current;
    if (written === null || offset.x !== written.x || offset.y !== written.y) {
      offsetRef.current = offset;
    }
  };
  useInsertionEffect(() => {
    if (viewportOffset) adoptOffset(viewportOffset);
  }, [viewportOffset]);
  // From a reader: adopted when it changed since the last read, as the effect above adopts a new value.
  const lastReadRef = useRef<AvatarPoint | null>(null);
  const readOffset = () => {
    if (readViewportOffset) {
      const now = readViewportOffset();
      const last = lastReadRef.current;
      if (!last || last.x !== now.x || last.y !== now.y) {
        lastReadRef.current = now;
        adoptOffset(now);
      }
    }
    return offsetRef.current;
  };

  const mainNode = () => (mainRef && 'current' in mainRef ? mainRef.current : null);

  // Screen-space rects the loop needs. Read fresh each frame: the wrapper's
  // rect moves as the camera pans (including the pan this very hook applies).
  const rects = () => {
    const main = mainNode()?.getBoundingClientRect();
    const wrapper = wrapperRef.current?.getBoundingClientRect();
    return main && wrapper ? { main, wrapper } : null;
  };

  // Camera follow: when a point is within the follow margin of the view's edges (behind the bottom-right cluster, say),
  // move the view just far enough to bring it in. The correction is already in canvas px, so it applies straight to
  // the viewport offset (which is translated before the zoom scale).
  const follow = (at: AvatarPoint, r: NonNullable<ReturnType<typeof rects>>) => {
    const fix = followCorrection(
      {
        x: r.wrapper.left + at.x * viewportZoom - r.main.left,
        y: r.wrapper.top + at.y * viewportZoom - r.main.top,
      },
      { width: r.main.width, height: r.main.height },
      viewportZoom,
    );
    if (fix.x === 0 && fix.y === 0) return;
    const prev = readOffset();
    const nextOffset = { x: prev.x + fix.x, y: prev.y + fix.y };
    offsetRef.current = nextOffset;
    offsetWrittenRef.current = nextOffset;
    setViewportOffset(nextOffset);
  };

  // The centred camera (docs/specs/008-canvas/avatar-mode.md "The camera"): one step of the view after a move.
  const centreStep = (
    from: AvatarPoint,
    to: AvatarPoint,
    r: NonNullable<ReturnType<typeof rects>>,
  ) => {
    const prev = readOffset();
    const nextOffset = centredCamera(
      prev,
      from,
      to,
      { width: r.main.width, height: r.main.height },
      viewportZoom,
    );
    if (nextOffset.x === prev.x && nextOffset.y === prev.y) return;
    offsetRef.current = nextOffset;
    offsetWrittenRef.current = nextOffset;
    setViewportOffset(nextOffset);
  };

  // Where the avatar should appear when the mode is entered: the centre of
  // the visible viewport, in canvas coords.
  const viewportCentre = (): AvatarPoint | null => {
    const r = rects();
    if (!r) return null;
    return {
      x: (r.main.left + r.main.width / 2 - r.wrapper.left) / viewportZoom,
      y: (r.main.top + r.main.height / 2 - r.wrapper.top) / viewportZoom,
    };
  };

  // Entry and leaving the mode (useAvatarWalkEntry.ts).
  useAvatarWalkEntry({
    active,
    setSeatedOn,
    setSeatClaim,
    setDrink,
    poseStore,
    activeRef,
    stopWalk,
    heldRef,
    liftRef,
    jumpVyRef,
    waveStartRef,
    reactionRef,
    publishedLookRef,
    onPresence,
    seatedRef,
    claimRef,
    holdingRef,
    posRef,
    setPos,
    setFacing,
    rects,
    viewportCentre,
    viewportZoom,
    config,
    fences,
    spawnPadRef,
    spawnAtRef,
    elements,
    setViewportOffset,
    follow,
    navGrid,
  });

  // Click / tap anywhere on the canvas: walk there. Arrow-key steering wins
  // while keys are held (the walk target would fight it). `onArrive` fires once
  // when the character reaches the point — clicking a PEER walks over and
  // shoves them (docs/specs/008-canvas/avatar-mode.md), and the shove has to land on arrival, not on click.
  const walkTo = (point: AvatarPoint, onArrive?: () => void) => {
    if (arrowDirection(heldRef.current)) return;
    // Seated (docs/specs/009-elements/chair.md "Any movement stands you up", Work Tracker #560): a walk anywhere but the
    // piece you sit on stands you up and walks on, in the one gesture. A press on your own seat keeps you in it.
    if (seatedRef.current) {
      if (elementUnderFeet(elements, point) === seatedRef.current) return;
      standUp();
    }
    // Routed round the walls in the way (findWalkPath); with nothing in the way, the straight line it always was.
    const from = posRef.current;
    const route = from ? findWalkPath(navGrid(), from, point) : [point];
    targetRef.current = route[0]!;
    legsRef.current = route.slice(1);
    destRef.current = point;
    arriveRef.current = onArrive ?? null;
  };

  // Take a shove from a peer: slide a short way along their direction. It walks
  // rather than teleports, so both people see the same little stumble, and it
  // drops whatever walk was in progress — being pushed interrupts you.
  // A seated character cannot be pushed (docs/specs/009-elements/chair.md "Sitting"): the push is ignored.
  const shove = (dx: number, dy: number) => {
    const from = posRef.current;
    if (!from || seatedRef.current) return;
    // A direction that is not a number (a hand-made push) would walk the character to NaN for good: ignored.
    const len = Math.hypot(dx, dy);
    if (!Number.isFinite(len) || len === 0) return;
    heldRef.current = { ...NO_KEYS_HELD };
    arriveRef.current = null;
    // Direct, never routed: a push is a stumble, not a walk somewhere.
    stopWalk();
    targetRef.current = {
      x: from.x + (dx / len) * AVATAR_SHOVE_DISTANCE,
      y: from.y + (dy / len) * AVATAR_SHOVE_DISTANCE,
    };
  };

  // Play one of the panel's reactions (docs/specs/008-canvas/avatar-mode.md). It performs ON THE SPOT, so
  // any walk in progress is dropped — sliding through a routine looks like a
  // bug — and re-clicking restarts it rather than queueing.
  const playReaction = (kind: AvatarReactionKind) => {
    stopWalk();
    heldRef.current = { ...NO_KEYS_HELD };
    reactionRef.current = { kind, startedAt: performance.now() };
    // A move performed, never which (docs/specs/008-canvas/avatar-mode.md "Telemetry").
    avatarBindings.track('Canvas', 'Used', 'AvatarAction');
  };

  // Chair (docs/specs/009-elements/chair.md): sit down. Snaps the feet to the seat point (so the
  // figure sits ON the chair rather than wherever it happened to arrive),
  // turns the figure the way the seat points, drops any walk in progress, and
  // remembers the chair so the sprite draws a seated pose and peers see the
  // seat taken.
  // `index` is which of the piece's seats, carried with when we sat in our claim, and the room is told at once so the
  // seat reads taken before anyone else walks into it.
  // A seat beside a wall snaps the feet clear of the wall's reach (Work Tracker #493), so standing up never leaves
  // the character able to step only away from it.
  const sitOn = (chairId: string, at: AvatarPoint, seatFacing: AvatarFacing, index = 0) => {
    const seat = clearOfFences(at, fences, fenceReachFor(avatarScale(config.size)));
    stopWalk();
    arriveRef.current = null;
    heldRef.current = { ...NO_KEYS_HELD };
    posRef.current = seat;
    setPos(seat);
    setFacing(seatFacing);
    seatedRef.current = chairId;
    setSeatedOn(chairId);
    // Sitting down, never where (docs/specs/009-elements/chair.md "Telemetry").
    avatarBindings.track('Canvas', 'Used', 'Sit');
    const claim = newSeatClaim(index);
    claimRef.current = claim;
    setSeatClaim(claim);
    // Remembered as "what the feet are on" so standing up and staying put
    // doesn't immediately re-seat the character.
    lastUnderFeetRef.current = chairId;
    publishIdle(seat, seatFacing);
  };

  const unseat = () => {
    seatedRef.current = null;
    claimRef.current = null;
    setSeatedOn(null);
    setSeatClaim(null);
  };

  // Standing up frees the seat for everyone at once, not at the next heartbeat.
  const standUp = () => {
    if (!seatedRef.current) return;
    unseat();
    if (posRef.current) publishIdle(posRef.current);
  };

  // Stop at a point without walking there (docs/specs/009-elements/chair.md "Sitting"): beside a piece whose seats are
  // all taken, or beside a seat a peer sat in first. Stands up if seated, drops any walk, and does not count as
  // arriving on whatever is under the new spot, so stepping aside never seats you somewhere else.
  // The spot is put clear of any wall it lands beside (Work Tracker #493), as an entry is.
  const stepAside = (to: AvatarPoint) => {
    const point = clearOfFences(to, fences, fenceReachFor(avatarScale(config.size)));
    stopWalk();
    arriveRef.current = null;
    heldRef.current = { ...NO_KEYS_HELD };
    if (seatedRef.current) unseat();
    posRef.current = point;
    setPos(point);
    lastUnderFeetRef.current = elementUnderFeet(elements, point);
    publishIdle(point);
  };

  // Portals (docs/specs/009-elements/portal-element.md): drop the character at a point (the far portal's threshold),
  // without walking there. `arrivedPortalId` is remembered so standing in the exit
  // portal doesn't immediately trigger it again.
  const teleportTo = (point: AvatarPoint, arrivedPortalId?: string) => {
    stopWalk();
    heldRef.current = { ...NO_KEYS_HELD };
    posRef.current = point;
    setPos(point);
    arrivedPortalRef.current = arrivedPortalId ?? null;
    lastUnderFeetRef.current = arrivedPortalId ?? null;
  };

  // Space: hop, and wave the flag for the hop plus a short tail. Ignored
  // while already airborne so the jump can't be re-triggered mid-flight.
  const jump = () => {
    if (liftRef.current > 0) return;
    jumpVyRef.current = AVATAR_JUMP_VELOCITY;
    liftRef.current = 0.001; // off the ground, so the loop takes over
    waveStartRef.current = performance.now();
  };

  // Right-click ON the character toggles male / female (docs/specs/008-canvas/avatar-mode.md). Returns
  // true when the press actually landed on the figure, so the caller knows
  // whether the right-click was consumed. The hit box follows the Size choice.
  const toggleLookAt = (point: AvatarPoint): boolean => {
    const feet = posRef.current;
    if (!feet || !hitTestAvatar(feet, point, liftRef.current, avatarScale(config.size)))
      return false;
    onToggleGender();
    return true;
  };

  useAvatarKeys({
    active,
    heldRef,
    // Steering cancels a click-walk so the two never pull in opposite
    // directions.
    onSteer: () => {
      stopWalk();
      // An arrow key stands you up and walks on (docs/specs/009-elements/chair.md "Any movement stands you up"); keys
      // typed into a field never reach here (useAvatarKeys' isTypingTarget guard).
      standUp();
    },
    onJump: jump,
  });

  // The animation loop (useAvatarWalkLoop.ts).
  useAvatarWalkLoop({
    active,
    posRef,
    heldRef,
    targetRef,
    destRef,
    legsRef,
    arriveRef,
    stopWalk,
    fences,
    config,
    status,
    camera,
    reactionRef,
    liftRef,
    jumpVyRef,
    waveStartRef,
    travelledRef,
    facingRef,
    holdingRef,
    rects,
    centreStep,
    follow,
    show,
    onPresence,
    seatFields,
  });

  // The standing and idle snapshots, the drink and the heartbeat (useAvatarWalkPresence.ts).
  const { standingOnId, isActive, publishIdle, giveDrink } = useAvatarWalkPresence({
    active,
    config,
    status,
    onPresence,
    peers,
    elements,
    fences,
    poseStore,
    publishedLookRef,
    facingRef,
    seatFields,
    holdingRef,
    posRef,
    heldRef,
    targetRef,
    liftRef,
    waveStartRef,
    reactionRef,
    seatedRef,
    setPos,
    drink,
    setDrink,
  });

  // Carried with a seat, and arriving on a piece (useAvatarWalkArrivals.ts).
  useAvatarWalkArrivals({
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
    targetRef,
    lastUnderFeetRef,
    arrivedPortalRef,
    setPos,
    setFacing,
    publishIdle,
    onWalkIntoPortal,
    onWalkIntoChair,
    onWalkIntoReactionPad,
    onWalkIntoDrink,
  });

  return {
    // What the sprite draws frame to frame (AvatarSelfWalker subscribes to it; useAvatarPose takes a slice).
    poseStore,
    // In the mode with a position: changes when the character appears or goes, never for a step.
    placed: isActive,
    // The live position (the loop owns it), for handlers and the editor's Fit and zoom anchor; null outside the mode.
    readPos: () => (active ? posRef.current : null),
    standingOnId: isActive ? standingOnId : null,
    seatedOn,
    seatClaim,
    holding: active ? (drink?.kind ?? null) : null,
    giveDrink,
    sitOn,
    standUp,
    stepAside,
    walkTo,
    jump,
    playReaction,
    teleportTo,
    toggleLookAt,
    shove,
  };
}
