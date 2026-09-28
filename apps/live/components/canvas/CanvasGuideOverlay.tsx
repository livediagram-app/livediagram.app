import type { RefObject } from 'react';
import {
  deriveTextColorForBg,
  type AlignmentGuide,
  type DistributionGuide,
} from '@livediagram/diagram';
import { getTheme, type ThemeId } from '@/lib/themes';
import type { SnapTarget } from '@/components/canvas/Canvas.types';
import { useCanvasClientOrigin } from '@/hooks/canvas/useCanvasClientOrigin';

type Marquee = { startX: number; startY: number; currentX: number; currentY: number } | null;

type CanvasGuideOverlayProps = {
  alignGuides: AlignmentGuide[];
  allSnapTargets: SnapTarget[];
  distGuides: DistributionGuide[];
  drawHover: { x: number; y: number } | null;
  marquee: Marquee;
  // The active tab's theme id, so the guides / marquee tint to the tab's
  // accent (same derivation the rest of the chrome uses).
  tabThemeId: ThemeId;
  viewportZoom: number;
  wrapperRef: RefObject<HTMLDivElement | null>;
};

// The in-canvas snap overlays drawn during a drag: alignment guides, arrow
// snap-point markers, the pre-press snap dot, equal-spacing (distribution)
// guides, and the marquee selection rectangle. Pure SVG, converting canvas
// coords -> client via the wrapper rect + zoom. Split out of CanvasChrome.
export function CanvasGuideOverlay({
  alignGuides,
  allSnapTargets,
  distGuides,
  drawHover,
  marquee,
  tabThemeId,
  viewportZoom,
  wrapperRef,
}: CanvasGuideOverlayProps) {
  const accentColor = getTheme(tabThemeId).elementStroke ?? '#0ea5e9';
  // Where canvas (0, 0) sits on screen, measured only while a canvas-space guide shows (the marquee is
  // already in client coords).
  const origin = useCanvasClientOrigin(
    wrapperRef,
    alignGuides.length > 0 || allSnapTargets.length > 0 || !!drawHover || distGuides.length > 0,
  );
  return (
    <>
      {/* Alignment guides. While a move / resize snap is in effect,
          draw a faint line along each edge / centre the dragged element
          now shares with a neighbour, so the user sees WHY it snapped.
          Canvas coords convert to client coords via the wrapper rect +
          zoom (same as the draw / pen previews). The colour follows the
          theme: the theme's element stroke when it sets one, else a
          slate tuned to contrast with the theme's backdrop — faint via
          opacity so it reads as helper chrome, not content. */}
      {alignGuides.length > 0
        ? (() => {
            const rect = origin;
            if (!rect) return null;
            const theme = getTheme(tabThemeId);
            const color = theme.elementStroke ?? deriveTextColorForBg(theme.backgroundColor);
            return (
              <svg
                aria-hidden
                className="pointer-events-none fixed inset-0 z-[var(--z-chrome)] h-screen w-screen"
              >
                {alignGuides.map((g, i) => {
                  // Convert the guide's canvas-space line into the two
                  // screen-space endpoints. A vertical guide (axis 'x')
                  // holds x constant and runs start→end in y; horizontal
                  // is the mirror.
                  const x1 = rect.left + (g.axis === 'x' ? g.position : g.start) * viewportZoom;
                  const y1 = rect.top + (g.axis === 'x' ? g.start : g.position) * viewportZoom;
                  const x2 = rect.left + (g.axis === 'x' ? g.position : g.end) * viewportZoom;
                  const y2 = rect.top + (g.axis === 'x' ? g.end : g.position) * viewportZoom;
                  return (
                    <line
                      key={`${g.axis}:${g.position}:${i}`}
                      x1={x1}
                      y1={y1}
                      x2={x2}
                      y2={y2}
                      stroke={color}
                      strokeWidth={1}
                      strokeOpacity={0.55}
                      strokeDasharray="4 3"
                    />
                  );
                })}
              </svg>
            );
          })()
        : null}

      {/* Arrow-endpoint snap targets. While dragging an arrow's endpoint,
          mark the connection points of nearby shapes so the user can see
          where it will snap; the point the endpoint is currently snapped to
          is drawn larger + filled. Same canvas→screen conversion as the
          guides above. */}
      {allSnapTargets.length > 0
        ? (() => {
            const rect = origin;
            if (!rect) return null;
            return (
              <svg
                aria-hidden
                className="pointer-events-none fixed inset-0 z-[var(--z-chrome)] h-screen w-screen"
              >
                {allSnapTargets.map((t, i) => {
                  const x = rect.left + t.x * viewportZoom;
                  const y = rect.top + t.y * viewportZoom;
                  return (
                    <circle
                      key={`snap-${i}`}
                      cx={x}
                      cy={y}
                      r={t.active ? 5 : 3.5}
                      fill={t.active ? 'rgb(14, 165, 233)' : 'white'}
                      stroke="rgb(14, 165, 233)"
                      strokeWidth={t.active ? 2 : 1.5}
                    />
                  );
                })}
              </svg>
            );
          })()
        : null}

      {/* Pre-press start-snap dot. While a draw is armed and the hovered
          pointer has snapped to a neighbour, mark the snapped point so the
          user knows where the first corner will land before pressing (the
          guide lines above show what it aligned to). */}
      {drawHover
        ? (() => {
            const rect = origin;
            if (!rect) return null;
            const x = rect.left + drawHover.x * viewportZoom;
            const y = rect.top + drawHover.y * viewportZoom;
            return (
              <svg
                aria-hidden
                className="pointer-events-none fixed inset-0 z-[var(--z-chrome)] h-screen w-screen"
              >
                <circle
                  cx={x}
                  cy={y}
                  r={3.5}
                  fill="rgb(14, 165, 233)"
                  stroke="white"
                  strokeWidth={1.5}
                />
              </svg>
            );
          })()
        : null}

      {/* Equal-spacing (distribution) guides. While a move snaps an
          element to even spacing with its neighbours, draw the matched
          gap segments as pink tick-capped lines so the equal distances
          read at a glance. Same canvas→screen conversion as above. */}
      {distGuides.length > 0
        ? (() => {
            const rect = origin;
            if (!rect) return null;
            const cx = (v: number) => rect.left + v * viewportZoom;
            const cy = (v: number) => rect.top + v * viewportZoom;
            const color = 'rgb(236, 72, 153)'; // pink-500, distinct from alignment
            return (
              <svg
                aria-hidden
                className="pointer-events-none fixed inset-0 z-[var(--z-chrome)] h-screen w-screen"
              >
                {distGuides.flatMap((g, gi) =>
                  g.spans.map((s, si) => {
                    const key = `${gi}:${si}`;
                    if (g.axis === 'x') {
                      const x1 = cx(s.from);
                      const x2 = cx(s.to);
                      const y = cy(s.cross);
                      return (
                        <g key={key} stroke={color} strokeWidth={1}>
                          <line x1={x1} y1={y} x2={x2} y2={y} />
                          <line x1={x1} y1={y - 4} x2={x1} y2={y + 4} />
                          <line x1={x2} y1={y - 4} x2={x2} y2={y + 4} />
                        </g>
                      );
                    }
                    const y1 = cy(s.from);
                    const y2 = cy(s.to);
                    const x = cx(s.cross);
                    return (
                      <g key={key} stroke={color} strokeWidth={1}>
                        <line x1={x} y1={y1} x2={x} y2={y2} />
                        <line x1={x - 4} y1={y1} x2={x + 4} y2={y1} />
                        <line x1={x - 4} y1={y2} x2={x + 4} y2={y2} />
                      </g>
                    );
                  }),
                )}
              </svg>
            );
          })()
        : null}

      {marquee ? (
        <div
          aria-hidden
          // Border + faint fill take the active tab theme's accent (elementStroke,
          // else the brand sky) so the marquee suits the tab. color-mix keeps the
          // 12% fill working whatever colour format the theme uses.
          className="pointer-events-none fixed z-[var(--z-chrome)] rounded-sm border"
          style={{
            left: Math.min(marquee.startX, marquee.currentX),
            top: Math.min(marquee.startY, marquee.currentY),
            width: Math.abs(marquee.currentX - marquee.startX),
            height: Math.abs(marquee.currentY - marquee.startY),
            borderColor: accentColor,
            backgroundColor: `color-mix(in srgb, ${accentColor} 12%, transparent)`,
          }}
        />
      ) : null}
    </>
  );
}
