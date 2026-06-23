'use client';

import { useMemo, useRef, type Ref } from 'react';
import { isBoxed, unionBoxedBounds, type Element } from '@livediagram/diagram';

// Bottom-left minimap (spec/59): a zoomed-out wireframe of the whole tab with
// a rectangle marking the current viewport. Tap or drag it to re-centre the
// canvas on that point. Rendered only when the Activity panel is closed (it
// shares the bottom-left corner) and on desktop (gated by the caller).
//
// Geometry: the canvas transform is `scale(z) translate(o)` about the <main>
// centre, so the viewport centre in world coords is (W/2 - oₓ, H/2 - o_y) and
// the visible world rect is (W/z × H/z) around it; re-centring on a world
// point P is therefore offset = (W/2 - Pₓ, H/2 - P_y). The SVG draws elements
// in world coords (its viewBox IS world space), so getScreenCTM() handles the
// click → world mapping including the letterbox.

type MinimapProps = {
  elements: Element[];
  viewportOffset: { x: number; y: number };
  viewportZoom: number;
  setViewportOffset: (offset: { x: number; y: number }) => void;
  mainRef: Ref<HTMLElement>;
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
  mainRef,
}: MinimapProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const draggingRef = useRef(false);
  // mainRef is the canvas <main>; read it fresh (it's an object ref at runtime,
  // but the prop type allows a callback ref, so narrow defensively).
  const getMain = () => (mainRef && typeof mainRef !== 'function' ? mainRef.current : null);

  // Element wireframe — recomputed only when the elements change, not on every
  // pan/zoom (which re-renders only the viewport rect below).
  const ids = useMemo(() => new Set(elements.map((e) => e.id)), [elements]);
  const rects = useMemo(
    () =>
      elements
        .filter(isBoxed)
        .map((el) => (
          <rect
            key={el.id}
            x={el.x}
            y={el.y}
            width={el.width}
            height={el.height}
            rx={Math.min(el.width, el.height) * 0.08}
            className="fill-slate-300 dark:fill-slate-600"
          />
        )),
    [elements],
  );

  const bounds = unionBoxedBounds(elements, ids);
  if (!bounds) return null; // Nothing to map on an empty tab.

  const padX = bounds.width * PAD_FRACTION + PAD_MIN;
  const padY = bounds.height * PAD_FRACTION + PAD_MIN;
  const vb = `${bounds.x - padX} ${bounds.y - padY} ${bounds.width + padX * 2} ${bounds.height + padY * 2}`;

  const rect = getMain()?.getBoundingClientRect();
  const w = rect?.width ?? 0;
  const h = rect?.height ?? 0;
  const z = viewportZoom || 1;
  const viewW = w / z;
  const viewH = h / z;
  const viewCx = w / 2 - viewportOffset.x;
  const viewCy = h / 2 - viewportOffset.y;

  const recentreToClient = (clientX: number, clientY: number) => {
    const svg = svgRef.current;
    const ctm = svg?.getScreenCTM();
    const r = getMain()?.getBoundingClientRect();
    if (!svg || !ctm || !r) return;
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const world = pt.matrixTransform(ctm.inverse());
    setViewportOffset({ x: r.width / 2 - world.x, y: r.height / 2 - world.y });
  };

  return (
    <div
      data-floating-panel
      className="pointer-events-auto absolute bottom-4 left-4 z-[var(--z-panel)] w-44 overflow-hidden rounded-lg border border-slate-200 bg-white/85 shadow-md backdrop-blur-sm dark:border-slate-700 dark:bg-slate-900/85"
    >
      <svg
        ref={svgRef}
        viewBox={vb}
        preserveAspectRatio="xMidYMid meet"
        className="block h-28 w-full cursor-pointer touch-none"
        role="img"
        aria-label="Canvas minimap — tap or drag to navigate"
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
      >
        {rects}
        {/* Current viewport. */}
        <rect
          x={viewCx - viewW / 2}
          y={viewCy - viewH / 2}
          width={viewW}
          height={viewH}
          className="fill-brand-500/10 stroke-brand-500 dark:stroke-brand-400"
          strokeWidth={1.5}
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </div>
  );
}
