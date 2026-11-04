'use client';

// A tab tile's preview (docs/specs/026-plan/plan-overview.md "Tabs"): the tab as it looks, a still picture scaled
// into the tile. Drawn only once the tile is near the screen and its turn in the queue comes, then kept. Inert: it
// holds no control, is never read out, sends nothing and writes nothing.
import { memo, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { LoadingSweep, trustedHtml } from '@liveplanner/ui';
import type { Tab } from '@liveplanner/project';
import { useTabBackdropPaint } from '@/components/split/useTabBackdropPaint';
import type { TabTileState } from './overview-tabs';
import { PreviewBoundary } from './PreviewBoundary';
import { queuePreview } from './preview-queue';
import { isWindowed, previewFit } from './tab-preview-svg';
import { useNearScreen } from './useNearScreen';
import { useTabPreviewSvg } from './useTabPreviewSvg';
import { LivePlanPreview, fillingElementOf } from './LivePlanPreview';

// The tile's box, measured as it changes (a grid going from one column to two).
function useBox(ref: React.RefObject<HTMLElement | null>) {
  const [box, setBox] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    const measure = () => setBox({ w: node.clientWidth, h: node.clientHeight });
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(node);
    return () => ro.disconnect();
  }, [ref]);
  return box;
}

function Note({ children }: { children: ReactNode }) {
  return (
    <span className="absolute inset-0 flex items-center justify-center p-4">
      <span className="rounded-full bg-white/85 px-3 py-1 text-xs font-medium text-slate-600 shadow-sm ring-1 ring-slate-900/5 dark:bg-slate-900/85 dark:text-slate-300 dark:ring-white/10">
        {children}
      </span>
    </span>
  );
}

function Drawing({
  tab,
  tabs,
  box,
}: {
  tab: Tab;
  tabs: readonly Tab[];
  box: { w: number; h: number };
}) {
  const svg = useTabPreviewSvg(tab, tabs);
  if (!svg) return <Sweep />;
  const fit = previewFit({ w: svg.width, h: svg.height }, box, !isWindowed(tab));
  return (
    <span
      data-tab-preview-drawing=""
      // Fades in over the loading sweep once, as it first appears (plan-overview.md "Opening"), never again.
      className="absolute inset-0 animate-fade-in"
      style={{ backgroundColor: svg.background }}
    >
      <span
        className="absolute left-0 top-0 block origin-top-left [&>svg]:block"
        style={{
          width: svg.width,
          height: svg.height,
          transform: `translate(${fit.x}px, ${fit.y}px) scale(${fit.scale})`,
        }}
        dangerouslySetInnerHTML={{ __html: trustedHtml(svg.markup) }}
      />
    </span>
  );
}

function Sweep() {
  return (
    <span className="absolute inset-0 flex items-center justify-center">
      <LoadingSweep className="w-24" />
    </span>
  );
}

export const TabPreview = memo(function TabPreview({
  tab,
  tabs,
  state,
  failed,
}: {
  tab: Tab;
  // The plan's tabs, read by a Dashboard's slots alone (pass the same array while they are unchanged).
  tabs: readonly Tab[];
  state: TabTileState;
  // The tab's content could not be fetched.
  failed: boolean;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const near = useNearScreen(ref);
  const box = useBox(ref);
  const [started, setStarted] = useState(false);
  useEffect(() => {
    if (!near || started || state !== 'ready') return;
    return queuePreview(() => setStarted(true));
  }, [near, started, state]);
  // The tab's own paper behind everything, so a tile reads as that tab before and while it draws.
  const paint = useTabBackdropPaint(tab);
  let body: ReactNode;
  if (state === 'loading') body = failed ? <Note>Couldn&apos;t load preview</Note> : <Sweep />;
  else if (state === 'empty') body = <Note>Nothing on this tab yet</Note>;
  else if (!started || box.w <= 0) body = <Sweep />;
  // A Board or Sheet tab as its own view draws it; any other tab as its image export draws it.
  else if (fillingElementOf(tab))
    body = (
      <span data-tab-preview-live="" className="absolute inset-0 animate-fade-in">
        <LivePlanPreview tab={tab} box={box} />
      </span>
    );
  else body = <Drawing tab={tab} tabs={tabs} box={box} />;
  return (
    <span
      ref={ref}
      aria-hidden
      inert
      data-tab-preview={failed && state === 'loading' ? 'failed' : state}
      className="pointer-events-none relative block aspect-[16/10] w-full select-none overflow-hidden border-b border-slate-200 dark:border-slate-800"
      style={paint({ x: 0, y: 0 }, 0.25)}
    >
      <PreviewBoundary fallback={<Note>Couldn&apos;t load preview</Note>}>{body}</PreviewBoundary>
    </span>
  );
});
