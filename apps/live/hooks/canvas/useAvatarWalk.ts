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
import { avatarScale, type AvatarConfig } from '@/lib/avatar-config';
import { reactionPose, type AvatarReactionKind, type ReactionPose } from '@/lib/avatar-reactions';
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
  AVATAR_HEARTBEAT_MS,
  AVATAR_JUMP_VELOCITY,
  AVATAR_SHOVE_DISTANCE,
  AVATAR_SPEED,
  AVATAR_WAVE_TAIL_MS,
  type AvatarFacing,
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
  // A reaction in progress (spec/101), as the kind plus how far into it the
  // sender is: `reactionPose` is pure, so a peer replays the same performance
  // from this rather than us shipping every pose field over the wire.
  reaction?: { kind: AvatarReactionKind; elapsedMs: number };
  // The whole costume (spec/101), so a peer draws the character you built.
  config: AvatarConfig;
  walking: boolean;
  stepFrame: number;
  // Height above the ground mid-jump, canvas px (0 = standing).
  lift: number;
  // Chair (spec/130): the chair this character is sitting on, or undefined
  // when standing. Occupancy is presence, never document state, so a chair is
  // vacated for free when its sitter disconnects.
  seatedOn?: string | null;
  // Flag-wave frame, or null when the flag is down.
  wave: number | null;
};

export function useAvatarWalk({
  active,
  config,
  onToggleGender,
  elements,
  mainRef,
  wrapperRef,
  viewportOffset,
  viewportZoom,
  setViewportOffset,
  spawnAtRef,
  onPresence,
  onWalkIntoPortal,
  onWalkIntoChair,
}: {
  // True while the Avatar canvas tool is the active tool.
  active: boolean;
  // The character's costume (useAvatarConfig): published to peers, and its
  // size scales the right-click hit box.
  config: AvatarConfig;
  // Right-clicking the character flips male / female — the costume state lives
  // in useAvatarConfig (it persists), so the flip is delegated to it.
  onToggleGender: () => void;
  elements: Element[];
  mainRef: React.RefObject<HTMLElement | null> | React.ForwardedRef<HTMLElement>;
  wrapperRef: React.RefObject<HTMLDivElement | null>;
  viewportOffset: AvatarPoint;
  viewportZoom: number;
  setViewportOffset: (offset: AvatarPoint) => void;
  // A one-shot spawn point for the NEXT entry into the mode, in canvas px:
  // pressing a Selection Mode button (spec/103) puts the character at that
  // button rather than the viewport centre. A ref, not a value, because it is
  // written during the same interaction that flips `active` and is consumed by
  // the entry effect below — which then clears it, so the palette's own way in
  // still spawns centre-screen.
  spawnAtRef?: React.MutableRefObject<AvatarPoint | null>;
  // Publishes the local character to the room so peers can see it, and
  // `null` on exit so they drop it. Throttling lives in the broadcaster.
  onPresence?: (snapshot: AvatarSnapshot | null) => void;
  // Portal (spec/104): the character walked onto a portal element. Fired once on
  // ARRIVAL, not every frame it stands there, and never for the portal it just
  // came out of.
  onWalkIntoPortal?: (element: import('@livediagram/diagram').ShapeElement) => void;
  // Chair (spec/130): the character walked onto a chair. Fired once on ARRIVAL,
  // like the portal above.
  onWalkIntoChair?: (element: import('@livediagram/diagram').ShapeElement) => void;
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
  // The pose of a reaction in progress, or null while just standing / walking.
  const [pose, setPose] = useState<ReactionPose | null>(null);
  // Chair (spec/130): the chair this character is sitting on, or null when
  // standing. Kept in state (the sprite and the presence packet both read it)
  // AND in a ref (the rAF tick and walkTo read it between renders).
  const [seatedOn, setSeatedOn] = useState<string | null>(null);

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
  // Which reaction is playing and when it started (performance.now()).
  const reactionRef = useRef<{ kind: AvatarReactionKind; startedAt: number } | null>(null);
  // Portals (spec/104): the element the feet were on last frame (so a walk-in
  // fires once, on arrival), and the portal the character was just teleported
  // into — ignored until it steps off, so a portal doesn't ping-pong.
  const lastUnderFeetRef = useRef<string | null>(null);
  const arrivedPortalRef = useRef<string | null>(null);
  // Fires once when the current walk target is reached, then clears itself.
  const arriveRef = useRef<(() => void) | null>(null);
  const portalRef = useRef(onWalkIntoPortal);
  portalRef.current = onWalkIntoPortal;
  const chairRef = useRef(onWalkIntoChair);
  chairRef.current = onWalkIntoChair;
  const seatedRef = useRef<string | null>(null);
  // The costume last published as a standing snapshot; null = nothing published
  // since the mode was entered. Keeps the entry publish to once per change.
  const publishedLookRef = useRef<string | null>(null);
  // Live costume for the loop's presence packets + the hit-test scale.
  const configRef = useRef(config);
  configRef.current = config;
  // Facing, for the heartbeat below: a ref so the timer's dep list stays fixed
  // (a dep array that changes length is a React error) and it never re-arms.
  const facingRef = useRef(facing);
  facingRef.current = facing;
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
  const offsetRef = useRef(viewportOffset);
  const offsetWrittenRef = useRef<AvatarPoint | null>(null);
  if (
    offsetWrittenRef.current === null ||
    viewportOffset.x !== offsetWrittenRef.current.x ||
    viewportOffset.y !== offsetWrittenRef.current.y
  ) {
    offsetRef.current = viewportOffset;
  }
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
      reactionRef.current = null;
      setPose(null);
      publishedLookRef.current = null;
      setWalking(false);
      setLift(0);
      setWave(null);
      // Tell peers to drop our character.
      presenceRef.current?.(null);
      // Leaving the mode vacates the chair, like disconnecting does.
      seatedRef.current = null;
      setSeatedOn(null);
      return;
    }
    // A button asked for the character HERE: honour it even if the remembered
    // position is still on screen, since the press is a fresh instruction.
    const requested = spawnAtRef?.current ?? null;
    if (requested) {
      if (spawnAtRef) spawnAtRef.current = null;
      posRef.current = requested;
      setPos(requested);
      setFacing('down');
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
  // while keys are held (the walk target would fight it). `onArrive` fires once
  // when the character reaches the point — clicking a PEER walks over and
  // shoves them (spec/101), and the shove has to land on arrival, not on click.
  const walkTo = (point: AvatarPoint, onArrive?: () => void) => {
    if (arrowDirection(heldRef.current)) return;
    // Seated (spec/130): clicking elsewhere on the canvas must not drag the
    // character out of its chair by accident. Standing up is a deliberate act
    // — an arrow key, or the seat's own Stand press.
    if (seatedRef.current) return;
    targetRef.current = point;
    arriveRef.current = onArrive ?? null;
  };

  // Take a shove from a peer: slide a short way along their direction. It walks
  // rather than teleports, so both people see the same little stumble, and it
  // drops whatever walk was in progress — being pushed interrupts you.
  const shove = (dx: number, dy: number) => {
    const from = posRef.current;
    if (!from) return;
    const len = Math.hypot(dx, dy) || 1;
    heldRef.current = { ...NO_KEYS_HELD };
    arriveRef.current = null;
    targetRef.current = {
      x: from.x + (dx / len) * AVATAR_SHOVE_DISTANCE,
      y: from.y + (dy / len) * AVATAR_SHOVE_DISTANCE,
    };
  };

  // Play one of the panel's reactions (spec/101). It performs ON THE SPOT, so
  // any walk in progress is dropped — sliding through a routine looks like a
  // bug — and re-clicking restarts it rather than queueing.
  const playReaction = (kind: AvatarReactionKind) => {
    targetRef.current = null;
    heldRef.current = { ...NO_KEYS_HELD };
    reactionRef.current = { kind, startedAt: performance.now() };
  };

  // Chair (spec/130): sit down. Snaps the feet to the seat point (so the
  // figure sits ON the chair rather than wherever it happened to arrive),
  // drops any walk in progress, and remembers the chair so the sprite draws a
  // seated pose and peers see the seat taken.
  const sitOn = (chairId: string, seat: AvatarPoint) => {
    targetRef.current = null;
    arriveRef.current = null;
    heldRef.current = { ...NO_KEYS_HELD };
    posRef.current = seat;
    setPos(seat);
    seatedRef.current = chairId;
    setSeatedOn(chairId);
    // Remembered as "what the feet are on" so standing up and staying put
    // doesn't immediately re-seat the character.
    lastUnderFeetRef.current = chairId;
  };

  const standUp = () => {
    if (!seatedRef.current) return;
    seatedRef.current = null;
    setSeatedOn(null);
  };

  // Portals (spec/104): drop the character at a point (the far portal's threshold),
  // without walking there. `arrivedPortalId` is remembered so standing in the exit
  // portal doesn't immediately trigger it again.
  const teleportTo = (point: AvatarPoint, arrivedPortalId?: string) => {
    targetRef.current = null;
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

  // Right-click ON the character toggles male / female (spec/101). Returns
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
      targetRef.current = null;
      // An arrow key is how you stand up (spec/130): a deliberate act, and one
      // that leaves the character where the chair put it, free to walk off.
      if (seatedRef.current) {
        seatedRef.current = null;
        setSeatedOn(null);
      }
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
        const step = held ? null : stepTowards(from, targetRef.current, dt);
        const next = held
          ? { x: from.x + held.x * travel, y: from.y + held.y * travel }
          : step!.pos;
        // Target reached — drop it so the avatar goes idle rather than
        // re-arriving on every subsequent frame, and fire whatever was waiting
        // on the arrival (the shove, spec/101). `stepTowards` already decides
        // this, including the within-a-hair case; re-deriving it here from the
        // coordinates was a second, subtly different definition of "arrived".
        if (!held && targetRef.current && step?.arrived) {
          targetRef.current = null;
          const arrived = arriveRef.current;
          arriveRef.current = null;
          arrived?.();
        }
        const dx = next.x - from.x;
        const dy = next.y - from.y;
        const moved = Math.hypot(dx, dy);
        // --- Reactions (spec/101) ---
        // A reaction owns the pose (and its own hop height) for its duration.
        const playing = reactionRef.current;
        if (playing) {
          const elapsed = now - playing.startedAt;
          const next = reactionPose(playing.kind, elapsed);
          if (next.done) {
            reactionRef.current = null;
            setPose(null);
            setLift(0);
            liftRef.current = 0;
          } else {
            setPose(next);
            // The reaction's hop drives the same lift the jump uses, so the
            // contact shadow and the sprite's rise come along for free.
            liftRef.current = next.lift;
            setLift(next.lift);
            if (next.facing) setFacing(next.facing);
          }
        }
        // --- Jump + flag wave ---
        if (!playing && liftRef.current > 0) {
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
              const nextOffset = { x: prev.x + fix.x, y: prev.y + fix.y };
              offsetRef.current = nextOffset;
              offsetWrittenRef.current = nextOffset;
              setViewportOffset(nextOffset);
            }
          }
        } else {
          setWalking(false);
        }
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
          presenceRef.current?.({
            x: next.x,
            y: next.y,
            facing: facingFromDelta(dx, dy) ?? facing,
            config: configRef.current,
            walking: moved > 0,
            stepFrame: Math.floor(travelledRef.current / STEP_LENGTH) % 2,
            lift: liftRef.current,
            wave: waveStartRef.current === null ? null : 0,
            seatedOn: seatedRef.current,
            ...(live ? { reaction: { kind: live.kind, elapsedMs: now - live.startedAt } } : null),
          });
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // setViewportOffset is a stable state setter; viewportZoom is read for
    // the follow maths and re-attaching the loop on a zoom change is fine.
    // `facing` is only read as a fallback for the presence packet; the costume
    // comes through configRef.
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
    const costume = JSON.stringify(config);
    if (publishedLookRef.current === costume) return;
    publishedLookRef.current = costume;
    presenceRef.current?.({
      x: pos.x,
      y: pos.y,
      facing,
      config,
      walking: false,
      stepFrame: 0,
      lift: 0,
      wave: null,
      seatedOn: seatedRef.current,
    });
    // `facing` is read as the snapshot's value only; re-publishing on a turn
    // would fight the loop, which already publishes while walking.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, pos, config]);

  // Which element the avatar is standing on (the "you are here" ring). Cheap
  // rectangle scan, and only while the mode is on.
  const standingOnId = active && pos ? elementUnderFeet(elements, pos) : null;

  // Standing heartbeat. The publish above only fires on a CHANGE, so a
  // character that arrived before you did was invisible to you until it next
  // moved — the worst case being a presenter standing still while they talk.
  // A slow republish (every few seconds, only while idle) fixes that for the
  // price of one packet per peer per interval, well under the ~30 Hz the walk
  // itself costs.
  useEffect(() => {
    if (!active) return;
    const beat = window.setInterval(() => {
      const at = posRef.current;
      // Only while genuinely idle: a walk publishes at its own rate, and a
      // reaction / jump is a performance the peer is already following.
      if (!at || targetRef.current || reactionRef.current || liftRef.current > 0) return;
      presenceRef.current?.({
        x: at.x,
        y: at.y,
        facing: facingRef.current,
        config: configRef.current,
        walking: false,
        stepFrame: 0,
        lift: 0,
        wave: null,
        seatedOn: seatedRef.current,
      });
    }, AVATAR_HEARTBEAT_MS);
    return () => window.clearInterval(beat);
  }, [active]);

  // Portals (spec/104): walking a character ONTO a portal travels through it. Fired
  // from an effect on ARRIVAL (the element under the feet changed) rather than
  // every frame it stands there, and skipped for the portal it was just teleported
  // into until it steps off — otherwise the pair would bounce the character back
  // and forth forever.
  useEffect(() => {
    if (!active) {
      lastUnderFeetRef.current = null;
      arrivedPortalRef.current = null;
      return;
    }
    const previous = lastUnderFeetRef.current;
    lastUnderFeetRef.current = standingOnId;
    if (standingOnId === null) {
      // Stepped off whatever it was on, including the portal it arrived in.
      arrivedPortalRef.current = null;
      return;
    }
    if (standingOnId === previous || standingOnId === arrivedPortalRef.current) return;
    const el = elements.find((e) => e.id === standingOnId);
    if (el && el.type === 'shape' && el.shape === 'portal') portalRef.current?.(el);
    // Chair (spec/130): the same arrival hook, so sitting down costs no second
    // mechanism. Skipped while already seated somewhere.
    if (el && el.type === 'shape' && el.shape === 'chair' && !seatedRef.current) {
      chairRef.current?.(el);
    }
    // `elements` is read for the arrival lookup only; the trigger is the change
    // in what the feet are on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, standingOnId]);

  return {
    pos: active ? pos : null,
    facing,
    walking,
    lift,
    wave,
    // Two-frame leg swing, advanced by distance walked.
    stepFrame: Math.floor(travelled / STEP_LENGTH) % 2,
    standingOnId,
    pose,
    seatedOn,
    sitOn,
    standUp,
    walkTo,
    jump,
    playReaction,
    teleportTo,
    toggleLookAt,
    shove,
  };
}
