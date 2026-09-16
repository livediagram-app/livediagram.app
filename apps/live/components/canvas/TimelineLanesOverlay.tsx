'use client';

import type { RefObject } from 'react';
import {
  deriveTextColorForBg,
  ES_LANE_HEIGHT,
  laneTop,
  type EsTimeline,
} from '@livediagram/diagram';
import { getTheme, type ThemeId } from '@/lib/themes';
import { useLanePreview } from '@/lib/lane-preview';

// The lane a dragged note is landing on (spec/139 Phase 6), lit while the drag
// is in hand and gone on release.
//
// The lanes are INVISIBLE until a note is on the move: permanent rules ruled
// across the board would be chrome on a surface whose whole premise is
// distraction-free capture. During a drag exactly three are drawn — the one
// the note is joining, and its two neighbours at half the alpha so the rhythm
// reads — plus a tick at the column the left edge is landing on.
//
// Pure SVG, converting canvas coords to client via the wrapper rect + zoom,
// the same inversion CanvasGuideOverlay uses. Fixed-position and
// pointer-events-none, so it can never affect layout (zero CLS) or swallow a
// pointer event from the drag it is describing.

// How far past the viewport the bands are drawn, so a band never appears to
// stop at the window edge.
const BLEED_PX = 64;

export function TimelineLanesOverlay({
  timeline,
  tabThemeId,
  viewportZoom,
  wrapperRef,
}: {
  // The active tab's lane stack, or null when lanes are off / this is not an
  // event-storming board. Null draws nothing at all.
  timeline: EsTimeline | null;
  tabThemeId: ThemeId;
  viewportZoom: number;
  wrapperRef: RefObject<HTMLDivElement | null>;
}) {
  const preview = useLanePreview();
  if (!timeline || !preview) return null;
  const rect = wrapperRef.current?.getBoundingClientRect();
  if (!rect) return null;

  const theme = getTheme(tabThemeId);
  // The guides' own visual language rather than a second vocabulary: the
  // theme's accent when it has one, else ink derived from the backdrop — which
  // is what keeps the band readable on a dark wall, where a lighter band
  // washes out (the dot-grid lesson).
  const colour = theme.elementStroke ?? deriveTextColorForBg(theme.backgroundColor);

  const toClientY = (canvasY: number) => rect.top + canvasY * viewportZoom;
  const left = -BLEED_PX;
  const right = window.innerWidth + BLEED_PX;

  const lit = preview.laneIndex;
  // The lane and its two neighbours, so the rhythm is visible rather than just
  // the one row. Fainter either side: the lit lane is the promise, the
  // neighbours are context.
  const bands =
    lit === null
      ? []
      : [
          { index: lit - 1, opacity: 0.05 },
          { index: lit, opacity: 0.11 },
          { index: lit + 1, opacity: 0.05 },
        ];

  return (
    <svg
      aria-hidden
      data-testid="timeline-lanes-overlay"
      className="pointer-events-none fixed inset-0 z-[var(--z-chrome)] h-screen w-screen motion-safe:transition-opacity motion-safe:duration-150"
    >
      {bands.map((band) => {
        const top = toClientY(laneTop(band.index, timeline));
        const height = ES_LANE_HEIGHT * viewportZoom;
        return (
          <g key={band.index}>
            <rect
              x={left}
              y={top}
              width={right - left}
              height={height}
              fill={colour}
              fillOpacity={band.opacity}
            />
            {/* The centre line: what the note's own centre lands on. */}
            <line
              x1={left}
              y1={top + height / 2}
              x2={right}
              y2={top + height / 2}
              stroke={colour}
              strokeWidth={1}
              strokeOpacity={band.index === lit ? 0.5 : 0.22}
              strokeDasharray="4 3"
            />
          </g>
        );
      })}
    </svg>
  );
}
