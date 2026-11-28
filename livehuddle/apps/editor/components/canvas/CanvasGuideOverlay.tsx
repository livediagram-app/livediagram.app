import {
  MarqueeRect,
  type MarqueeState,
} from '@liveworkspace/workbench/components/canvas/MarqueeRect';
import type { ReadableStore } from '@liveworkspace/workbench/lib/state-store';
import { useCanvasViewKey } from '@liveworkspace/workbench/hooks/canvas/useViewportStore';
import type { RefObject } from 'react';
import {
  deriveTextColorForBg,
  type AlignmentGuide,
  type DistributionGuide,
} from '@livehuddle/document';
import { getTheme, type ThemeId } from '@/lib/themes';
import type { SnapTarget } from '@/components/canvas/Canvas.types';
import { useCanvasClientOrigin } from '@liveworkspace/workbench/hooks/canvas/useCanvasClientOrigin';
import { useCanvasSurface } from '@/components/canvas/CanvasSurfaceContext';
import { selectionBoxColors } from '@/lib/selection-box';
import { real3DScreenAt } from '@/lib/real-3d/real-3d-pick';

type Marquee = ReadableStore<MarqueeState | null>;

type CanvasGuideOverlayProps = {
  alignGuides: AlignmentGuide[];
  allSnapTargets: SnapTarget[];
  distGuides: DistributionGuide[];
  drawHover: { x: number; y: number } | null;
  marquee: Marquee;
  // The active tab's theme id, so the guides / marquee tint to the tab's
  // accent (same derivation the rest of the chrome uses).
  tabThemeId: ThemeId;
  wrapperRef: RefObject<HTMLDivElement | null>;
  // The canvas size. With the view, read from the viewport store here, it is what the wrapper's
  // origin follows (useCanvasViewKey), so the chrome around this takes no view.
  mainSize: { width: number; height: number };
};

// The in-canvas snap overlays drawn during a drag: alignment guides, arrow
// snap-point markers, the pre-press snap dot, equal-spacing (distribution)
// guides, and the marquee selection rectangle. Pure SVG, converting canvas
// coords -> client via the wrapper rect + zoom. Split out of CanvasChrome.
/**
 * A canvas point on the screen: through Real 3D's camera while it draws, so a guide lies on the floor where the piece
 * is (docs/specs/008-canvas/3d-view.md "Editing in 3D"); else by the flat view's origin and zoom.
 */
function screenOf(rect: { left: number; top: number }, zoom: number, x: number, y: number) {
  return real3DScreenAt(x, y) ?? { x: rect.left + x * zoom, y: rect.top + y * zoom };
}

export function CanvasGuideOverlay({
  alignGuides,
  allSnapTargets,
  distGuides,
  drawHover,
  marquee,
  tabThemeId,
  wrapperRef,
  mainSize,
}: CanvasGuideOverlayProps) {
  const { viewportZoom, viewKey } = useCanvasViewKey(mainSize);
  const surface = useCanvasSurface();
  const marqueeColors = selectionBoxColors(getTheme(tabThemeId).elementStroke, surface);
  // Where canvas (0, 0) sits on screen, measured only while a canvas-space guide shows (the marquee is
  // already in client coords).
  const origin = useCanvasClientOrigin(
    wrapperRef,
    alignGuides.length > 0 || allSnapTargets.length > 0 || !!drawHover || distGuides.length > 0,
    viewKey,
  );
  const toScreen = (rect: { left: number; top: number }, x: number, y: number) =>
    screenOf(rect, viewportZoom, x, y);
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
                  const a = toScreen(
                    rect,
                    g.axis === 'x' ? g.position : g.start,
                    g.axis === 'x' ? g.start : g.position,
                  );
                  const b = toScreen(
                    rect,
                    g.axis === 'x' ? g.position : g.end,
                    g.axis === 'x' ? g.end : g.position,
                  );
                  const [x1, y1, x2, y2] = [a.x, a.y, b.x, b.y];
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
                  const { x, y } = toScreen(rect, t.x, t.y);
                  return (
                    <circle
                      key={`snap-${i}`}
                      cx={x}
                      cy={y}
                      r={t.active ? 5 : 3.5}
                      fill={t.active ? 'var(--color-brand-500)' : 'white'}
                      stroke="var(--color-brand-500)"
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
            const { x, y } = toScreen(rect, drawHover.x, drawHover.y);
            return (
              <svg
                aria-hidden
                className="pointer-events-none fixed inset-0 z-[var(--z-chrome)] h-screen w-screen"
              >
                <circle
                  cx={x}
                  cy={y}
                  r={3.5}
                  fill="var(--color-brand-500)"
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
            const color = 'rgb(236, 72, 153)'; // pink-500, distinct from alignment
            // A span from `from` to `to` along its axis at `cross`, with its tick caps, as screen points.
            const seg = (axis: 'x' | 'y', at: number, cross: number) =>
              axis === 'x' ? toScreen(rect, at, cross) : toScreen(rect, cross, at);
            return (
              <svg
                aria-hidden
                className="pointer-events-none fixed inset-0 z-[var(--z-chrome)] h-screen w-screen"
              >
                {distGuides.flatMap((g, gi) =>
                  g.spans.map((s, si) => {
                    const key = `${gi}:${si}`;
                    // A cross-axis reference span carries its own axis; each tick crosses its end.
                    const axis = s.axis ?? g.axis;
                    const p1 = seg(axis, s.from, s.cross);
                    const p2 = seg(axis, s.to, s.cross);
                    const t = axis === 'x' ? { x: 0, y: 4 } : { x: 4, y: 0 };
                    return (
                      <g key={key} stroke={color} strokeWidth={1}>
                        <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} />
                        <line x1={p1.x - t.x} y1={p1.y - t.y} x2={p1.x + t.x} y2={p1.y + t.y} />
                        <line x1={p2.x - t.x} y1={p2.y - t.y} x2={p2.x + t.x} y2={p2.y + t.y} />
                      </g>
                    );
                  }),
                )}
              </svg>
            );
          })()
        : null}

      <MarqueeRect store={marquee} stroke={marqueeColors.stroke} fill={marqueeColors.fill} />
    </>
  );
}
