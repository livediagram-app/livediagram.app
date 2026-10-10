// Pure logic behind the session panes (docs/specs/012-collaboration/session-tools.md, docs/specs/012-collaboration/live-poll.md): the Timer
// dial's angle <-> minutes mapping, and the rules a running dot vote is under. Kept out of the components so it can be tested without a
// DOM, and so the dial's snapping rules live in one place.

import {
  TIMER_MINUTES_RANGE,
  voteHidesCursors,
  voteHidesTallies,
  type TabVote,
} from '@livediagram/document';

// --- Timer dial --------------------------------------------------------------
//
// One lap of the dial is an hour, like the classic workshop "time timer": the
// coloured wedge IS the time, so a glance tells you how much is left without
// reading digits. Anything past an hour (the range allows two) is set with the
// nudge buttons and drawn as a full wedge plus an outer lap ring.

export const DIAL_LAP_MINUTES = 60;
export const TIMER_MIN_MINUTES = TIMER_MINUTES_RANGE.min;
export const TIMER_MAX_MINUTES = TIMER_MINUTES_RANGE.max;

export function clampTimerMinutes(minutes: number): number {
  if (!Number.isFinite(minutes)) return TIMER_MIN_MINUTES;
  return Math.min(TIMER_MAX_MINUTES, Math.max(TIMER_MIN_MINUTES, Math.round(minutes)));
}

// Clockwise angle from twelve o'clock, in radians [0, 2π), of a point
// relative to the dial's centre. Screen y grows downward, which is what makes
// the atan2 below read clockwise.
export function dialAngle(cx: number, cy: number, x: number, y: number): number {
  const a = Math.atan2(x - cx, cy - y);
  return a < 0 ? a + Math.PI * 2 : a;
}

// Whole minutes for a dial angle, never zero: a pointer resting exactly on
// twelve means "a full lap", not "no time", since a zero-length countdown is
// the one value nobody drags to on purpose.
export function minutesForDialAngle(angle: number): number {
  const raw = Math.round((angle / (Math.PI * 2)) * DIAL_LAP_MINUTES);
  return raw <= 0 ? DIAL_LAP_MINUTES : Math.min(DIAL_LAP_MINUTES, raw);
}

// The fraction of one lap a countdown of `ms` fills, for the wedge. Capped at
// a full lap; the lap ring carries anything beyond.
export function dialFraction(ms: number): number {
  const lapMs = DIAL_LAP_MINUTES * 60_000;
  if (ms <= 0) return 0;
  return Math.min(1, ms / lapMs);
}

// SVG path for a wedge (a filled pie slice) from twelve o'clock clockwise.
// A full lap is drawn as a circle: an arc whose start and end coincide
// renders as nothing at all.
export function wedgePath(cx: number, cy: number, r: number, fraction: number): string {
  if (fraction <= 0) return '';
  if (fraction >= 0.9999) {
    return `M ${cx} ${cy - r} A ${r} ${r} 0 1 1 ${cx - 0.001} ${cy - r} Z`;
  }
  const a = fraction * Math.PI * 2;
  const x = cx + r * Math.sin(a);
  const y = cy - r * Math.cos(a);
  const large = fraction > 0.5 ? 1 : 0;
  return `M ${cx} ${cy} L ${cx} ${cy - r} A ${r} ${r} 0 ${large} 1 ${x.toFixed(3)} ${y.toFixed(3)} Z`;
}

// "5 min", "1 hr", "1 hr 30 min": the Start button's label, which names what
// the facilitator is about to give the room rather than echoing the clock.
export function formatMinutesLabel(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} hr` : `${h} hr ${m} min`;
}

// --- Dot vote -----------------------------------------------------------------

// The rules a running vote is under, as short chips for the Vote panel. Phase-aware: the privacy
// rules read what is in force NOW (cursors come back the moment voting closes), not what was
// ticked at start.
export function voteRules(
  vote: TabVote,
  layers: readonly { id: string; name: string }[],
): string[] {
  return [
    `${vote.votesPerPerson} ${vote.votesPerPerson === 1 ? 'dot' : 'dots'} each`,
    vote.onePerElement ? 'One per item' : null,
    vote.voteLayerId
      ? `${layers.find((l) => l.id === vote.voteLayerId)?.name ?? 'One layer'} only`
      : null,
    voteHidesCursors(vote) ? 'Cursors hidden' : null,
    voteHidesTallies(vote) ? 'Counts hidden' : null,
  ].filter((r): r is string => r !== null);
}

// Dragging the dial handle past twelve o'clock would otherwise wrap: 59 -> 1
// in one pixel, which reads as the timer collapsing under your finger. Stick
// at the end you were heading for instead, the way a physical kitchen timer
// stops at its pin, until the pointer comes back round.
export function dialDragMinutes(prev: number, next: number): number {
  const quarter = DIAL_LAP_MINUTES / 4;
  if (prev >= DIAL_LAP_MINUTES - quarter && next <= quarter) return DIAL_LAP_MINUTES;
  if (prev <= quarter && next >= DIAL_LAP_MINUTES - quarter) return TIMER_MIN_MINUTES;
  return next;
}
