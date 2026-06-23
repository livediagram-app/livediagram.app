import { type ReactNode } from 'react';
import { useEdgeAwarePlacement } from '@/hooks/canvas/useEdgeAwarePlacement';
import { FloatingTitle } from '@/components/chrome/FloatingTitle';

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
  const { ref, placeAbove, style } = useEdgeAwarePlacement(bounds, canvasOffset, zoom, GAP / zoom);

  return (
    <div
      ref={ref}
      onPointerDown={(e) => e.stopPropagation()}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      className="pointer-events-auto absolute z-20 flex animate-fade-in items-center gap-1 rounded-lg border border-slate-200 bg-white p-1 shadow-lg shadow-slate-900/10 dark:border-slate-800 dark:bg-slate-900 dark:shadow-slate-950/40"
      style={style}
    >
      {title ? <FloatingTitle title={title} placeAbove={placeAbove} /> : null}
      {children}
    </div>
  );
}
