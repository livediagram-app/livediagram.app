'use client';

// A Session tab's timebox on this screen (docs/specs/026-plan/session-tabs.md "The progress bar"): the time left on the
// room's card, ticked once a second from the card's start only while a timebox is on, and a chime played once when a
// card this screen was watching runs out. Nothing moves on by itself.
import { useEffect, useRef, useState } from 'react';
import { timeboxLeftMs, type SessionTabState } from '@liveplanner/project';
import { playSessionChime } from './session-chime';

export const TIMEBOX_TICK_MS = 1000;

export type SessionTimebox = { leftMs: number; totalMs: number; up: boolean } | null;

export function useSessionTimebox(
  session: SessionTabState,
  chime: () => void = playSessionChime,
): SessionTimebox {
  const totalMs = session.setup.timeboxMs;
  const on = !!totalMs && session.cardStartedAt !== undefined;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!on) return;
    const t = window.setInterval(() => setNow(Date.now()), TIMEBOX_TICK_MS);
    return () => window.clearInterval(t);
  }, [on, session.cardStartedAt]);
  // Never more than the whole box: `now` may be up to a tick older than a card that just started.
  const left = on ? timeboxLeftMs(session, now) : null;
  const leftMs = left === null || !totalMs ? null : Math.min(totalMs, left);
  // The card this screen saw with time still on it, so a card already over when it opened never chimes.
  const watched = useRef<number | null>(null);
  useEffect(() => {
    if (leftMs === null) return;
    const card = session.cardStartedAt ?? null;
    if (leftMs > 0) watched.current = card;
    else if (watched.current === card) {
      watched.current = null;
      chime();
    }
  }, [leftMs, session.cardStartedAt, chime]);
  if (leftMs === null || !totalMs) return null;
  return { leftMs, totalMs, up: leftMs === 0 };
}
