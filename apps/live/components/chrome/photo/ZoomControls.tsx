'use client';

import { HoverCard } from '@livediagram/ui';
import { PHOTO_ZOOM_MAX } from '@/lib/photo-view';

// The zoom, where it can be seen and clicked (docs/specs/021-event-storming/event-storming.md Phase 9). The wheel and
// the keys are faster, but a gesture nobody knows about is not a feature: the
// buttons are the discoverable half, and the hint under them teaches the rest.
export function ZoomControls({
  zoom,
  onZoomIn,
  onZoomOut,
  onFit,
}: {
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFit: () => void;
}) {
  const button =
    'flex h-7 min-w-7 items-center justify-center rounded-full px-2 text-sm text-white hover:bg-white/15 disabled:opacity-40 disabled:hover:bg-transparent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-white';
  return (
    <div
      data-testid="photo-zoom"
      className="pointer-events-auto flex items-center gap-0.5 rounded-full bg-slate-900/85 p-0.5 shadow-lg backdrop-blur"
      // The controls sit on the photo; a click on them is not a drag that
      // draws a box.
      onPointerDown={(e) => e.stopPropagation()}
    >
      <HoverCard title="Zoom out" description="Shortcut: −">
        <button
          type="button"
          aria-label="Zoom out"
          disabled={zoom <= 1}
          onClick={onZoomOut}
          className={button}
        >
          −
        </button>
      </HoverCard>
      <span
        aria-live="polite"
        data-testid="photo-zoom-level"
        className="w-12 text-center text-xs tabular-nums text-slate-200"
      >
        {Math.round(zoom * 100)}%
      </span>
      <HoverCard
        title="Zoom in"
        description="Shortcut: +. Or scroll, or pinch; drag with the middle button to move around."
      >
        <button
          type="button"
          aria-label="Zoom in"
          disabled={zoom >= PHOTO_ZOOM_MAX}
          onClick={onZoomIn}
          className={button}
        >
          +
        </button>
      </HoverCard>
      <HoverCard title="Show the whole photo" description="Shortcut: 0">
        <button
          type="button"
          aria-label="Show the whole photo"
          disabled={zoom === 1}
          onClick={onFit}
          className={`${button} text-xs`}
        >
          Fit
        </button>
      </HoverCard>
    </div>
  );
}
