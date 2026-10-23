// The Timeline's glyphs: one per kind of event (livediagram's timeline icons, on their 24-unit grid), so a day of
// mixed events reads by shape as well as colour, and the controls' marks.

import type { ReactNode } from 'react';
import type { TimelineEventType } from '@liveworkspace/index-client';
import { Glyph } from '../ui/icons';
import type { TimelineMode } from './model';

const PLUS = 'M12 4.5v15m7.5-7.5h-15';
const PENCIL =
  'M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z';
const TAG =
  'M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3zM6 6h.008v.008H6V6z';
const FOLDER_ARROW =
  'M9 13.5l3 3m0 0l3-3m-3 3v-6m1.06-4.19l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z';
const TRASH =
  'M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0';
const TAKE_BACK = 'M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3';
const LINK =
  'M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244';
const LOCK =
  'M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z';
const STAR =
  'M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z';
const SPARKLES =
  'M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z';

// Exhaustive over the event types, so a new type fails the build until it has a mark; a test keeps them distinct.
export const EVENT_GLYPH_PATHS: Record<TimelineEventType, string> = {
  created: PLUS,
  edited: PENCIL,
  renamed: TAG,
  moved: FOLDER_ARROW,
  trashed: TRASH,
  restored: TAKE_BACK,
  shared: LINK,
  unshared: LOCK,
  favourited: STAR,
};

function Path({ d, size = 16 }: { d: string; size?: number }) {
  return (
    <Glyph size={size} units={24}>
      <path d={d} />
    </Glyph>
  );
}

/** An event's glyph; an item an AI tool made wears sparkles rather than the plus. */
export function eventIcon(type: string, source?: string | null): ReactNode {
  if (type === 'created' && source === 'ai') return <Path d={SPARKLES} />;
  const d = (EVENT_GLYPH_PATHS as Record<string, string | undefined>)[type];
  return <Path d={d ?? PENCIL} />;
}

const MODE_PATHS: Record<TimelineMode, string> = {
  list: 'M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5',
  calendar:
    'M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5',
};

/** The order the mode switch offers them in, wherever it renders. */
export const TIMELINE_MODES: readonly TimelineMode[] = ['list', 'calendar'];

// The value stays `list` (it names the data's shape); the reader sees a grid of cards.
export const MODE_LABELS: Record<TimelineMode, string> = { list: 'Cards', calendar: 'Calendar' };

export function ModeIcon({ mode }: { mode: TimelineMode }) {
  return <Path d={MODE_PATHS[mode]} size={14} />;
}

export function FilterIcon() {
  return <Path d="M3 4.5h18M6.75 12h10.5M11.25 19.5h1.5" size={14} />;
}

export function Chevron({ direction, size = 14 }: { direction: 1 | -1; size?: number }) {
  return <Path d={direction === 1 ? 'M9 5l7 7-7 7' : 'M15 19l-7-7 7-7'} size={size} />;
}
