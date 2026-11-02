'use client';

import { useEffect, useEffectEvent, useMemo, useRef, useState } from 'react';
import type { AvatarSceneElement } from '../scene';
import {
  AVATAR_PAD_ARRIVAL_MS,
  avatarPads,
  nextArrivals,
  type ArrivalCandidate,
  type PadArrival,
} from '../pad';
import type { AvatarPoint } from '../walk';

// Your own character, keyed apart from every peer's participant id.
const SELF = 'self';

const NO_ARRIVALS: readonly PadArrival[] = [];

// The arrival beams on this screen (docs/specs/009-elements/avatar-pad.md "The arrival"): yours when you enter
// Avatar mode on a pad, and a peer's when their character first appears to you standing on one. Derived from the
// positions everyone already publishes, so there is no arrival message, nothing stored and nothing replayed.
//
// Cheap on the hot path: the arrival rule runs only when the SET of characters on screen changes (somebody appears
// or goes), never per walked frame or per presence packet, and a tab with no pad keeps no state at all.
export function useAvatarPadArrivals({
  self,
  selfColor,
  peers,
  elements,
}: {
  self: AvatarPoint | null;
  selfColor: string;
  peers: readonly { id: string; color: string; avatar: { x: number; y: number } }[];
  // What is drawn: a hidden layer's pads are not there.
  elements: readonly AvatarSceneElement[];
}): readonly PadArrival[] {
  const pads = useMemo(() => avatarPads(elements), [elements]);
  const [arrivals, setArrivals] = useState<readonly PadArrival[]>(NO_ARRIVALS);
  const seenRef = useRef<ReadonlySet<string>>(new Set());
  // Who is on screen, as one string, so the rule below re-runs on an arrival or a departure and on nothing else.
  const presentKey = (self ? SELF : '') + '|' + peers.map((p) => p.id).join(',');
  const step = useEffectEvent(() => {
    const present: ArrivalCandidate[] = peers.map((p) => ({
      id: p.id,
      x: p.avatar.x,
      y: p.avatar.y,
      color: p.color,
    }));
    if (self) present.push({ id: SELF, x: self.x, y: self.y, color: selfColor });
    // Who was on screen BEFORE this change, read now: the updater runs later, after `seenRef` moves on.
    const seen = seenRef.current;
    const now = Date.now();
    seenRef.current = new Set(present.map((p) => p.id));
    setArrivals((current) => nextArrivals({ arrivals: current, seen, present, pads, now }));
  });
  useEffect(() => {
    step();
  }, [presentKey]);
  // Drop each beam when it is over; one timer for the soonest to end, re-armed as the list changes.
  useEffect(() => {
    if (arrivals.length === 0) return;
    const soonest = Math.min(...arrivals.map((a) => a.startedAt)) + AVATAR_PAD_ARRIVAL_MS;
    const timer = setTimeout(
      () =>
        setArrivals((current) => {
          const now = Date.now();
          const left = current.filter((a) => now - a.startedAt < AVATAR_PAD_ARRIVAL_MS);
          return left.length === current.length ? current : left;
        }),
      Math.max(0, soonest - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [arrivals]);
  return arrivals;
}
