import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { VIEWPORT_EDGE_MARGIN as EDGE } from '@/lib/clamp-to-viewport';

type Bounds = { x: number; y: number; width: number; height: number };

const GAP = 14; // canvas-space gap between the toolbar and the selection

// A toolbar that floats above (or below, when there's no room) a selection's
// bounding box and counter-scales so it stays a constant on-screen size under
// canvas zoom. The same positioning SelectionPopover uses, packaged so the
// multi-selection toolbar can sit over the selection instead of pinned to the
// top of the screen. Renders an optional uppercase title line above/below.
//
// Must be rendered inside the canvas world-transform wrapper (scale(zoom) +
// translate(offset)); `bounds`/`canvasOffset` are canvas-space.
export function FloatingToolbar({
  bounds,
  canvasOffset,
  zoom,
  title,
  children,
}: {
  bounds: Bounds;
  canvasOffset: { x: number; y: number };
  zoom: number;
  title?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [adjust, setAdjust] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const flipSigRef = useRef('');
  const flippedRef = useRef(false);
  const [placeAbove, setPlaceAbove] = useState(true);

  const gap = GAP / zoom;
  const baseTop = placeAbove ? bounds.y - gap : bounds.y + bounds.height + gap;
  const baseLeft = bounds.x + bounds.width / 2;

  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    // One flip per geometry so a toolbar that fits neither side can't
    // ping-pong forever (the SelectionPopover guard).
    const sig = `${bounds.x},${bounds.y},${bounds.width},${bounds.height},${canvasOffset.x},${canvasOffset.y},${zoom}`;
    if (flipSigRef.current !== sig) {
      flipSigRef.current = sig;
      flippedRef.current = false;
    }
    const rect = node.getBoundingClientRect();
    if (!flippedRef.current) {
      if (placeAbove && rect.top < EDGE) {
        flippedRef.current = true;
        setPlaceAbove(false);
        return;
      }
      if (!placeAbove && rect.bottom > window.innerHeight - EDGE) {
        flippedRef.current = true;
        setPlaceAbove(true);
        return;
      }
    }
    let dx = 0;
    let dy = 0;
    if (rect.left < EDGE) dx = EDGE - rect.left;
    else if (rect.right > window.innerWidth - EDGE) dx = window.innerWidth - EDGE - rect.right;
    if (rect.top < EDGE) dy = EDGE - rect.top;
    else if (rect.bottom > window.innerHeight - EDGE) dy = window.innerHeight - EDGE - rect.bottom;
    if (dx !== adjust.x || dy !== adjust.y) setAdjust({ x: dx, y: dy });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bounds.x, bounds.y, bounds.width, bounds.height, canvasOffset.x, canvasOffset.y, placeAbove]);

  return (
    <div
      ref={ref}
      onPointerDown={(e) => e.stopPropagation()}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      className="pointer-events-auto absolute z-20 flex animate-fade-in items-center gap-1 rounded-lg border border-slate-200 bg-white p-1 shadow-lg shadow-slate-900/10 dark:border-slate-800 dark:bg-slate-900 dark:shadow-slate-950/40"
      style={{
        left: baseLeft + adjust.x,
        top: baseTop + adjust.y,
        transform: `translate(-50%, ${placeAbove ? '-100%' : '0'}) scale(${1 / zoom})`,
        transformOrigin: placeAbove ? 'center bottom' : 'center top',
      }}
    >
      {title ? (
        <span
          className={`pointer-events-none absolute left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-white/90 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500 shadow-sm ring-1 ring-slate-200 dark:bg-slate-700 dark:text-white dark:ring-0 ${
            placeAbove ? 'bottom-full mb-1' : 'top-full mt-1'
          }`}
        >
          {title}
        </span>
      ) : null}
      {children}
    </div>
  );
}
