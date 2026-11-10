// Tile art that is livediagram's own (docs/specs/004-interface-design/iconography.md, "Art"): the event-storming
// notes in their own stationery colour. The code block's card and the embed providers' marks are shared
// (@liveworkspace/workbench/components/palette/embed-tile-art).

import type { EventStormingNoteSize } from '@livediagram/document';

const NOTE_RECT = {
  wide: { x: 1.5, y: 5, width: 15, height: 9 },
  small: { x: 5, y: 5, width: 8, height: 8 },
  square: { x: 3, y: 3, width: 12, height: 12 },
} as const;

// An event-storming note's stationery silhouette (docs/specs/021-event-storming/event-storming.md): a
// standard square, a WIDE rect for the prose kinds, a small square for the actor, in the note's
// colour.
export function NoteTileArt({ size, fill }: { size: EventStormingNoteSize; fill: string }) {
  const r = NOTE_RECT[size];
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
      <rect {...r} fill={fill} stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}
