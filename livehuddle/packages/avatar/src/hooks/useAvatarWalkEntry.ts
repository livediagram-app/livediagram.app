// Entering and leaving Avatar mode (useAvatarWalk.ts, docs/specs/008-canvas/avatar-mode.md): where the character
// appears, what leaving resets, and the route grid built ahead in idle time. Called by useAvatarWalk in its place.

import { useEffect, useEffectEvent, useState } from 'react';
import { mergePose, type AvatarPose } from '../pose';
import type { DrinkKind } from '../office-geometry';
import type { AvatarSceneElement } from '../scene';
import { fenceReachFor, type FenceSegment } from '../collision';
import { freeSpawnPoint } from '../spawn-point';
import { avatarScale, type AvatarConfig } from '../config';
import { NO_KEYS_HELD, type AvatarHeldKeys } from './useAvatarKeys';
import { padEntry } from '../pad';
import type { SeatClaim } from '../seat-claims';
import { avatarBindings } from '../bindings';
import type { NavGrid } from '../pathing';
import {
  AVATAR_HEIGHT,
  viewportOffsetCentredOn,
  type AvatarFacing,
  type AvatarPoint,
} from '../walk';
import type { Dispatch, RefObject, SetStateAction } from 'react';
import type { StateStore } from '@liveworkspace/workbench/lib/state-store';
import type { AvatarSnapshot, HeldDrink, PlayingReaction, WalkRects } from './avatarWalkTypes';

export function useAvatarWalkEntry<E extends AvatarSceneElement>({
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
}: {
  active: boolean;
  setSeatedOn: Dispatch<SetStateAction<string | null>>;
  setSeatClaim: Dispatch<SetStateAction<SeatClaim | null>>;
  setDrink: Dispatch<SetStateAction<HeldDrink | null>>;
  poseStore: StateStore<AvatarPose>;
  activeRef: RefObject<boolean>;
  stopWalk: () => void;
  heldRef: RefObject<AvatarHeldKeys>;
  liftRef: RefObject<number>;
  jumpVyRef: RefObject<number>;
  waveStartRef: RefObject<number | null>;
  reactionRef: RefObject<PlayingReaction | null>;
  publishedLookRef: RefObject<string | null>;
  onPresence?: (snapshot: AvatarSnapshot | null) => void;
  seatedRef: RefObject<string | null>;
  claimRef: RefObject<SeatClaim | null>;
  holdingRef: RefObject<DrinkKind | null>;
  posRef: RefObject<AvatarPoint | null>;
  setPos: (at: AvatarPoint) => void;
  setFacing: (facing: AvatarFacing) => void;
  rects: () => WalkRects | null;
  viewportCentre: () => AvatarPoint | null;
  viewportZoom: number;
  config: AvatarConfig;
  fences: FenceSegment[];
  spawnPadRef?: React.MutableRefObject<string | null>;
  spawnAtRef?: React.MutableRefObject<AvatarPoint | null>;
  elements: readonly E[];
  setViewportOffset: (offset: AvatarPoint) => void;
  follow: (at: AvatarPoint, r: WalkRects) => void;
  navGrid: () => NavGrid | null;
}) {
  // Entry: spawn at the viewport centre, or keep the remembered spot when it
  // is still on screen (so a quick detour to Select doesn't teleport the
  // avatar, but panning away (or switching tabs) gives you a fresh one at
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
    // (Work Tracker #437). One put down in a wall itself stays, free to walk off either side. One that would appear inside
    // a footprint (a pool's water, a plant's pot) appears on the nearest free floor instead (Work Tracker #610), a body's
    // height below any water.
    const reach = fenceReachFor(avatarScale(config.size));
    // A body's height clear below water (a pool, a pond), at the character's size (Work Tracker 706).
    const body = AVATAR_HEIGHT * avatarScale(config.size);
    const place = (point: AvatarPoint) => {
      const clear = freeSpawnPoint(point, fences, reach, body);
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
    // The remembered spot stays, unless a wall or a piece was put beside it or on it while the mode was off.
    else if (freeSpawnPoint(current, fences, reach, body) !== current) place(current);
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
}
