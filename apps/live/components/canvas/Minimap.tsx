'use client';

import { useMemo, useRef, type Ref, type ReactElement } from 'react';
import { endpointPosition, isBoxed, type Element } from '@livediagram/diagram';
import { ZOOM_MAX, ZOOM_MIN } from '@/lib/canvas';
import { ShapeGlyph } from '@/components/primitives/shape-icon';
import { CloseIcon } from '@/components/primitives/CloseIcon';

// Bottom-left "Minimap" (spec/59): a labelled card with a zoomed-out, true-to-
// shape overview of the whole tab — each boxed element painted as its real
// silhouette (a circle reads as a circle) and each arrow as a connecting line —
// with the area outside the current view dimmed so the lit window reads as
// where you are. Tap or drag to re-centre the canvas there; scroll to zoom in
// on that spot; the header's × hides it (writes showMinimap = false). Rendered
// only when enabled, the tab has a few elements, the Activity panel is closed
// (shared corner), and on desktop (all gated by the caller).
//
// Geometry: the canvas transform is `scale(z) translate(o)` about the <main>
// centre, so the viewport centre in world coords is (W/2 - oₓ, H/2 - o_y) and
// the visible world rect is (W/z × H/z) around it; re-centring on a world point
// P is offset = (W/2 - Pₓ, H/2 - P_y). The SVG's viewBox IS world space, so
// getScreenCTM() maps a click/scroll back to world coords (letterbox included).

type MinimapProps = {
  elements: Element[];
  viewportOffset: { x: number; y: number };
  viewportZoom: number;
  setViewportOffset: (offset: { x: number; y: number }) => void;
  setViewportZoom: (zoom: number) => void;
  mainRef: Ref<HTMLElement>;
  // Hide the minimap (persists showMinimap = false; re-enabled in Settings).
  onDisable: () => void;
};

// Padding around the content (a fraction of its size plus a floor) so elements
// never touch the minimap's edge.
const PAD_FRACTION = 0.12;
const PAD_MIN = 48;

export function Minimap({
  elements,
  viewportOffset,
  viewportZoom,
  setViewportOffset,
  setViewportZoom,
  mainRef,
  onDisable,
}: MinimapProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const draggingRef = useRef(false);
  // mainRef is the canvas <main>; read it fresh (it's an object ref at runtime,
  // but the prop type allows a callback ref, so narrow defensively).
  const getMain = () => (mainRef && typeof mainRef !== 'function' ? mainRef.current : null);

  // One pass over the elements builds the wireframe (shape silhouettes + arrow
  // connectors) and the content bounds, recomputed only when elements change —
  // panning/zooming re-renders just the viewport overlay below.
  const { shapes, lines, bounds } = useMemo(() => {
    const shapes: ReactElement[] = [];
    const lines: ReactElement[] = [];
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    let found = false;
    const acc = (px: number, py: number) => {
      found = true;
      if (px < minX) minX = px;
      if (py < minY) minY = py;
      if (px > maxX) maxX = px;
      if (py > maxY) maxY = py;
    };
    for (const el of elements) {
      if (isBoxed(el)) {
        // Shape elements paint their real silhouette; other boxed kinds
        // (images, embeds, …) have no `shape`, so a rounded rect stands in.
        shapes.push(
          'shape' in el && el.shape ? (
            <ShapeGlyph
              key={el.id}
              kind={el.shape}
              x={el.x}
              y={el.y}
              width={el.width}
              height={el.height}
              preserveAspectRatio="none"
              fill="currentColor"
              stroke="none"
            />
          ) : (
            <rect
              key={el.id}
              x={el.x}
              y={el.y}
              width={el.width}
              height={el.height}
              rx={Math.min(el.width, el.height) * 0.08}
              fill="currentColor"
            />
          ),
        );
        acc(el.x, el.y);
        acc(el.x + el.width, el.y + el.height);
      } else if (el.type === 'arrow') {
        const a = endpointPosition(el.from, elements);
        const b = endpointPosition(el.to, elements);
        lines.push(
          <line
            key={el.id}
            x1={a.x}
            y1={a.y}
            x2={b.x}
            y2={b.y}
            className="stroke-slate-400 dark:stroke-slate-500"
            strokeWidth={1.25}
            vectorEffect="non-scaling-stroke"
            strokeLinecap="round"
          />,
        );
        acc(a.x, a.y);
        acc(b.x, b.y);
      }
    }
    return {
      shapes,
      lines,
      bounds: found ? { x: minX, y: minY, width: maxX - minX, height: maxY - minY } : null,
    };
  }, [elements]);

  const recentreToClient = (clientX: number, clientY: number) => {
    const svg = svgRef.current;
    const ctm = svg?.getScreenCTM();
    const r = getMain()?.getBoundingClientRect();
    if (!svg || !ctm || !r) return null;
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const world = pt.matrixTransform(ctm.inverse());
    setViewportOffset({ x: r.width / 2 - world.x, y: r.height / 2 - world.y });
    return world;
  };

  if (!bounds) return null; // Nothing to map.

  const padX = bounds.width * PAD_FRACTION + PAD_MIN;
  const padY = bounds.height * PAD_FRACTION + PAD_MIN;
  const x0 = bounds.x - padX;
  const y0 = bounds.y - padY;
  const x1 = bounds.x + bounds.width + padX;
  const y1 = bounds.y + bounds.height + padY;
  const vb = `${x0} ${y0} ${x1 - x0} ${y1 - y0}`;

  const rect = getMain()?.getBoundingClientRect();
  const w = rect?.width ?? 0;
  const h = rect?.height ?? 0;
  const z = viewportZoom || 1;
  const viewCx = w / 2 - viewportOffset.x;
  const viewCy = h / 2 - viewportOffset.y;
  // Visible-world rect, clamped to the padded content box so the "current view"
  // highlight + the dimmed surround never spill past the map edges.
  const vx = Math.max(x0, viewCx - w / z / 2);
  const vy = Math.max(y0, viewCy - h / z / 2);
  const vx1 = Math.min(x1, viewCx + w / z / 2);
  const vy1 = Math.min(y1, viewCy + h / z / 2);
  const hasView = vx1 > vx && vy1 > vy;

  // Scroll on the minimap zooms the canvas in/out centred on that spot.
  const onWheel = (e: React.WheelEvent) => {
    const world = recentreToClient(e.clientX, e.clientY);
    if (!world) return;
    const factor = Math.exp(-e.deltaY / 200);
    setViewportZoom(Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, viewportZoom * factor)));
  };

  return (
    <div
      data-floating-panel
      className="pointer-events-auto absolute bottom-4 left-4 z-[var(--z-panel)] w-48 overflow-hidden rounded-xl bg-white/90 shadow-lg ring-1 ring-slate-900/10 backdrop-blur transition hover:ring-brand-500/40 dark:bg-slate-900/90 dark:ring-white/10"
    >
      {/* Header so the panel is unmistakably the canvas minimap. */}
      <div className="flex items-center gap-1.5 border-b border-slate-200/70 px-2.5 py-1.5 dark:border-slate-700/60">
        <span className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">
          Minimap
        </span>
        <button
          type="button"
          onClick={onDisable}
          aria-label="Hide minimap"
          className="-mr-1 ml-auto rounded p-0.5 text-slate-400 transition hover:bg-slate-200/70 hover:text-slate-600 dark:text-slate-500 dark:hover:bg-slate-700/60 dark:hover:text-slate-200"
        >
          <CloseIcon size={13} strokeWidth={1.6} />
        </button>
      </div>
      <svg
        ref={svgRef}
        viewBox={vb}
        preserveAspectRatio="xMidYMid meet"
        className="block h-28 w-full cursor-pointer touch-none bg-slate-50/60 text-slate-400 dark:bg-slate-950/40 dark:text-slate-500"
        role="img"
        aria-label="Canvas minimap — tap or drag to navigate, scroll to zoom"
        onPointerDown={(e) => {
          draggingRef.current = true;
          e.currentTarget.setPointerCapture(e.pointerId);
          recentreToClient(e.clientX, e.clientY);
        }}
        onPointerMove={(e) => {
          if (draggingRef.current) recentreToClient(e.clientX, e.clientY);
        }}
        onPointerUp={(e) => {
          draggingRef.current = false;
          e.currentTarget.releasePointerCapture(e.pointerId);
        }}
        onWheel={onWheel}
      >
        {/* Connectors first so they sit behind the shapes. */}
        {lines}
        {shapes}
        {hasView ? (
          <>
            {/* Dim everything outside the current view (even-odd: outer box
                minus the view hole) so the lit window reads at a glance as
                "where you are on the canvas". */}
            <path
              d={`M${x0} ${y0}H${x1}V${y1}H${x0}Z M${vx} ${vy}H${vx1}V${vy1}H${vx}Z`}
              fillRule="evenodd"
              className="fill-slate-500/25 dark:fill-slate-950/55"
            />
            <rect
              x={vx}
              y={vy}
              width={vx1 - vx}
              height={vy1 - vy}
              rx={3}
              fill="none"
              className="stroke-brand-500 dark:stroke-brand-400"
              strokeWidth={1.75}
              vectorEffect="non-scaling-stroke"
            />
          </>
        ) : null}
      </svg>
    </div>
  );
}
