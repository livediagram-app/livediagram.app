'use client';

// Who hears a Timer's chime (docs/specs/009-elements/timer-and-stopwatch.md "The chime"): a person standing in the
// Timer's room. A Timer belongs to a room as a Screen does (`meetingPieceRoom`). While you walk you hear it when your
// character stands in that room, or when it belongs to no room; when you are not walking you have no place in the
// Space, so you hear every Timer on the tab. Worked out beside the meeting pieces (useCanvasCall): each Timer's room
// only when the board changes, your own room only when it changes, never on a step. The chime reads it at the moment
// it fires (`hearsTimer`); nothing re-renders.

import { useEffect, useMemo } from 'react';
import { meetingPieceRoom, zoneAt, type CallZone, type Element } from '@livehuddle/document';

type Earshot = {
  inMode: boolean;
  selfZone: string | null;
  rooms: ReadonlyMap<string, string | null>;
};

// Nobody has written it (a build with no calls, so no canvas call hook): everyone hears every Timer.
let earshot: Earshot | null = null;

/** Write who hears what (the canvas's call hook, and tests). */
export function setTimerEarshot(next: Earshot | null): void {
  earshot = next;
}

/** Whether this viewer hears the Timer `id`'s chime now. */
export function hearsTimer(id: string): boolean {
  if (!earshot || !earshot.inMode) return true;
  const room = earshot.rooms.get(id) ?? null;
  return room === null || room === earshot.selfZone;
}

/** Each Timer's room on this board, by id (pure, for the tests). */
export function timerRooms(
  elements: readonly Element[],
  zones: readonly CallZone[],
): Map<string, string | null> {
  const rooms = new Map<string, string | null>();
  for (const el of elements) {
    if (el.type !== 'shape' || el.shape !== 'timer') continue;
    rooms.set(el.id, meetingPieceRoom(el, zones));
  }
  return rooms;
}

export function useTimerEarshot(deps: {
  elements: readonly Element[];
  zones: readonly CallZone[];
  inMode: boolean;
  self: { x: number; y: number } | null;
}): void {
  const { elements, zones, inMode, self } = deps;
  const rooms = useMemo(() => timerRooms(elements, zones), [elements, zones]);
  // A string: the effect below runs when you cross into another room, not on every step.
  const selfZone = inMode && self ? zoneAt(self, zones) : null;
  useEffect(() => {
    setTimerEarshot({ inMode, selfZone, rooms });
  }, [inMode, selfZone, rooms]);
  useEffect(() => () => setTimerEarshot(null), []);
}
