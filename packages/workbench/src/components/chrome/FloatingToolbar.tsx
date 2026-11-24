import { type ReactNode } from 'react';
import { useEdgeAwarePlacement } from '../../hooks/canvas/useEdgeAwarePlacement';
import { FloatingTitle } from './FloatingTitle';
import type { Rect } from '@liveworkspace/element-model/geometry';

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
  suspended = false,
  title,
  children,
}: {
  bounds: Rect;
  canvasOffset: { x: number; y: number };
  zoom: number;
  // Hidden while the selection moves: measures nothing until it ends (useEdgeAwarePlacement).
  suspended?: boolean;
  title?: string;
  children: ReactNode;
}) {
  const { ref, placeAbove, style } = useEdgeAwarePlacement(
    bounds,
    canvasOffset,
    zoom,
    GAP / zoom,
    suspended,
  );
  return (
    <div
      ref={ref}
      onPointerDown={(e) => e.stopPropagation()}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      role="toolbar"
      aria-label={title}
      // Its 28px and 32px buttons sit 4px apart: on a touch screen each tap area is 44px both ways, drawn behind them
      // (touch-target-packed; the z-index makes this a stacking context, touch-targets.md).
      className="pointer-events-auto absolute z-[var(--z-toolbar)] flex animate-fade-in items-center gap-1 rounded-lg border border-slate-200 bg-white p-1 shadow-lg shadow-slate-900/10 dark:border-slate-800 dark:bg-slate-900 dark:shadow-slate-950/40 [&_.h-7]:relative [&_.h-7]:touch-target-packed [&_.h-8]:relative [&_.h-8]:touch-target-packed"
      style={style}
    >
      {title ? <FloatingTitle title={title} placeAbove={placeAbove} /> : null}
      {children}
    </div>
  );
}
