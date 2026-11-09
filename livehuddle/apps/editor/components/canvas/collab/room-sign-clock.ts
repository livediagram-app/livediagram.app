'use client';

// The Room Sign's two clocks, shared by its plaque (RoomSignView) and its reader (RoomSignReader): the minute tick
// that moves "12 min" on while the room is in use, and the ten seconds a knock reads Knocked
// (docs/specs/009-elements/screen-and-room-sign.md "Room Sign").
import { useEffect, useState } from 'react';
import { KNOCK_THROTTLE_MS } from '@livehuddle/api-schema';
import { useKnockedAt } from '@/lib/office/meeting-live';

// Now, ticking once a minute while `on`: the sign's "12 min" moves on without a per-frame clock.
export function useMinuteClock(on: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!on) return;
    // The first tick comes at once (from a timer, not in the effect), so a room just in use reads from now.
    const first = setTimeout(() => setNow(Date.now()), 0);
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [on]);
  return now;
}

// Knocked for ten seconds after a knock, then the button comes back.
export function useKnockedRecently(): boolean {
  const at = useKnockedAt();
  // The knock time whose ten seconds have run out; a newer knock reads Knocked until its own timer passes. A sign or
  // reader opened after the ten seconds starts with them run out, so it never shows Knocked for its first frame.
  const [expired, setExpired] = useState(() =>
    at > 0 && Date.now() - at >= KNOCK_THROTTLE_MS ? at : 0,
  );
  useEffect(() => {
    if (!at) return;
    const timer = setTimeout(
      () => setExpired(at),
      Math.max(0, at + KNOCK_THROTTLE_MS - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [at]);
  return at > 0 && expired !== at;
}
