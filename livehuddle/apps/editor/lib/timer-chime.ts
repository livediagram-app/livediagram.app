// A Timer's chime at zero (docs/specs/009-elements/timer-and-stopwatch.md "The chime"): a gentle two-note chime made
// in the browser with Web Audio (no audio file), about a second long at a low volume. Each screen schedules its own,
// one timeout per running Timer set for its end, so it sounds on time when the canvas is not repainting (a hidden
// tab's timers still fire); a pause, a reset or a new length clears it, and it plays once per run. Who hears it is
// timer-earshot's.

import { useEffect } from 'react';
import { pieceTimerRanOut, pieceTimerShown, type PieceTimer } from '@livehuddle/document';
import { hearsTimer } from '@/lib/office/timer-earshot';
import { playTones } from '@/lib/sounds/audio';

/** The chime's two notes (E6 then C6), each with a soft attack and a long fade, and its peak gain. */
const NOTES: readonly { hz: number; at: number }[] = [
  { hz: 1318.5, at: 0 },
  { hz: 1046.5, at: 0.28 },
];
const NOTE_S = 0.9;
const PEAK_GAIN = 0.12;

/** Play the chime now. Silent where the browser refuses sound (nothing pressed on the page yet) or has no Web Audio. */
export function playChime(): void {
  playTones(NOTES, NOTE_S, PEAK_GAIN);
}

// The reception bell's ding (lib/office/reception-bell.ts) plays in the same voice, through the editor's one context.
export { playTones };

/**
 * The ms until a running Timer reaches zero from `now`, or null when no chime is due: not a Timer, not running, or
 * already out (a person who opens the tab after the end sees 0:00 and hears nothing).
 */
export function chimeDueIn(kind: string, state: PieceTimer, now: number): number | null {
  if (kind !== 'timer' || !state.running) return null;
  if (pieceTimerRanOut('timer', state, now)) return null;
  return pieceTimerShown('timer', state, now);
}

/** Arm the chime for one Timer face: one timeout for its end, re-armed only when its clock changes. */
export function useTimerChime(id: string, kind: string, state: PieceTimer): void {
  const { running, startedAt, accumulatedMs, durationMs } = state;
  useEffect(() => {
    const due = chimeDueIn(kind, { running, startedAt, accumulatedMs, durationMs }, Date.now());
    if (due === null) return;
    const handle = setTimeout(() => {
      if (hearsTimer(id)) playChime();
    }, due);
    return () => clearTimeout(handle);
  }, [id, kind, running, startedAt, accumulatedMs, durationMs]);
}
