// Tile pictures that are art, not icons (docs/specs/004-interface-design/iconography.md, "Art"):
// the code block's fixed dark card, the embed providers' marks, and the event-storming notes in
// their own stationery colour. They keep their own paint.

import type { EventStormingNoteSize } from '@livediagram/document';

// The code block's dark editor card with angle brackets; it stays untinted like the element.
export function CodeBlockTileArt() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
      <rect x="1.5" y="2.5" width="15" height="13" rx="2" fill="rgb(15 23 42)" />
      <path
        d="M7 7 L5 9 L7 11 M11 7 L13 9 L11 11"
        fill="none"
        stroke="rgb(148 163 184)"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function YouTubeTileArt() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      dangerouslySetInnerHTML={{
        __html: `<rect x="2" y="5" width="20" height="14" rx="4" fill="currentColor" /><path d="M10.5 8.75 16 12l-5.5 3.25z" fill="#ffffff" />`,
      }}
    />
  );
}

export function VimeoTileArt() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      dangerouslySetInnerHTML={{
        __html: `<rect x="2" y="4" width="20" height="16" rx="3" fill="none" stroke="currentColor" stroke-width="1.7" /><path d="M7 9c1.6-1.5 3 .4 3.4 2 .5 2 1 3.6 2 1.4C13.6 9.9 12.4 8 15 8c2 0 2.4 2.2 1.3 4.4C15 15.4 12.6 17 11 16c-1.7-1-2-4.2-2.6-5.4-.4-.8-.9-.4-1.4 0z" fill="currentColor" stroke="none" />`,
      }}
    />
  );
}

export function LoomTileArt() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      dangerouslySetInnerHTML={{
        __html: `<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.7" /><circle cx="12" cy="12" r="3.2" fill="currentColor" /><path d="M12 3v5M12 16v5M3 12h5M16 12h5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />`,
      }}
    />
  );
}

export function FigmaTileArt() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      dangerouslySetInnerHTML={{
        __html: `<rect x="7" y="2.5" width="5" height="6" rx="3" fill="none" stroke="currentColor" stroke-width="1.6" /><rect x="12" y="2.5" width="5" height="6" rx="3" fill="none" stroke="currentColor" stroke-width="1.6" /><rect x="7" y="8.5" width="5" height="6" rx="3" fill="none" stroke="currentColor" stroke-width="1.6" /><circle cx="14.5" cy="11.5" r="3" fill="none" stroke="currentColor" stroke-width="1.6" /><rect x="7" y="14.5" width="5" height="6" rx="3" fill="none" stroke="currentColor" stroke-width="1.6" />`,
      }}
    />
  );
}

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
