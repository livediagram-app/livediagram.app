// A Timer's chime at zero (docs/specs/009-elements/timer-and-stopwatch.md "The chime"): a gentle two-note chime made
// in the browser with Web Audio (no audio file), about a second long at a low volume. Each screen schedules its own,
// one timeout per running Timer set for its end, so it sounds on time when the canvas is not repainting (a hidden
// tab's timers still fire); a pause, a reset or a new length clears it, and it plays once per run. Who hears it is
// timer-earshot's.

import { useEffect } from 'react';
import { pieceTimerRanOut, pieceTimerShown, type PieceTimer } from '@livehuddle/document';
import { hearsTimer } from '@/lib/office/timer-earshot';

/** The chime's two notes (E6 then C6), each with a soft attack and a long fade, and its peak gain. */
const NOTES: readonly { hz: number; at: number }[] = [
  { hz: 1318.5, at: 0 },
  { hz: 1046.5, at: 0.28 },
];
const NOTE_S = 0.9;
const PEAK_GAIN = 0.12;

let context: AudioContext | null = null;

function audio(): AudioContext | null {
  if (context) return context;
  const Ctor =
    typeof window === 'undefined'
      ? undefined
      : (window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext);
  if (!Ctor) return null;
  try {
    context = new Ctor();
  } catch {
    return null;
  }
  return context;
}

/** Play the chime now. Silent where the browser refuses sound (nothing pressed on the page yet) or has no Web Audio. */
export function playChime(): void {
  const ctx = audio();
  if (!ctx) return;
  try {
    if (ctx.state === 'suspended') void ctx.resume().catch(() => {});
    const t0 = ctx.currentTime + 0.02;
    for (const note of NOTES) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = note.hz;
      const start = t0 + note.at;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(PEAK_GAIN, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + NOTE_S);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + NOTE_S + 0.05);
    }
  } catch {
    // A browser that throws on any of it stays silent; the flash still shows.
  }
}

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
