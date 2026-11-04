'use client';

import { useCallback, useState } from 'react';
import { createPortal } from 'react-dom';
import { CANVAS_ROOT_SELECTOR } from '@liveworkspace/workbench/lib/canvas-selectors';

// What stands in the Overview's place while its code loads (docs/specs/026-plan/plan-overview.md "Performance"): the
// page's own plain background over the canvas, in the box the page fills, so a plan opening on its Overview never
// shows the canvas first. Static and tiny: it is in the editor's first load, the page is not.
export function OverviewLoadingCover() {
  const [canvas, setCanvas] = useState<HTMLElement | null>(null);
  const mark = useCallback((node: HTMLElement | null) => {
    if (node) setCanvas(document.querySelector<HTMLElement>(CANVAS_ROOT_SELECTOR));
  }, []);
  return (
    <>
      <span hidden ref={mark} />
      {canvas
        ? createPortal(
            <div
              data-canvas-cover=""
              data-testid="overview-loading-cover"
              aria-busy="true"
              className="absolute inset-0 z-[var(--z-chrome)] bg-slate-50 dark:bg-slate-950"
            />,
            canvas,
          )
        : null}
    </>
  );
}
