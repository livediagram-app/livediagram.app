'use client';

// The cover a tab-filling board, Sheet or view shows while its chunk loads (docs/specs/026-plan/plan-board.md
// "Fill Tab"): the canvas's own opaque backdrop over the whole canvas area, at once, so the element is never seen
// drawn small on the canvas first and nothing behind it shows. The real cover (FilledTabLayer) takes its place in
// the same commit the view arrives. Kept tiny and out of MaximisedPlanLayer, which this must not pull into the
// canvas's chunk.
import { createContext, useCallback, useContext, useState } from 'react';
import { createPortal } from 'react-dom';
import { useFillsTab } from '@/hooks/plan/plan-cover-store';
import { CANVAS_ROOT_SELECTOR } from '@liveworkspace/workbench/lib/canvas-selectors';

// The element whose view is loading, set by ShapeContentRouter's OffDashboard around it.
export const FillTabElementContext = createContext<string | null>(null);

const stop = (e: { stopPropagation: () => void }) => e.stopPropagation();

// next/dynamic's `loading`: it renders where the view will, so it reads the element from context.
export function FillTabPending() {
  const id = useContext(FillTabElementContext);
  return id === null ? null : <PendingCover id={id} />;
}

function PendingCover({ id }: { id: string }) {
  const fills = useFillsTab(id);
  const [canvas, setCanvas] = useState<HTMLElement | null>(null);
  const mark = useCallback((node: HTMLElement | null) => {
    if (node) setCanvas(node.closest<HTMLElement>(CANVAS_ROOT_SELECTOR));
  }, []);
  if (!fills) return null;
  return (
    <>
      <span hidden ref={mark} />
      {canvas
        ? createPortal(
            <div
              aria-hidden
              data-fill-tab-pending=""
              // The canvas's gestures stand down for a press on it, as on the real cover (useCanvasSurfaceGestures).
              data-canvas-cover=""
              // CanvasCover's layer and backdrop (CANVAS_LAYER_Z), so the swap to it is seamless.
              className="absolute inset-0 z-[calc(var(--z-panel)-1)]"
              style={{ background: 'inherit' }}
              onPointerDown={stop}
              onDoubleClick={stop}
              onWheel={stop}
            />,
            canvas,
          )
        : null}
    </>
  );
}
