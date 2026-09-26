'use client';

// The glyph for each view mode, so the pair reads at a glance rather
// than needing both labels parsed.
//
// Its own module because the mode switch now renders in two places: the
// header row on a wide screen, and inside the filter popover on a phone
// where the row has no space for it (docs/specs/013-workspace/timeline.md §2.3). One copy of the
// icons keeps the two from drifting into different pictures of the same
// thing.

import type { TimelineMode } from './types';

export const MODE_ICONS: Record<TimelineMode, string> = {
  list: 'M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5',
  calendar:
    'M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5',
};

/** The order the switch offers them in, wherever it renders. */
export const TIMELINE_MODES: readonly TimelineMode[] = ['list', 'calendar'];

// What the switch calls each mode. The value stays `list` (it names the
// data shape, and the telemetry token built on it), but the reader sees
// a grid of cards, so that is the word on the button.
export const MODE_LABELS: Record<TimelineMode, string> = {
  list: 'Cards',
  calendar: 'Calendar',
};

export function ModeIcon({ mode }: { mode: TimelineMode }) {
  return (
    <svg
      className="h-3.5 w-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      viewBox="0 0 24 24"
      aria-hidden
    >
      <path strokeLinecap="round" strokeLinejoin="round" d={MODE_ICONS[mode]} />
    </svg>
  );
}
