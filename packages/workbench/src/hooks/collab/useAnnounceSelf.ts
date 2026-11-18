'use client';

import { useEffect, useRef } from 'react';

// Who this session is to the room, said again over the open socket whenever it changes (liveworkspace/docs/specs/
// 003-accounts/accounts.md "Profiles", "A change reaches the room at once"; Work Tracker 1221): a name or colour saved
// in Settings › Profile, a colour yielded to a peer already wearing it, or Show My Google Picture switched. The room
// sends the roster again, so everyone already in it sees the change live rather than at their next load. Each
// editor's useRoomConnection passes what its hello carries and how to send it (its room's `updateSelf`, an `identity`
// frame).

/** What the room's roster shows of this session and can change while the socket is open. */
export type AnnouncedSelf = { name: string; color: string; picture?: string | null };

/** The value compared between renders: a change to any field is one announcement. */
export function announcedSelfKey(self: AnnouncedSelf): string {
  return JSON.stringify([self.name, self.color, self.picture ?? null]);
}

/**
 * Calls `announce` after a render whose `self` differs from the last one announced (or the first one seen), never on
 * the first render: the socket's own hello says who it is when it opens. Cheap on every render: one short string.
 */
export function useAnnounceSelf(self: AnnouncedSelf, announce: () => void): void {
  const key = announcedSelfKey(self);
  const announced = useRef(key);
  // The latest callback, so a change sends this render's self; updated before the effect below reads it.
  const latest = useRef(announce);
  useEffect(() => {
    latest.current = announce;
  });
  useEffect(() => {
    if (announced.current === key) return;
    announced.current = key;
    latest.current();
  }, [key]);
}
