// Avatar mode's animation loop (useAvatarWalk.ts, docs/specs/008-canvas/avatar-mode.md): one frame of the walk, hop,
// wave and reaction per animation frame while the mode is on. Called by useAvatarWalk in its place.

import { useEffect, useEffectEvent } from 'react';
import type { AvatarPose } from '../pose';
import type { DrinkKind } from '../office-geometry';
import { fenceReachFor, fenceStalled, fenceStep, type FenceSegment } from '../collision';
import { avatarScale, type AvatarConfig } from '../config';
import type { AvatarStatus } from '../status';
import { reactionPose } from '../reactions';
import type { AvatarHeldKeys } from './useAvatarKeys';
import type { SeatClaim } from '../seat-claims';
import {
  arrowDirection,
  steadyFacing,
  jumpStep,
  stepTowards,
  waveFrame,
  AVATAR_RUN_FACTOR,
  AVATAR_SPEED,
  AVATAR_WAVE_TAIL_MS,
  type AvatarFacing,
  type AvatarPoint,
} from '../walk';
import type { RefObject } from 'react';
import {
  STEP_LENGTH,
  WALK_FRAMES,
  type AvatarSnapshot,
  type PlayingReaction,
  type WalkRects,
} from './avatarWalkTypes';

export function useAvatarWalkLoop({
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
  wakeRef,
}: {
  active: boolean;
  posRef: RefObject<AvatarPoint | null>;
  heldRef: RefObject<AvatarHeldKeys>;
  targetRef: RefObject<AvatarPoint | null>;
  destRef: RefObject<AvatarPoint | null>;
  legsRef: RefObject<AvatarPoint[]>;
  arriveRef: RefObject<(() => void) | null>;
  stopWalk: () => void;
  fences: FenceSegment[];
  config: AvatarConfig;
  status: AvatarStatus | null;
  camera: 'edge' | 'centred';
  reactionRef: RefObject<PlayingReaction | null>;
  liftRef: RefObject<number>;
  jumpVyRef: RefObject<number>;
  waveStartRef: RefObject<number | null>;
  travelledRef: RefObject<number>;
  facingRef: RefObject<AvatarFacing>;
  holdingRef: RefObject<DrinkKind | null>;
  rects: () => WalkRects | null;
  centreStep: (from: AvatarPoint, to: AvatarPoint, r: WalkRects) => void;
  follow: (at: AvatarPoint, r: WalkRects) => void;
  show: (patch: Partial<AvatarPose>) => void;
  onPresence?: (snapshot: AvatarSnapshot | null) => void;
  seatFields: () => { seatedOn: string | null; seat?: SeatClaim };
  // Set to the loop's wake while the mode is on: the walk's actions (a click-walk, a new arrow, a hop, a reaction, a
  // shove) call it after setting what the loop reads, so a still character asks for no frames at all.
  wakeRef: RefObject<() => void>;
}) {
  // The animation loop. Only runs while the mode is active and the character has something to do (avatar-mode.md
  // "A still character asks for no frames", canvas-performance.md "A still Space does nothing"): an arrow held, a
  // walk under way, a hop, a wave or a reaction. It runs one more frame once all of that is over, so the last frame
  // writes the stop (walking false) and the presence that goes with it, then sleeps until the next wake. It only
  // writes state on frames where something changed, so a frame that changes nothing renders nothing.
  // One frame of the walk, as an effect event: it reads the newest facing, costume, zoom and callbacks,
  // so the loop below attaches once per activation instead of re-attaching whenever they change.
  const frame = useEffectEvent((now: number, dt: number) => {
    const from = posRef.current;
    if (from) {
      // Arrow-key steering (a direction) or a click-walk (a target); the
      // key listeners clear the target, so only one is ever live.
      const held = arrowDirection(heldRef.current);
      // Shift held runs, by the arrows or to a click (avatar-mode.md "Running").
      const speed = AVATAR_SPEED * (heldRef.current.run ? AVATAR_RUN_FACTOR : 1);
      const travel = speed * dt;
      const step = held ? null : stepTowards(from, targetRef.current, dt, speed);
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
      // Target reached: drop it so the avatar goes idle rather than
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
        patch.stepFrame = Math.floor(travelledRef.current / STEP_LENGTH) % WALK_FRAMES;
        patch.walking = true;
        const nextFacing = steadyFacing(dx, dy, facingRef.current);
        if (nextFacing && nextFacing !== facingRef.current) patch.facing = nextFacing;
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
          stepFrame: Math.floor(travelledRef.current / STEP_LENGTH) % WALK_FRAMES,
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
    // Whether the character has anything to animate: read before and after each frame.
    const busy = () =>
      arrowDirection(heldRef.current) !== null ||
      targetRef.current !== null ||
      liftRef.current > 0 ||
      waveStartRef.current !== null ||
      reactionRef.current !== null;
    let raf = 0;
    let last = 0;
    const tick = (now: number) => {
      const dt = Math.min(0.05, Math.max(0, now - last) / 1000); // cap after a tab-out
      last = now;
      const was = busy();
      frame(now, dt);
      raf = was || busy() ? requestAnimationFrame(tick) : 0;
    };
    const wake = () => {
      if (raf !== 0) return;
      last = performance.now();
      raf = requestAnimationFrame(tick);
    };
    wakeRef.current = wake;
    // One frame on entry, for whatever the entry set going.
    wake();
    return () => {
      cancelAnimationFrame(raf);
      wakeRef.current = noop;
    };
  }, [active, wakeRef, heldRef, targetRef, liftRef, waveStartRef, reactionRef]);
}

const noop = () => {};
