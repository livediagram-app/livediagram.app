import type { CSSProperties } from 'react';

// The "preview on its way" state of a DocumentThumbnail (docs/specs/006-document/document-snapshots.md):
// the same three-node sketch as the empty-diagram placeholder, drawing
// itself. The first node traces, two connectors grow out of it, their
// arrowheads land, the other two nodes trace, then a dot runs down each
// connector and the sketch fades out to start over (`thumbnail-loader.css`).
// Once the first node has traced, a small spinner turns inside it.
//
// Same geometry and colour as BlankCanvasIllustration, so a card never
// changes size or tone when the picture arrives and a half-drawn sketch
// can't be mistaken for a real snapshot. Solid strokes rather than the
// placeholder's dashes: dashed means "nothing drawn yet", which is what a
// thumbnail says once it KNOWS the diagram is empty.
//
// Each loader starts at a point in the cycle derived from its diagram id,
// so a grid of loading cards ripples instead of pulsing in lockstep.
// Reduced motion shows the finished sketch, still.

const CYCLE_MS = 5400;

export function ThumbnailLoader({ seed }: { seed: string }) {
  const style = { '--lvd-thumb-phase': `-${phaseMs(seed)}ms` } as CSSProperties;
  return (
    <span className="flex h-full flex-col items-center justify-center p-1">
      <svg
        viewBox="0 0 64 40"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
        data-testid="thumbnail-loader"
        style={style}
        className="lvd-thumb-loader h-full max-h-20 w-auto text-slate-300 dark:text-slate-600"
      >
        <g className="lvd-thumb-cycle">
          <rect className="lvd-thumb-a" x="4" y="14" width="18" height="12" rx="3" pathLength="1" />
          {/* A spinner inside the first node, appearing once that node has
              traced: a faint track and an arc, turning on its own quick
              loop independent of the drawing cycle. */}
          <g className="lvd-thumb-spinner">
            <circle cx="13" cy="20" r="3" strokeWidth="1.2" opacity="0.35" />
            <circle
              className="lvd-thumb-spin"
              cx="13"
              cy="20"
              r="3"
              strokeWidth="1.2"
              pathLength="1"
              strokeDasharray="0.3 0.7"
            />
          </g>
          <path className="lvd-thumb-link" d="M22 20c8 0 10-11 18-11" pathLength="1" />
          <path className="lvd-thumb-link" d="M22 20c8 0 10 11 18 11" pathLength="1" />
          <path className="lvd-thumb-head" d="M37 6.5l3 2.5-3 2.5" />
          <path className="lvd-thumb-head" d="M37 28.5l3 2.5-3 2.5" />
          <rect className="lvd-thumb-b" x="42" y="3" width="18" height="12" rx="3" pathLength="1" />
          <rect
            className="lvd-thumb-c"
            x="42"
            y="25"
            width="18"
            height="12"
            rx="3"
            pathLength="1"
          />
          <circle className="lvd-thumb-dot lvd-thumb-dot-top" r="1.4" fill="currentColor" />
          <circle className="lvd-thumb-dot lvd-thumb-dot-bottom" r="1.4" fill="currentColor" />
        </g>
      </svg>
    </span>
  );
}

// A stable offset into the cycle for this diagram: FNV-1a over the id.
// Stable across renders and mounts, so a remount doesn't jump the phase.
export function phaseMs(seed: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0) % CYCLE_MS;
}
