// The nudge's chime (docs/specs/012-collaboration/nudge.md "Being nudged"): three bright rising notes, louder than the
// join chime, so a nudge is noticed from another tab. Through the editor's one AudioContext (lib/sounds/audio.ts).
import { playTones, type Note } from '@/lib/sounds/audio';

/** E5, A5, E6. */
const NUDGE_NOTES: readonly Note[] = [
  { hz: 659.25, at: 0 },
  { hz: 880, at: 0.12 },
  { hz: 1318.5, at: 0.24 },
];
const NUDGE_S = 0.7;
const NUDGE_GAIN = 0.16;

export function playNudgeChime(): void {
  playTones(NUDGE_NOTES, NUDGE_S, NUDGE_GAIN);
}
