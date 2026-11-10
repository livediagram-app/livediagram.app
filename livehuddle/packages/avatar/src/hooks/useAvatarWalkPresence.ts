// What the room is told about a character standing still (useAvatarWalk.ts, docs/specs/008-canvas/avatar-mode.md
// "Realtime"): the standing snapshot, the idle one, the drink in the hand, the nudge clear of a wall moved onto it and
// the heartbeat. Also what the character is placed on. Called by useAvatarWalk in its place.

import { useCallback, useEffect, useEffectEvent, useRef } from 'react';
import { useStoreSlice } from '@liveworkspace/workbench/hooks/ui/useStoreSlice';
import { posePlaced, type AvatarPose } from '../pose';
import { DRINK_HOLD_MS, type DrinkKind } from '../office-geometry';
import type { AvatarSceneElement } from '../scene';
import { clearOfFences, fenceReachFor, type FenceSegment } from '../collision';
import { avatarScale, type AvatarConfig } from '../config';
import type { AvatarStatus } from '../status';
import type { AvatarHeldKeys } from './useAvatarKeys';
import type { SeatClaim } from '../seat-claims';
import {
  elementUnderFeet,
  AVATAR_HEARTBEAT_MS,
  type AvatarFacing,
  type AvatarPoint,
} from '../walk';
import type { Dispatch, RefObject, SetStateAction } from 'react';
import type { StateStore } from '@liveworkspace/workbench/lib/state-store';
import {
  FENCE_SETTLE_MS,
  type AvatarSnapshot,
  type HeldDrink,
  type PlayingReaction,
} from './avatarWalkTypes';

export function useAvatarWalkPresence<E extends AvatarSceneElement>({
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
}: {
  active: boolean;
  config: AvatarConfig;
  status: AvatarStatus | null;
  onPresence?: (snapshot: AvatarSnapshot | null) => void;
  peers?: number;
  elements: readonly E[];
  fences: FenceSegment[];
  poseStore: StateStore<AvatarPose>;
  publishedLookRef: RefObject<string | null>;
  facingRef: RefObject<AvatarFacing>;
  seatFields: () => { seatedOn: string | null; seat?: SeatClaim };
  holdingRef: RefObject<DrinkKind | null>;
  posRef: RefObject<AvatarPoint | null>;
  heldRef: RefObject<AvatarHeldKeys>;
  targetRef: RefObject<AvatarPoint | null>;
  liftRef: RefObject<number>;
  waveStartRef: RefObject<number | null>;
  reactionRef: RefObject<PlayingReaction | null>;
  seatedRef: RefObject<string | null>;
  setPos: (at: AvatarPoint) => void;
  drink: HeldDrink | null;
  setDrink: Dispatch<SetStateAction<HeldDrink | null>>;
}) {
  // Publish a STANDING snapshot on entry and whenever the look flips, so a peer
  // sees the character (and any costume change) without waiting for it to move.
  // Movement publishes from the loop instead. `placed` is in the deps because the
  // position arrives a commit after `active` flips, so keying on `active` alone published
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
  // fight the loop, which already publishes while walking. `posRef` is useAvatarWalk's ref, the same object every
  // render, so naming it never re-runs the effect.
  useEffect(() => {
    if (active && placed && posRef.current) publishStanding(posRef.current);
  }, [active, placed, config, status, posRef]);

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
  // moved, the worst case being a presenter standing still while they talk.
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
  return { placed, standingOnId, isActive, publishIdle, giveDrink };
}
