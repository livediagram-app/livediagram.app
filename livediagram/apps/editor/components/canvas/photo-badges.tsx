'use client';

// The photo import's marks on a note (docs/specs/021-event-storming/event-storming.md Phase 8): a
// dashed frame on a note the photo brought, and a tick on one it matched. Sized in canvas px against
// the zoom so they read the same on screen at any zoom, so they read it themselves: a zoom re-renders
// them, not the note (docs/specs/008-canvas/canvas-performance.md).

import { ICON_STROKE_PX_SMALL } from '@livediagram/icons';
import { Glyph, Tooltip } from '@livediagram/ui';
import { useCanvasZoom } from '@/components/canvas/CanvasZoomContext';

// A dashed accent frame just outside the paper, in the alignment guides' own language, saying "this
// one came from the photo and has not been accepted yet". Drawn rather than tinted, because a
// workshop note's FILL is its meaning.
export function PhotoDraftRing() {
  const zoom = useCanvasZoom();
  return (
    <span
      aria-hidden
      data-photo-draft=""
      className="pointer-events-none absolute rounded-[3px] border-2 border-dashed border-brand-500 dark:border-brand-300"
      style={{ inset: -6 / zoom, borderWidth: Math.max(1, 2 / zoom) }}
    />
  );
}

// The counterpart on a note the photo matched: it is already here, so nothing is being added for it.
export function PhotoMatchedBadge({ readAs }: { readAs: string | undefined }) {
  const zoom = useCanvasZoom();
  const label = photoMatchedLabel(readAs);
  return (
    <Tooltip label={label}>
      <span
        data-photo-matched=""
        role="img"
        aria-label={label}
        className="pointer-events-auto absolute -right-2 -top-2 flex items-center justify-center rounded-full bg-slate-700 text-white shadow dark:bg-slate-200 dark:text-slate-900"
        style={{ width: 18 / zoom, height: 18 / zoom }}
      >
        {/* Sized in canvas px so it reads 12px on screen at any zoom; Glyph's stroke is on-screen px. */}
        <Glyph size={12 / zoom} units={24} weight={ICON_STROKE_PX_SMALL}>
          <path d="M5 13l4 4L19 7" />
        </Glyph>
      </span>
    </Tooltip>
  );
}

// The badge on a note a wall photo matched: already on the board.
function photoMatchedLabel(readAs: string | undefined): string {
  return readAs ? `Already here, read as ${readAs}` : 'Already here';
}
