'use client';

import { PHOTO_ZOOM_MAX } from '@/lib/photo-view';

// The zoom, where it can be seen and clicked (spec/139 Phase 9). The wheel and
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
      <button
        type="button"
        aria-label="Zoom out"
        title="Zoom out (−)"
        disabled={zoom <= 1}
        onClick={onZoomOut}
        className={button}
      >
        −
      </button>
      <span
        aria-live="polite"
        data-testid="photo-zoom-level"
        className="w-12 text-center text-xs tabular-nums text-slate-200"
      >
        {Math.round(zoom * 100)}%
      </span>
      <button
        type="button"
        aria-label="Zoom in"
        title="Zoom in (+). Or Ctrl + scroll; drag with Space held to move around."
        disabled={zoom >= PHOTO_ZOOM_MAX}
        onClick={onZoomIn}
        className={button}
      >
        +
      </button>
      <button
        type="button"
        aria-label="Show the whole photo"
        title="Whole photo (0)"
        disabled={zoom === 1}
        onClick={onFit}
        className={`${button} text-xs`}
      >
        Fit
      </button>
    </div>
  );
}
