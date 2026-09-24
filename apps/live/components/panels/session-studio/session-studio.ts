// Pure logic behind the Session Studio (spec/39, spec/88): which tool the
// panel opens on, the Timer dial's angle <-> minutes mapping, and the dot
// vote's phase. Kept out of the components so it can be tested without a
// DOM, and so the dial's snapping rules live in one place.

import { TIMER_MINUTES_RANGE, type TabTimer, type TabVote } from '@livediagram/diagram';

export type StudioTool = 'timer' | 'vote' | 'poll';

export const STUDIO_TOOLS: readonly StudioTool[] = ['timer', 'vote', 'poll'];

// What each tool is doing right now, for the switcher's status dots. `live`
// is something the room is looking at this second; `idle` is set up but
// waiting (a paused timer, a closed vote whose results aren't cleared).
export type StudioToolStatus = 'live' | 'idle' | null;

export function studioToolStatus(
  tool: StudioTool,
  state: { timer: TabTimer | null; vote: TabVote | null; pollRunning: boolean },
): StudioToolStatus {
  switch (tool) {
    case 'timer':
      if (!state.timer) return null;
      return state.timer.running ? 'live' : 'idle';
    case 'vote':
      if (!state.vote) return null;
      return state.vote.active ? 'live' : 'idle';
    case 'poll':
      return state.pollRunning ? 'live' : null;
  }
}

// The tool the panel opens on. Whatever is LIVE wins, because the reason
// most people reopen this menu mid-session is to drive the thing that is
// running (pause the timer, end the vote); failing that, anything set up
// but idle; failing that, the timer, the most common first reach.
export function initialStudioTool(state: {
  timer: TabTimer | null;
  vote: TabVote | null;
  pollRunning: boolean;
}): StudioTool {
  for (const want of ['live', 'idle'] as const) {
    // Poll before vote before timer: the rarer, more deliberate tool is the
    // likelier reason to be here when two things run at once.
    for (const tool of ['poll', 'vote', 'timer'] as const) {
      if (studioToolStatus(tool, state) === want) return tool;
    }
  }
  return 'timer';
}

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

export type VotePhase = 'setup' | 'casting' | 'closed' | 'results';

export function votePhase(vote: TabVote | null): VotePhase {
  if (!vote) return 'setup';
  if (vote.active) return 'casting';
  return vote.revealed ? 'results' : 'closed';
}

// Dots cast and the number of distinct people who cast them.
export function voteTurnout(vote: TabVote): { dots: number; voters: number } {
  const voters = new Set<string>();
  let dots = 0;
  for (const ids of Object.values(vote.votes)) {
    dots += ids.length;
    for (const id of ids) voters.add(id);
  }
  return { dots, voters: voters.size };
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
