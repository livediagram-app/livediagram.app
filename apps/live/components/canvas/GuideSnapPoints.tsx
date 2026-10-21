'use client';

// Where a drawing can start on a logo page's guides (docs/specs/007-editor/logo-pages.md "Drawing
// onto the guides"): while a drawing tool is in hand (the Pen, the Pencil, a marker) and the page
// under the pointer shows its guides, a faint dot at each place the guides cross near the pointer,
// and a ring at the point a press there would start from (the same snap the stroke and the Pen
// use). None while the page offers its layouts (Start From a Layout). In the canvas layer, sized in
// screen px at any zoom; takes no presses.
import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import {
  logoGuides,
  logoGuideSnapTargets,
  logoPageAt,
  type LaidOutPage,
} from '@livediagram/document';
import type { LogoToolsView } from '@/hooks/editor/useLogoTools';
import type { PendingDraw } from '@/lib/draw-mode';
import { pointerToCanvas } from '@/lib/canvas';

const GUIDE_COLOUR = '#06b6d4';
// Screen px: a crossing's dot, and the ring at the snapped point.
const DOT_PX = 2.5;
const RING_PX = 6;
// Screen px round the pointer within which a crossing shows.
export const SNAP_POINTS_NEAR_PX = 64;

type Point = { x: number; y: number };

/** Whether `intent` is a tool whose start snaps to the guides: a pen, the pencil or the Path tool. */
export function drawsOntoGuides(intent: PendingDraw | null | undefined): boolean {
  if (!intent) return false;
  if (intent.type === 'path') return true;
  return (
    intent.type === 'freehand' && intent.variant !== 'highlighter' && intent.variant !== 'shape-pen'
  );
}

export function GuideSnapPoints({
  pages,
  tools,
  pendingDraw,
  wrapperRef,
  zoom,
}: {
  pages: readonly LaidOutPage[];
  tools: LogoToolsView;
  pendingDraw: PendingDraw | null | undefined;
  wrapperRef: RefObject<HTMLDivElement | null>;
  zoom: number;
}) {
  const armed = drawsOntoGuides(pendingDraw) && !!tools.snapPoint;
  const [cursor, setCursor] = useState<Point | null>(null);
  const zoomRef = useRef(zoom);
  useEffect(() => {
    zoomRef.current = zoom;
  });
  // The pointer, in canvas px, one update a frame.
  useEffect(() => {
    if (!armed) return;
    let raf = 0;
    let latest: Point | null = null;
    const move = (e: PointerEvent) => {
      const rect = wrapperRef.current?.getBoundingClientRect();
      if (!rect) return;
      latest = pointerToCanvas(e.clientX, e.clientY, rect, zoomRef.current);
      if (!raf)
        raf = requestAnimationFrame(() => {
          raf = 0;
          setCursor(latest);
        });
    };
    window.addEventListener('pointermove', move, { passive: true });
    return () => {
      window.removeEventListener('pointermove', move);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [armed, wrapperRef]);

  // The pointer only counts while a drawing tool is in hand.
  const at = armed ? cursor : null;
  const page = at ? (logoPageAt(pages, at) ?? null) : null;
  // The page's Start From a Layout card (EmptyPageLayouts) open over it: its choice comes first.
  const offersLayouts =
    page !== null && document.querySelector(`[data-empty-page-layouts="${page.id}"]`) !== null;
  const shows = page !== null && !offersLayouts && tools.guidesOn(page.id);
  const crossings = useMemo(
    () =>
      page && shows
        ? logoGuideSnapTargets(logoGuides(page.rect), (part) => tools.guideParts.has(part))
            .crossings
        : [],
    [page, shows, tools.guideParts],
  );
  if (!page || !shows || !at) return null;
  const snapped = tools.snapPoint?.(at, zoom) ?? null;
  const px = (n: number) => n / zoom;
  const near = px(SNAP_POINTS_NEAR_PX);
  const close = crossings.filter((c) => Math.hypot(c.x - at.x, c.y - at.y) <= near);
  if (close.length === 0 && !snapped) return null;
  return (
    <svg
      aria-hidden
      data-guide-snap-points=""
      // A point at the canvas origin, the dots overflowing it in canvas px.
      className="pointer-events-none absolute left-0 top-0 h-px w-px overflow-visible"
    >
      {close.map((c, i) => (
        <circle key={i} cx={c.x} cy={c.y} r={px(DOT_PX)} fill={GUIDE_COLOUR} fillOpacity={0.55} />
      ))}
      {snapped ? (
        <circle
          data-guide-snap-target=""
          cx={snapped.x}
          cy={snapped.y}
          r={px(RING_PX)}
          fill="none"
          stroke={GUIDE_COLOUR}
          strokeWidth={px(1.5)}
        />
      ) : null}
    </svg>
  );
}
