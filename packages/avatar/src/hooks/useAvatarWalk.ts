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

import {
  useCallback,
  useEffect,
  useEffectEvent,
  useInsertionEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createStateStore } from '@liveworkspace/workbench/lib/state-store';
import { useStoreSlice } from '@liveworkspace/workbench/hooks/ui/useStoreSlice';
import { mergePose, NO_POSE, posePlaced, type AvatarPose } from '../pose';
import { drinkFrom, DRINK_HOLD_MS, seatsACharacter, type DrinkKind } from '../office-geometry';
import { hasSceneBox, isSceneShape, type AvatarSceneElement, type SceneShapeOf } from '../scene';
import {
  clearOfFences,
  fenceReachFor,
  shutDoorLines,
  fenceSegments,
  fenceStalled,
  fenceStep,
  sameFences,
  type FenceSegment,
} from '../collision';
import { avatarScale, type AvatarConfig } from '../config';
import type { AvatarStatus } from '../status';
import { reactionPose, type AvatarReactionKind } from '../reactions';
import { useAvatarKeys, NO_KEYS_HELD, type AvatarHeldKeys } from './useAvatarKeys';
import { padEntry } from '../pad';
import { seatPoints } from '../seats';
import { newSeatClaim, type SeatClaim } from '../seat-claims';
import { avatarBindings } from '../bindings';
import { buildNavGrid, findWalkPath, type NavGrid } from '../pathing';
import {
  arrowDirection,
  centredCamera,
  elementUnderFeet,
  sitsOnEntry,
  facingFromDelta,
  followCorrection,
  hitTestAvatar,
  jumpStep,
  stepTowards,
  viewportOffsetCentredOn,
  waveFrame,
  AVATAR_HEARTBEAT_MS,
  AVATAR_JUMP_VELOCITY,
  AVATAR_SHOVE_DISTANCE,
  AVATAR_SPEED,
  AVATAR_WAVE_TAIL_MS,
  type AvatarFacing,
  type AvatarPoint,
} from '../walk';

// Canvas px of travel per leg swing. Tuned against AVATAR_SPEED so the
// cadence reads as a walk rather than a shuffle (~6 steps/second at speed).
const STEP_LENGTH = 22;
// How far, in canvas px, a seat may sit from our feet before we are moved onto it (a turned or moved piece).
const SEAT_FOLLOW_EPSILON = 0.5;

// What a peer needs to draw someone else's character (docs/specs/008-canvas/avatar-mode.md). Deliberately
// tiny: it rides the presence channel at cursor rates.
type AvatarSnapshot = {
  x: number;
  y: number;
  facing: AvatarFacing;
  // A reaction in progress (docs/specs/008-canvas/avatar-mode.md), as the kind plus how far into it the
  // sender is: `reactionPose` is pure, so a peer replays the same performance
  // from this rather than us shipping every pose field over the wire.
  reaction?: { kind: AvatarReactionKind; elapsedMs: number };
  // The whole costume (docs/specs/008-canvas/avatar-mode.md), so a peer draws the character you built.
  config: AvatarConfig;
  walking: boolean;
  stepFrame: number;
  // Height above the ground mid-jump, canvas px (0 = standing).
  lift: number;
  // Chair (docs/specs/009-elements/chair.md): the chair this character is sitting on, or undefined
  // when standing. Occupancy is presence, never document state, so a chair is
  // vacated for free when its sitter disconnects.
  seatedOn?: string | null;
  // Which seat, when and the tiebreak (docs/specs/009-elements/chair.md "Occupancy is presence"), while seated.
  seat?: SeatClaim | null;
  // A drink in the hand (docs/specs/009-elements/office.md "Using it"), or none.
  holding?: DrinkKind | null;
  // How the person is (docs/specs/008-canvas/avatar-mode.md "Status"), or none.
  status?: AvatarStatus | null;
  // Flag-wave frame, or null when the flag is down.
  wave: number | null;
};

const NO_FENCES: FenceSegment[] = [];

// How long the tab's walls must hold still before a standing character is nudged clear of one moved onto it
// (docs/specs/009-elements/fence.md "What does not walk"): a drag changes them every frame, and the nudge waits for
// the drop.
export const FENCE_SETTLE_MS = 150;

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
}: {
  // True while the Avatar canvas tool is the active tool.
  active: boolean;
  // The character's costume (useAvatarConfig): published to peers, and its
  // size scales the right-click hit box.
  config: AvatarConfig;
  // How the person is (docs/specs/008-canvas/avatar-mode.md "Status"): rides every snapshot.
  status?: AvatarStatus | null;
  // Right-clicking the character flips male / female — the costume state lives
  // in useAvatarConfig (it persists), so the flip is delegated to it.
  onToggleGender: () => void;
  elements: readonly E[];
  mainRef: React.RefObject<HTMLElement | null> | React.ForwardedRef<HTMLElement>;
  wrapperRef: React.RefObject<HTMLDivElement | null>;
  // The view's offset: a value from a render, or, where a pan renders nothing (livehuddle's canvas writes it outside
  // React, docs/specs/008-canvas/canvas-performance.md), a reader of the store the loop asks each frame.
  viewportOffset?: AvatarPoint;
  readViewportOffset?: () => AvatarPoint;
  viewportZoom: number;
  setViewportOffset: (offset: AvatarPoint) => void;
  // A one-shot spawn point for the NEXT entry into the mode, in canvas px:
  // pressing a Selection Mode button (docs/specs/009-elements/mode-button.md) puts the character at that
  // button rather than the viewport centre. A ref, not a value, because it is
  // written during the same interaction that flips `active` and is consumed by
  // the entry effect below — which then clears it, so the palette's own way in
  // still spawns centre-screen.
  spawnAtRef?: React.MutableRefObject<AvatarPoint | null>;
  // A one-shot pad for the NEXT entry: pressing an Avatar Pad (docs/specs/009-elements/avatar-pad.md "Pressing it")
  // starts the walk on that pad rather than the one nearest the view's centre. Cleared once used, like spawnAtRef.
  spawnPadRef?: React.MutableRefObject<string | null>;
  // Publishes the local character to the room so peers can see it, and
  // `null` on exit so they drop it. Throttling lives in the broadcaster.
  onPresence?: (snapshot: AvatarSnapshot | null) => void;
  // How many other people are in the room (the roster's size, yourself not counted), for the standing heartbeat:
  // none means nobody to tell, so it rests (docs/specs/008-canvas/avatar-mode.md "Realtime"). Unset where the
  // editor does not know, which keeps the plain heartbeat.
  peers?: number;
  // Portal (docs/specs/009-elements/portal-element.md): the character walked onto a portal element. Fired once on
  // ARRIVAL, not every frame it stands there, and never for the portal it just
  // came out of.
  onWalkIntoPortal?: (element: SceneShapeOf<E>) => void;
  // Chair (docs/specs/009-elements/chair.md): the character walked onto a chair, a desk or a sofa.
  // Fired once on ARRIVAL, like the portal above, with where the feet were when they got there (a
  // sofa seats you on the cushion nearest that point).
  onWalkIntoChair?: (element: SceneShapeOf<E>, feet: AvatarPoint) => void;
  // Reaction pad (docs/specs/009-elements/reaction-pad.md): the character walked onto a pad. Same arrival
  // hook as the portal and the chair, so a pad costs no third mechanism.
  onWalkIntoReactionPad?: (element: SceneShapeOf<E>) => void;
  // The office's machines (docs/specs/009-elements/office.md "Using it"): the character walked onto a water
  // cooler or a coffee machine. Fired once on ARRIVAL, like the portal and the chair.
  onWalkIntoDrink?: (element: SceneShapeOf<E>) => void;
  // How the view follows a walk (docs/specs/008-canvas/avatar-mode.md "The camera"): 'edge' pans only when the
  // character nears an edge; 'centred' keeps it in the middle and gravitates back after a hand pan.
  camera?: 'edge' | 'centred';
}) {
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

  // Entry: spawn at the viewport centre, or keep the remembered spot when it
  // is still on screen (so a quick detour to Select doesn't teleport the
  // avatar, but panning away — or switching tabs — gives you a fresh one at
  // hand instead of one stranded off-screen).
  // The body reads the live viewport (rects, centre, zoom) at the moment `active` flips, as an effect
  // event, so a zoom or pan never re-runs it (which would needlessly re-spawn).
  //
  // Leaving the mode drops any walk / hop in progress (the position stays) and
  // vacates the chair, like disconnecting does. What render shows of that is
  // reset while rendering, keyed on `active`; the loop's refs and the
  // publish to peers are reset by the effect below.
  const [wasActive, setWasActive] = useState(active);
  if (active !== wasActive) {
    setWasActive(active);
    if (!active) {
      setSeatedOn(null);
      setSeatClaim(null);
      setDrink(null);
    }
  }
  const enterOrLeave = useEffectEvent((isActive: boolean) => {
    if (!isActive) {
      // Nothing drawn: the walk, hop, wave and reaction end with the mode, and the spot stays in the ref.
      poseStore.set((prev) =>
        mergePose(prev, { pos: null, walking: false, lift: 0, wave: null, pose: null }),
      );
      activeRef.current = false;
      stopWalk();
      heldRef.current = { ...NO_KEYS_HELD };
      liftRef.current = 0;
      jumpVyRef.current = 0;
      waveStartRef.current = null;
      reactionRef.current = null;
      publishedLookRef.current = null;
      // Tell peers to drop our character.
      onPresence?.(null);
      seatedRef.current = null;
      claimRef.current = null;
      holdingRef.current = null;
      return;
    }
    activeRef.current = true;
    // The remembered spot shows again; the entry below may move it.
    if (posRef.current) setPos(posRef.current);
    const r = rects();
    const centre = viewportCentre();
    const onScreen = (p: AvatarPoint) => {
      if (!r) return false;
      const sx = r.wrapper.left + p.x * viewportZoom;
      const sy = r.wrapper.top + p.y * viewportZoom;
      return sx >= r.main.left && sx <= r.main.right && sy >= r.main.top && sy <= r.main.bottom;
    };
    // Put down clear of the fences and room walls it lands beside (docs/specs/009-elements/fence.md "What does not
    // walk"): a spawn inside a wall's reach otherwise opened held there, where a click past the wall did nothing
    // (Work Tracker #437). One put down in a wall itself stays, free to walk off either side.
    const reach = fenceReachFor(avatarScale(config.size));
    const place = (point: AvatarPoint) => {
      const clear = clearOfFences(point, fences, reach);
      posRef.current = clear;
      setPos(clear);
      setFacing('down');
    };
    // An Avatar Pad on the tab (docs/specs/009-elements/avatar-pad.md "Starting on the pad") is the board's
    // entrance: it wins over the button and the remembered spot, and the view comes to it when it is off screen.
    const pressedPad = spawnPadRef?.current ?? null;
    if (spawnPadRef) spawnPadRef.current = null;
    const pressed = pressedPad ? elements.filter((el) => el.id === pressedPad) : [];
    const entry = padEntry(pressed.length > 0 ? pressed : elements, centre, onScreen);
    if (entry) {
      if (spawnAtRef) spawnAtRef.current = null;
      place(entry.feet);
      if (entry.recentre && r) {
        setViewportOffset(
          viewportOffsetCentredOn(
            { ...entry.feet, width: 0, height: 0 },
            { width: r.main.width, height: r.main.height },
            viewportZoom,
          ),
        );
      }
      avatarBindings.track('Canvas', 'Used', 'AvatarPadArrival');
      return;
    }
    // A button asked for the character HERE: honour it even if the remembered
    // position is still on screen, since the press is a fresh instruction.
    const requested = spawnAtRef?.current ?? null;
    if (requested) {
      if (spawnAtRef) spawnAtRef.current = null;
      place(requested);
      // A low Walk In put it within the follow margin of an edge, or just past it (feet under the bottom-right
      // cluster or the tab bar): the view comes just far enough to bring it in, as the walk's camera follow does (Work
      // Tracker #484). Opening walking sets the same spot before its fit, which replaces this and judges the view again.
      if (r) follow(posRef.current!, r);
      return;
    }
    if (!centre) return;
    const current = posRef.current;
    if (!(current && onScreen(current))) place(centre);
    // The remembered spot stays, unless a wall was put beside it while the mode was off.
    else if (clearOfFences(current, fences, reach) !== current) place(current);
  });
  useEffect(() => {
    enterOrLeave(active);
  }, [active]);
  // Build the route grid while the browser is idle after the walls change (docs/specs/008-canvas/avatar-mode.md
  // "Finding the way"), so the next click routes at once: ~13 ms on a 100-room board, once per change, never per frame.
  const prebuild = useEffectEvent(() => {
    navGrid();
  });
  useEffect(() => {
    if (!active || fences.length === 0) return;
    const idle = globalThis.requestIdleCallback;
    if (idle) {
      const handle = idle(() => prebuild(), { timeout: 1000 });
      return () => globalThis.cancelIdleCallback(handle);
    }
    const handle = setTimeout(() => prebuild(), 200);
    return () => clearTimeout(handle);
  }, [active, fences, config.size]);

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
    const len = Math.hypot(dx, dy) || 1;
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

  // The animation loop. Only runs while the mode is active, and only writes
  // state on frames where something actually changed, so an idle avatar costs
  // one no-op rAF callback per frame and no re-renders.
  // One frame of the walk, as an effect event: it reads the newest facing, costume, zoom and callbacks,
  // so the loop below attaches once per activation instead of re-attaching whenever they change.
  const frame = useEffectEvent((now: number, dt: number) => {
    const from = posRef.current;
    if (from) {
      // Arrow-key steering (a direction) or a click-walk (a target); the
      // key listeners clear the target, so only one is ever live.
      const held = arrowDirection(heldRef.current);
      const travel = AVATAR_SPEED * dt;
      const step = held ? null : stepTowards(from, targetRef.current, dt);
      const wanted = held
        ? { x: from.x + held.x * travel, y: from.y + held.y * travel }
        : step!.pos;
      // Fences (docs/specs/009-elements/fence.md "Blocking"): a step into one is refused, or slides
      // along it. A click-walk that can make no progress stops rather than pressing on forever.
      const fenced = fenceStep(from, wanted, fences, fenceReachFor(avatarScale(config.size)));
      const next = fenced.pos;
      if (
        fenced.blocked &&
        !held &&
        targetRef.current &&
        fenceStalled(
          Math.hypot(next.x - from.x, next.y - from.y),
          Math.hypot(wanted.x - from.x, wanted.y - from.y),
        )
      ) {
        // Stopped by a wall: close enough to where it was going (a peer standing by a fence) is arriving there, so
        // what was waiting on the arrival (the shove) still happens; further off, the walk just ends.
        const target = destRef.current ?? targetRef.current;
        const near =
          Math.hypot(target.x - next.x, target.y - next.y) <=
          2 * fenceReachFor(avatarScale(config.size));
        stopWalk();
        const arrived = near ? arriveRef.current : null;
        arriveRef.current = null;
        arrived?.();
      }
      // Target reached — drop it so the avatar goes idle rather than
      // re-arriving on every subsequent frame, and fire whatever was waiting
      // on the arrival (the shove, docs/specs/008-canvas/avatar-mode.md). `stepTowards` already decides
      // this, including the within-a-hair case; re-deriving it here from the
      // coordinates was a second, subtly different definition of "arrived".
      if (!held && !fenced.blocked && targetRef.current && step?.arrived) {
        // A corner of the route: on to its next leg, nothing has arrived yet.
        const leg = legsRef.current.shift();
        if (leg) targetRef.current = leg;
        else {
          // The route's end: where it was going, or, when that could not be reached, the nearest point that could,
          // which counts as arriving only when it is near (a push lands on a peer beside a shut door).
          const dest = destRef.current;
          const end = targetRef.current;
          const near =
            !dest ||
            Math.hypot(dest.x - end.x, dest.y - end.y) <=
              2 * fenceReachFor(avatarScale(config.size));
          stopWalk();
          const arrived = near ? arriveRef.current : null;
          arriveRef.current = null;
          arrived?.();
        }
      }
      const dx = next.x - from.x;
      const dy = next.y - from.y;
      const moved = Math.hypot(dx, dy);
      // This frame's changes to what is drawn, written to the pose store once at the end: a frame that changes
      // nothing notifies nobody, so an idle character renders nothing.
      const patch: Partial<AvatarPose> = {};
      // --- Reactions (docs/specs/008-canvas/avatar-mode.md) ---
      // A reaction owns the pose (and its own hop height) for its duration.
      const playing = reactionRef.current;
      if (playing) {
        const elapsed = now - playing.startedAt;
        const next = reactionPose(playing.kind, elapsed);
        if (next.done) {
          reactionRef.current = null;
          patch.pose = null;
          patch.lift = 0;
          liftRef.current = 0;
        } else {
          patch.pose = next;
          // The reaction's hop drives the same lift the jump uses, so the
          // contact shadow and the sprite's rise come along for free.
          liftRef.current = next.lift;
          patch.lift = next.lift;
          if (next.facing) patch.facing = next.facing;
        }
      }
      // --- Jump + flag wave ---
      if (!playing && liftRef.current > 0) {
        const hop = jumpStep(liftRef.current, jumpVyRef.current, dt);
        liftRef.current = hop.lift;
        jumpVyRef.current = hop.vy;
        patch.lift = hop.lift;
      }
      if (waveStartRef.current !== null) {
        const frame = waveFrame(
          now - waveStartRef.current,
          // The wave outlasts the hop by a beat, so it reads as a
          // celebration rather than stopping dead on landing.
          AVATAR_WAVE_TAIL_MS + 600,
        );
        patch.wave = frame;
        if (frame === null) waveStartRef.current = null;
      }
      if (moved > 0) {
        posRef.current = next;
        travelledRef.current += moved;
        patch.pos = next;
        patch.stepFrame = Math.floor(travelledRef.current / STEP_LENGTH) % 2;
        patch.walking = true;
        const nextFacing = facingFromDelta(dx, dy);
        if (nextFacing) patch.facing = nextFacing;
        // Camera: keep the avatar centred, or clear of the viewport edges.
        const r = rects();
        if (r) {
          if (camera === 'centred') centreStep(from, next, r);
          else follow(next, r);
        }
      } else {
        patch.walking = false;
      }
      show(patch);
      // Publish to the room. The broadcaster throttles; sending only on
      // frames where the character is doing something (moving, airborne, or
      // waving) keeps an idle avatar off the wire entirely.
      if (
        moved > 0 ||
        liftRef.current > 0 ||
        waveStartRef.current !== null ||
        reactionRef.current !== null
      ) {
        const live = reactionRef.current;
        onPresence?.({
          x: next.x,
          y: next.y,
          facing: facingRef.current,
          config,
          walking: moved > 0,
          stepFrame: Math.floor(travelledRef.current / STEP_LENGTH) % 2,
          lift: liftRef.current,
          wave: waveStartRef.current === null ? null : 0,
          ...seatFields(),
          holding: holdingRef.current,
          // Only when set: a missing status reads as none, and a walk sends ~30 a second.
          ...(status ? { status } : null),
          ...(live ? { reaction: { kind: live.kind, elapsedMs: now - live.startedAt } } : null),
        });
      }
    }
  });
  useEffect(() => {
    if (!active) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000); // cap after a tab-out
      last = now;
      frame(now, dt);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active]);

  // Publish a STANDING snapshot on entry and whenever the look flips, so a peer
  // sees the character (and any costume change) without waiting for it to move.
  // Movement publishes from the loop instead. `placed` is in the deps because the
  // position arrives a commit after `active` flips — keying on `active` alone published
  // a null position, i.e. nothing, and a peer saw no character until the
  // walker moved (which needs animation frames the tab may not be getting).
  const publishStanding = useEffectEvent((at: AvatarPoint) => {
    // The costume and the status: a change to either is worth telling the room at once.
    const costume = JSON.stringify([config, status]);
    if (publishedLookRef.current === costume) return;
    publishedLookRef.current = costume;
    onPresence?.({
      x: at.x,
      y: at.y,
      facing: facingRef.current,
      config,
      walking: false,
      stepFrame: 0,
      lift: 0,
      wave: null,
      ...seatFields(),
      holding: holdingRef.current,
      // Only when set: a missing status reads as none, and a walk sends ~30 a second.
      ...(status ? { status } : null),
    });
  });
  // Placed or not, as a by-value slice of the pose: the host renders when the character appears or goes, never for
  // a step.
  const placed = useStoreSlice(poseStore, posePlaced);
  // The facing is read from its ref (the snapshot's value only), since re-publishing on a turn would
  // fight the loop, which already publishes while walking.
  useEffect(() => {
    if (active && placed && posRef.current) publishStanding(posRef.current);
  }, [active, placed, config, status]);

  // Which element the avatar is standing on (the "you are here" ring). Cheap rectangle scan, run on each change of
  // the pose (and of the board, a new selector), held by value: the host renders only when the element changes.
  const underFeet = useCallback(
    (p: AvatarPose) => (p.pos ? elementUnderFeet(elements, p.pos) : null),
    [elements],
  );
  const standingOnId = useStoreSlice(poseStore, underFeet);
  const isActive = active && placed;

  // An idle snapshot, for the heartbeat and for a change that is not a step (a drink taken or put down).
  const publishIdle = (at: AvatarPoint, faceTo: AvatarFacing = facingRef.current) =>
    onPresence?.({
      x: at.x,
      y: at.y,
      facing: faceTo,
      config,
      walking: false,
      stepFrame: 0,
      lift: 0,
      wave: null,
      ...seatFields(),
      holding: holdingRef.current,
      // Only when set: a missing status reads as none, and a walk sends ~30 a second.
      ...(status ? { status } : null),
    });
  // Take a drink (docs/specs/009-elements/office.md "Using it"): held for DRINK_HOLD_MS, replacing any other,
  // and told to the room at once rather than at the next step.
  // Whether the loop is publishing this frame (walking, airborne, waving, reacting): then it carries the drink in its
  // next snapshot, and an idle one here would tell the room the character stopped, cutting off its walk or reaction.
  const inMotion = () => {
    const keys = heldRef.current;
    return (
      targetRef.current !== null ||
      keys.up ||
      keys.down ||
      keys.left ||
      keys.right ||
      liftRef.current > 0 ||
      waveStartRef.current !== null ||
      reactionRef.current !== null
    );
  };
  const giveDrink = (kind: DrinkKind) => {
    holdingRef.current = kind;
    setDrink((prev) => ({ kind, seq: (prev?.seq ?? 0) + 1 }));
    if (posRef.current && !inMotion()) publishIdle(posRef.current);
  };
  const putDown = useEffectEvent(() => {
    holdingRef.current = null;
    setDrink(null);
    if (posRef.current && !inMotion()) publishIdle(posRef.current);
  });
  useEffect(() => {
    if (!drink) return;
    const t = window.setTimeout(() => putDown(), DRINK_HOLD_MS);
    return () => window.clearTimeout(t);
  }, [drink]);

  // A fence or room moved, pasted or resized onto a standing character (docs/specs/009-elements/fence.md "What does
  // not walk", Work Tracker #493): once the walls have held still for FENCE_SETTLE_MS, a character left inside one's
  // reach is nudged clear of it, as an entry is. Never per drag frame: each change only restarts the wait. A seated
  // character stays on its seat.
  const settleFences = useEffectEvent(() => {
    const at = posRef.current;
    if (!at || seatedRef.current) return;
    const clear = clearOfFences(at, fences, fenceReachFor(avatarScale(config.size)));
    if (clear === at) return;
    posRef.current = clear;
    setPos(clear);
    if (!inMotion()) publishIdle(clear);
  });
  useEffect(() => {
    if (!active) return;
    const t = window.setTimeout(() => settleFences(), FENCE_SETTLE_MS);
    return () => window.clearTimeout(t);
  }, [active, fences]);

  // Standing heartbeat. The publish above only fires on a CHANGE, so a
  // character that arrived before you did was invisible to you until it next
  // moved — the worst case being a presenter standing still while they talk.
  // A slow republish (every few seconds, only while idle) fixes that for the
  // price of one packet per peer per interval, well under the ~30 Hz the walk
  // itself costs.
  //
  // Only to someone who can see it (docs/specs/008-canvas/avatar-mode.md "Realtime"): each beat wakes the room's
  // Durable Object, so it rests while nobody else is in the room or the tab is hidden, and one beat goes out at
  // once when someone joins or the tab comes back, so a newcomer still sees a character standing still.
  // `evenHidden`: a join is told from a hidden tab too, since nothing else would show them the character.
  const heartbeat = useEffectEvent((evenHidden = false) => {
    if (peers === 0) return;
    if (!evenHidden && document.visibilityState === 'hidden') return;
    const at = posRef.current;
    // Only while genuinely idle: a walk publishes at its own rate, and a
    // reaction / jump is a performance the peer is already following.
    if (!at || targetRef.current || reactionRef.current || liftRef.current > 0) return;
    publishIdle(at);
  });
  useEffect(() => {
    if (!active) return;
    const beat = window.setInterval(() => heartbeat(), AVATAR_HEARTBEAT_MS);
    const onVisibility = () => heartbeat();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.clearInterval(beat);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [active]);
  // Someone joined: one beat now rather than at the next tick, which a hidden tab never sends. Kept current while
  // the mode is off too, so entering it is not mistaken for a join (entry publishes its own standing snapshot).
  const peersBeforeRef = useRef(peers);
  useEffect(() => {
    const before = peersBeforeRef.current;
    peersBeforeRef.current = peers;
    if (active && peers !== undefined && peers > (before ?? 0)) heartbeat(true);
  }, [active, peers]);

  // A piece turned or moved while we sit in it carries us (livehuddle's docs/specs/009-elements/furniture-facing.md
  // "Somebody sitting in it is carried round"): our feet go to the seat we hold, at its new place, facing its new way,
  // and we stay seated. Read off the board on every change of it; a piece that is gone, or no longer seats anyone,
  // leaves us where we are. Only the sitter's own machine moves them, as with every move, so the room sees it in our
  // presence rather than working it out itself.
  const followSeat = useEffectEvent(() => {
    const id = seatedRef.current;
    const from = posRef.current;
    if (!id || !from) return;
    const el = elements.find((e) => e.id === id);
    if (!el || !isSceneShape(el) || !seatsACharacter(el.shape) || !hasSceneBox(el)) return;
    const seat = seatPoints({ ...el, shape: el.shape })[claimRef.current?.index ?? 0];
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
      if (seat.facing !== facingRef.current) {
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
  // into until it steps off — otherwise the pair would bounce the character back
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
      sitsOnEntry(el, destRef.current ?? targetRef.current)
    ) {
      onWalkIntoChair?.(el, posRef.current);
    }
    // Reaction pad (docs/specs/009-elements/reaction-pad.md). Fires on ARRIVAL like the others, so standing
    // on a pad throws one burst rather than one per frame; stepping off and
    // back on is a deliberate second press.
    if (el && isSceneShape(el) && el.shape === 'reaction-pad') onWalkIntoReactionPad?.(el);
    // Water cooler and coffee machine (docs/specs/009-elements/office.md "Using it"): a drink, on arrival.
    if (el && isSceneShape(el) && drinkFrom(el.shape)) onWalkIntoDrink?.(el);
  });
  // `elements` is read for the arrival lookup only (an effect event); the trigger is the change in what
  // the feet are on.
  useEffect(() => {
    if (!active) {
      lastUnderFeetRef.current = null;
      arrivedPortalRef.current = null;
      return;
    }
    arriveOn(isActive ? standingOnId : null);
  }, [active, isActive, standingOnId]);

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
