'use client';

// The frame the walkthroughs draw in (liveworkspace/docs/specs/006-media/walkthroughs.md "One package, four apps"):
// fixed over the app's canvas, measured from it, so an editor mounts this anywhere and its cards land over the canvas
// whatever the app's layout. Nothing shows, and nothing is measured or loaded, until a recording or a walkthrough
// opens; then the body's code is fetched once.

import { Portal } from '@liveworkspace/ui';
import { lazy, Suspense, useEffect, useState } from 'react';
import type { Walkthroughs } from '../useWalkthroughs';

const LayerBody = lazy(() => import('./LayerBody'));

type Rect = { top: number; left: number; width: number; height: number };

// The canvas's box, measured again as it resizes and when the tab changes (a new tab can bring a new canvas). A tab
// with no canvas (a liveplanner Board or Sheet) gives the window, so the dock and the player still show over it.
function useRectOf(element: () => HTMLElement | null, active: boolean, tab: string): Rect | null {
  const [rect, setRect] = useState<Rect | null>(null);
  useEffect(() => {
    if (!active) return;
    const el = element();
    const measure = () => {
      const r = el
        ? el.getBoundingClientRect()
        : { top: 0, left: 0, width: window.innerWidth, height: window.innerHeight };
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
    };
    measure();
    const observer =
      el && typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    if (el) observer?.observe(el);
    window.addEventListener('resize', measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [element, active, tab]);
  return active ? rect : null;
}

export function WalkthroughsLayer({ walkthroughs }: { walkthroughs: Walkthroughs }) {
  const { recorder, player, notice, host } = walkthroughs;
  const active = recorder.phase.kind !== 'off' || player.phase.kind !== 'off' || notice !== null;
  const rect = useRectOf(host.canvasRoot, active, host.tab);
  if (!active || !rect) return null;
  // Over the canvas's chrome; over a running slide deck too (it sits at the toast layer), so the bar and the bubble
  // stay in reach while a slide is up.
  const zIndex = host.slides?.current ? 'calc(var(--z-toast, 60) + 1)' : 'var(--z-overlay, 40)';
  return (
    <Portal>
      <div
        data-walkthroughs-layer=""
        style={{ ...rect, zIndex }}
        className="pointer-events-none fixed overflow-hidden"
      >
        <Suspense fallback={null}>
          <LayerBody walkthroughs={walkthroughs} />
        </Suspense>
      </div>
    </Portal>
  );
}
