// Avatar mode state (spec/101), lifted out of Canvas the same way
// useSpotlight is: the click-to-walk handler, the jump, the look toggle, the
// per-frame animation loop, and the camera nudge all read one source of truth.
//
// The avatar lives in CANVAS coordinates (unlike the spotlight beam, which
// is screen-space): it stands IN the diagram, so it has to pan and zoom
// with the content. Position is the FEET, so it stands on the point you
// clicked rather than being centred over it. Nothing here is persisted or
// written to the change log; the only thing that leaves the browser is the
// ephemeral presence snapshot handed to `onPresence` for peers (spec/101
// Realtime), which the room relays like a cursor.

import { useEffect, useRef, useState } from 'react';
import type { Element } from '@livediagram/diagram';
import { useAvatarKeys, NO_KEYS_HELD, type AvatarHeldKeys } from '@/hooks/canvas/useAvatarKeys';
import {
  arrowDirection,
  elementUnderFeet,
  facingFromDelta,
  followCorrection,
  hitTestAvatar,
  jumpStep,
  stepTowards,
  waveFrame,
  AVATAR_JUMP_VELOCITY,
  AVATAR_SPEED,
  AVATAR_WAVE_TAIL_MS,
  type AvatarFacing,
  type AvatarLook,
  type AvatarPoint,
} from '@/lib/avatar-walk';

// Canvas px of travel per leg swing. Tuned against AVATAR_SPEED so the
// cadence reads as a walk rather than a shuffle (~6 steps/second at speed).
const STEP_LENGTH = 22;

// What a peer needs to draw someone else's character (spec/101). Deliberately
// tiny: it rides the presence channel at cursor rates.
export type AvatarSnapshot = {
  x: number;
  y: number;
  facing: AvatarFacing;
  look: AvatarLook;
  walking: boolean;
  stepFrame: number;
  // Height above the ground mid-jump, canvas px (0 = standing).
  lift: number;
  // Flag-wave frame, or null when the flag is down.
  wave: number | null;
};

export function useAvatarWalk({
  active,
  elements,
  mainRef,
  wrapperRef,
  viewportOffset,
  viewportZoom,
  setViewportOffset,
  onPresence,
}: {
  // True while the Avatar canvas tool is the active tool.
  active: boolean;
  elements: Element[];
  mainRef: React.RefObject<HTMLElement | null> | React.ForwardedRef<HTMLElement>;
  wrapperRef: React.RefObject<HTMLDivElement | null>;
  viewportOffset: AvatarPoint;
  viewportZoom: number;
  setViewportOffset: (offset: AvatarPoint) => void;
  // Publishes the local character to the room so peers can see it, and
  // `null` on exit so they drop it. Throttling lives in the broadcaster.
  onPresence?: (snapshot: AvatarSnapshot | null) => void;
}) {
  // Rendered state. `pos` survives a detour to another tool (Canvas stays
  // mounted), so coming back finds the avatar where you left it; null until
  // the mode is entered for the first time.
  const [pos, setPos] = useState<AvatarPoint | null>(null);
  const [facing, setFacing] = useState<AvatarFacing>('down');
  // Total distance walked, in canvas px. Drives the leg swing off DISTANCE
  // rather than wall-clock, so the cadence matches the speed at any zoom.
  const [travelled, setTravelled] = useState(0);
  const [walking, setWalking] = useState(false);
  // Jump height above the ground (canvas px) and the flag-wave frame.
  const [lift, setLift] = useState(0);
  const [wave, setWave] = useState<number | null>(null);
  // Which sprite is drawn. Right-clicking the character flips it.
  const [look, setLook] = useState<AvatarLook>('male');

  // Loop-internal state. Refs (not state) because the rAF tick reads and
  // writes these many times between renders.
  const posRef = useRef<AvatarPoint | null>(null);
  const targetRef = useRef<AvatarPoint | null>(null);
  const heldRef = useRef<AvatarHeldKeys>({ ...NO_KEYS_HELD });
  const travelledRef = useRef(0);
  // Jump physics + when the current wave started (null = not waving).
  const liftRef = useRef(0);
  const jumpVyRef = useRef(0);
  const waveStartRef = useRef<number | null>(null);
  // Which look was last published as a standing snapshot; null = nothing
  // published since the mode was entered. Keeps the entry publish to once.
  const publishedLookRef = useRef<AvatarLook | null>(null);
  posRef.current = pos;
  // Latest viewport offset, for the camera follow. The loop can't take a
  // functional state update (Canvas's prop is a value setter), so it reads the
  // current offset through a ref repointed on every render. Safe because the
  // follow correction is recomputed from the LIVE wrapper rect each frame, so
  // it converges even if a frame lands before React has re-rendered.
  const offsetRef = useRef(viewportOffset);
  offsetRef.current = viewportOffset;
  // Presence publisher, reached through a ref so the loop never re-attaches
  // just because the editor re-rendered.
  const presenceRef = useRef(onPresence);
  presenceRef.current = onPresence;

  const mainNode = () => (mainRef && 'current' in mainRef ? mainRef.current : null);

  // Screen-space rects the loop needs. Read fresh each frame: the wrapper's
  // rect moves as the camera pans (including the pan this very hook applies).
  const rects = () => {
    const main = mainNode()?.getBoundingClientRect();
    const wrapper = wrapperRef.current?.getBoundingClientRect();
    return main && wrapper ? { main, wrapper } : null;
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
  useEffect(() => {
    if (!active) {
      // Leaving the mode drops any walk / hop in progress; the position stays.
      targetRef.current = null;
      heldRef.current = { ...NO_KEYS_HELD };
      liftRef.current = 0;
      jumpVyRef.current = 0;
      waveStartRef.current = null;
      publishedLookRef.current = null;
      setWalking(false);
      setLift(0);
      setWave(null);
      // Tell peers to drop our character.
      presenceRef.current?.(null);
      return;
    }
    const r = rects();
    const centre = viewportCentre();
    if (!centre) return;
    const current = posRef.current;
    const onScreen =
      current && r
        ? (() => {
            const sx = r.wrapper.left + current.x * viewportZoom;
            const sy = r.wrapper.top + current.y * viewportZoom;
            return (
              sx >= r.main.left && sx <= r.main.right && sy >= r.main.top && sy <= r.main.bottom
            );
          })()
        : false;
    if (!onScreen) {
      posRef.current = centre;
      setPos(centre);
      setFacing('down');
    }
    // viewportCentre / rects read live refs; re-running on zoom changes would
    // needlessly re-spawn, so the entry effect keys on `active` alone.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  // Click / tap anywhere on the canvas: walk there. Arrow-key steering wins
  // while keys are held (the walk target would fight it).
  const walkTo = (point: AvatarPoint) => {
    if (!arrowDirection(heldRef.current)) targetRef.current = point;
  };

  // Space: hop, and wave the flag for the hop plus a short tail. Ignored
  // while already airborne so the jump can't be re-triggered mid-flight.
  const jump = () => {
    if (liftRef.current > 0) return;
    jumpVyRef.current = AVATAR_JUMP_VELOCITY;
    liftRef.current = 0.001; // off the ground, so the loop takes over
    waveStartRef.current = performance.now();
  };

  // Right-click ON the character toggles male / female (spec/101). Returns
  // true when the press actually landed on the figure, so the caller knows
  // whether the right-click was consumed.
  const toggleLookAt = (point: AvatarPoint): boolean => {
    const feet = posRef.current;
    if (!feet || !hitTestAvatar(feet, point, liftRef.current)) return false;
    setLook((prev) => (prev === 'male' ? 'female' : 'male'));
    return true;
  };

  useAvatarKeys({
    active,
    heldRef,
    // Steering cancels a click-walk so the two never pull in opposite
    // directions.
    onSteer: () => {
      targetRef.current = null;
    },
    onJump: jump,
  });

  // The animation loop. Only runs while the mode is active, and only writes
  // state on frames where something actually changed, so an idle avatar costs
  // one no-op rAF callback per frame and no re-renders.
  useEffect(() => {
    if (!active) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000); // cap after a tab-out
      last = now;
      const from = posRef.current;
      if (from) {
        // Arrow-key steering (a direction) or a click-walk (a target); the
        // key listeners clear the target, so only one is ever live.
        const held = arrowDirection(heldRef.current);
        const travel = AVATAR_SPEED * dt;
        const next = held
          ? { x: from.x + held.x * travel, y: from.y + held.y * travel }
          : stepTowards(from, targetRef.current, dt).pos;
        // Target reached — drop it so the avatar goes idle rather than
        // re-arriving on every subsequent frame.
        if (
          !held &&
          targetRef.current &&
          next.x === targetRef.current.x &&
          next.y === targetRef.current.y
        )
          targetRef.current = null;
        const dx = next.x - from.x;
        const dy = next.y - from.y;
        const moved = Math.hypot(dx, dy);
        // --- Jump + flag wave ---
        if (liftRef.current > 0) {
          const hop = jumpStep(liftRef.current, jumpVyRef.current, dt);
          liftRef.current = hop.lift;
          jumpVyRef.current = hop.vy;
          setLift(hop.lift);
        }
        if (waveStartRef.current !== null) {
          const frame = waveFrame(
            now - waveStartRef.current,
            // The wave outlasts the hop by a beat, so it reads as a
            // celebration rather than stopping dead on landing.
            AVATAR_WAVE_TAIL_MS + 600,
          );
          setWave(frame);
          if (frame === null) waveStartRef.current = null;
        }
        if (moved > 0) {
          posRef.current = next;
          travelledRef.current += moved;
          setPos(next);
          setTravelled(travelledRef.current);
          setWalking(true);
          const nextFacing = facingFromDelta(dx, dy);
          if (nextFacing) setFacing(nextFacing);
          // Camera follow: keep the avatar clear of the viewport edges. The
          // correction is already in canvas px, so it applies straight to the
          // viewport offset (which is translated before the zoom scale).
          const r = rects();
          if (r) {
            const screen = {
              x: r.wrapper.left + next.x * viewportZoom - r.main.left,
              y: r.wrapper.top + next.y * viewportZoom - r.main.top,
            };
            const fix = followCorrection(
              screen,
              { width: r.main.width, height: r.main.height },
              viewportZoom,
            );
            if (fix.x !== 0 || fix.y !== 0) {
              const prev = offsetRef.current;
              setViewportOffset({ x: prev.x + fix.x, y: prev.y + fix.y });
            }
          }
        } else {
          setWalking(false);
        }
        // Publish to the room. The broadcaster throttles; sending only on
        // frames where the character is doing something (moving, airborne, or
        // waving) keeps an idle avatar off the wire entirely.
        if (moved > 0 || liftRef.current > 0 || waveStartRef.current !== null) {
          presenceRef.current?.({
            x: next.x,
            y: next.y,
            facing: facingFromDelta(dx, dy) ?? facing,
            look,
            walking: moved > 0,
            stepFrame: Math.floor(travelledRef.current / STEP_LENGTH) % 2,
            lift: liftRef.current,
            wave: waveStartRef.current === null ? null : 0,
          });
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // setViewportOffset is a stable state setter; viewportZoom is read for
    // the follow maths and re-attaching the loop on a zoom change is fine.
    // `facing` / `look` are only read as fallbacks for the presence packet.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, viewportZoom, setViewportOffset]);

  // Publish a STANDING snapshot on entry and whenever the look flips, so a peer
  // sees the character (and any costume change) without waiting for it to move.
  // Movement publishes from the loop instead. `pos` is in the deps because it
  // arrives a commit after `active` flips — keying on `active` alone published
  // a null position, i.e. nothing, and a peer saw no character until the
  // walker moved (which needs animation frames the tab may not be getting).
  useEffect(() => {
    if (!active || !pos) return;
    if (publishedLookRef.current === look) return;
    publishedLookRef.current = look;
    presenceRef.current?.({
      x: pos.x,
      y: pos.y,
      facing,
      look,
      walking: false,
      stepFrame: 0,
      lift: 0,
      wave: null,
    });
    // `facing` is read as the snapshot's value only; re-publishing on a turn
    // would fight the loop, which already publishes while walking.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, pos, look]);

  // Which element the avatar is standing on (the "you are here" ring). Cheap
  // rectangle scan, and only while the mode is on.
  const standingOnId = active && pos ? elementUnderFeet(elements, pos) : null;

  return {
    pos: active ? pos : null,
    facing,
    walking,
    look,
    lift,
    wave,
    // Two-frame leg swing, advanced by distance walked.
    stepFrame: Math.floor(travelled / STEP_LENGTH) % 2,
    standingOnId,
    walkTo,
    jump,
    toggleLookAt,
  };
}
