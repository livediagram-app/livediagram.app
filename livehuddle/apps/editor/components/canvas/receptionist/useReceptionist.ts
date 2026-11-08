'use client';

// Drives the Receptionist on this screen (docs/specs/008-canvas/receptionist.md): his world for the tab's walls, the detour he is
// on (greeting an arrival, or coming over to talk to you), and the clock that moves him. One animation frame loop runs
// only while he walks or plays a reaction; standing, one timer wakes him at his next change. Nothing is sent.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Element } from '@livehuddle/document';
import type { PadArrival } from '@liveworkspace/avatar/pad';
import type { AvatarPoint } from '@liveworkspace/avatar/walk';
import { buildNavGrid } from '@liveworkspace/avatar/pathing';
import { fenceReachFor, fenceSegments, shutDoorLines } from '@liveworkspace/avatar/collision';
import {
  nearestRoomSpot,
  receptionistWorld,
  type ReceptionistWorld,
} from '@/lib/receptionist/receptionist-day';
import { onBellRung, SELF_RINGER } from '@/lib/office/reception-bell';
import {
  bellDetour,
  greetDetour,
  leadDetour,
  releaseDetour,
  receptionistNextChangeMs,
  receptionistPose,
  talkDetour,
  type ReceptionistDetour,
  type ReceptionistPose,
} from '@/lib/receptionist/receptionist-timeline';
import { RECEPTIONIST_TOPICS } from '@/lib/receptionist/receptionist-topics';
import {
  closeReceptionist,
  getReceptionistState,
  noteReceptionistGreetedYou,
  openReceptionist,
  useReceptionistState,
} from '@/lib/receptionist/receptionist-store';
import { useReducedMotion } from '@/lib/reduced-motion';
import { track } from '@/lib/telemetry';
import { useLatest } from '@liveworkspace/workbench/hooks/ui/useLatest';

// Your own character in the arrival list (useAvatarPadArrivals keys it apart from every peer).
const SELF = 'self';

const NO_DETOUR: { padId: string | null; detour: ReceptionistDetour | null } = {
  padId: null,
  detour: null,
};

export type ReceptionistView = {
  world: ReceptionistWorld;
  pose: ReceptionistPose;
};

/** The world on this tab, built once per change to the elements, only while you walk. */
function useReceptionistWorld(
  active: boolean,
  elements: readonly Element[],
): ReceptionistWorld | null {
  return useMemo(() => {
    if (!active) return null;
    const fences = fenceSegments(elements);
    const grid = buildNavGrid(fences, fenceReachFor(1), shutDoorLines(elements));
    return receptionistWorld(elements, grid);
  }, [active, elements]);
}

export function useReceptionist({
  active,
  elements,
  arrivals,
  self,
}: {
  // You are walking on this tab.
  active: boolean;
  elements: readonly Element[];
  arrivals: readonly PadArrival[];
  self: AvatarPoint | null;
}): ReceptionistView | null {
  const world = useReceptionistWorld(active, elements);
  const still = useReducedMotion();
  const { chat, asks } = useReceptionistState();
  // The detour he is on, kept with his pad's id: an edit to the tab keeps it, another tab (another pad) drops it.
  const [held, setHeld] = useState<{ padId: string | null; detour: ReceptionistDetour | null }>(
    NO_DETOUR,
  );
  const padId = world?.padId ?? null;
  const detour = held.padId === padId ? held.detour : null;
  // The detour as last set, so a change is worked out once, outside a state updater (which React may run twice).
  const detourRef = useRef<{ padId: string | null; detour: ReceptionistDetour | null }>(NO_DETOUR);
  const currentDetour = useCallback(
    (id: string) => (detourRef.current.padId === id ? detourRef.current.detour : null),
    [],
  );
  const setDetour = useCallback((id: string, next: ReceptionistDetour | null) => {
    detourRef.current = { padId: id, detour: next };
    setHeld(detourRef.current);
  }, []);
  const [now, setNow] = useState(() => Date.now());
  // A greeting for you is on its way: true until he reaches you by the pad. It outlives a change of pad (a new Space
  // first draws the blank tab's pad, then the template's), and he greets you by the new one.
  const greetingYou = useRef(false);
  // You rang a reception bell: true until he reaches the desk, where his bubble opens for you.
  const answeringYou = useRef(false);
  const selfRef = useLatest(self);
  const elementsRef = useLatest(elements);

  // Somebody appeared on his pad: he goes to greet them. Each beam is seen once, by its key.
  const greeted = useRef(new Set<string>());
  useEffect(() => {
    if (!world) return;
    for (const a of arrivals) {
      if (a.padId !== world.padId || greeted.current.has(a.key)) continue;
      greeted.current.add(a.key);
      const at = Date.now();
      if (still) {
        if (a.personId === SELF) noteReceptionistGreetedYou();
        continue;
      }
      const next = greetDetour(world, at, currentDetour(world.padId));
      if (a.personId === SELF) greetingYou.current = true;
      setDetour(world.padId, next);
    }
  }, [arrivals, world, still, setDetour, currentDetour]);

  // Ask Receptionist: he walks over to you (on your screen only).
  const asked = useRef(asks);
  useEffect(() => {
    if (asks === asked.current) return;
    asked.current = asks;
    const you = selfRef.current;
    if (!world || !you || still) return;
    const at = Date.now();
    setDetour(world.padId, talkDetour(world, at, currentDetour(world.padId), you));
  }, [asks, world, still, setDetour, currentDetour, selfRef]);

  // A reception bell rang on this tab, yours or anyone's: he walks over to its desk to help. While his bubble is open
  // for you he finishes with you first, unless the ring was yours.
  useEffect(() => {
    if (!world) return;
    return onBellRung((deskId, from) => {
      const mine = from === SELF_RINGER;
      if (!mine && getReceptionistState().chat.open) return;
      if (still) {
        if (mine) {
          track('UI', 'Opened', 'ReceptionistBell');
          openReceptionist('bell');
        }
        return;
      }
      const desk = elementsRef.current.find((el) => el.id === deskId);
      if (!desk || desk.type !== 'shape') return;
      const next = bellDetour(world, Date.now(), currentDetour(world.padId), desk);
      if (!next) return;
      // His bubble moves with him: anything open closes as he sets off, and opens again at the desk when it was you.
      answeringYou.current = mine;
      if (mine) closeReceptionist();
      setDetour(world.padId, next);
    });
  }, [world, still, setDetour, currentDetour, elementsRef]);

  // Rooms and Meetings walks you to the nearest room; closing the bubble sends him back into his day.
  const topicId = chat.open ? chat.topicId : null;
  useEffect(() => {
    if (!world || still) return;
    const at = Date.now();
    if (!chat.open) {
      const current = currentDetour(world.padId);
      if (current?.until === null) setDetour(world.padId, releaseDetour(current, at));
      return;
    }
    // An open bubble keeps him: a greeting's hold lasts until it closes, as a talk does.
    const open = currentDetour(world.padId);
    if (open && open.until !== null && open.until > at)
      setDetour(world.padId, { ...open, until: null });
    const topic = RECEPTIONIST_TOPICS.find((t) => t.id === topicId);
    if (topic?.target !== 'room') return;
    const current = currentDetour(world.padId);
    const spot = nearestRoomSpot(world, receptionistPose(world, at, current).at);
    if (spot) setDetour(world.padId, leadDetour(world, at, current, spot));
  }, [chat.open, topicId, world, still, setDetour, currentDetour]);

  const pose = useMemo(() => {
    if (!world) return null;
    if (still)
      return {
        at: world.home.at,
        facing: world.home.face,
        walking: false,
        stepFrame: 0,
        holding: null,
        reaction: null,
        activity: 'home',
      } satisfies ReceptionistPose;
    return receptionistPose(world, now, detour);
  }, [world, now, detour, still]);

  // He reached the pad on a greeting that was yours: once per arrival. A greeting dropped with a change of pad starts
  // again by the new pad.
  useEffect(() => {
    if (!greetingYou.current || !world || !pose) return;
    if (detour?.kind !== 'greet') {
      setDetour(world.padId, greetDetour(world, Date.now(), detour));
      return;
    }
    if (pose.walking) return;
    greetingYou.current = false;
    noteReceptionistGreetedYou();
  }, [pose, detour, world, setDetour]);

  // He reached the desk whose bell you rang: his bubble opens there, for you.
  useEffect(() => {
    if (!answeringYou.current || !pose || pose.walking || detour?.kind !== 'bell') return;
    answeringYou.current = false;
    track('UI', 'Opened', 'ReceptionistBell');
    openReceptionist('bell');
  }, [pose, detour]);

  // The clock: every frame while he moves, else one timer to his next change. Never while reduced motion stills him.
  useEffect(() => {
    if (!world || !pose || still) return;
    const wait = receptionistNextChangeMs(pose, now, detour);
    if (wait === 0) {
      const frame = requestAnimationFrame(() => setNow(Date.now()));
      return () => cancelAnimationFrame(frame);
    }
    const timer = setTimeout(() => setNow(Date.now()), wait + 20);
    return () => clearTimeout(timer);
  }, [world, pose, now, detour, still]);

  if (!world || !pose) return null;
  return { world, pose };
}
