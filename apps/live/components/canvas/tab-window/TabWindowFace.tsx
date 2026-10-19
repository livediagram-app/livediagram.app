'use client';

// A tab window on the canvas (docs/specs/009-elements/tab-window.md): another tab of the document drawn inside a
// rounded frame, live, zoomed to fit; or what it is waiting for (no tab chosen, the tab's content on its way or failed,
// nothing on it, the tab gone or not shared). Choose a Tab is an Editor's; Open <name> is everyone's who sees the tab.
import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import {
  TAB_WINDOW_EMPTY,
  TAB_WINDOW_HAIRLINE,
  TAB_WINDOW_RADIUS,
  tabHasDrawing,
  tabWindowMayShow,
  type CanvasSurface,
  type ShapeElement,
} from '@livediagram/document';
import { lucideArrowUpRight } from '@livediagram/icons/lucide';
import { lucideGlyph, Tooltip } from '@livediagram/ui';
import { useTabWindows } from './tab-window-context';

const OpenIcon = lucideGlyph(lucideArrowUpRight, 14);

const TabWindowPicker = dynamic(() => import('./TabWindowPicker').then((m) => m.TabWindowPicker), {
  ssr: false,
});

const TabWindowDrawing = dynamic(
  () => import('./TabWindowDrawing').then((m) => m.TabWindowDrawing),
  {
    ssr: false,
  },
);

/** What a window shows, from its tab and that tab's content (the spec's States table). */
type TabWindowState =
  | { kind: 'unchosen' }
  | { kind: 'unavailable' }
  | { kind: 'loading'; name: string }
  | { kind: 'failed'; name: string; tabId: string }
  | { kind: 'empty'; name: string }
  | { kind: 'drawing'; name: string; tabId: string };

export function tabWindowState(
  windowTabId: string | undefined,
  tab: (Parameters<typeof tabHasDrawing>[0] & { id: string; name: string }) | undefined,
  status: 'loaded' | 'loading' | 'failed',
): TabWindowState {
  if (!windowTabId) return { kind: 'unchosen' };
  if (!tab) return { kind: 'unavailable' };
  const name = tab.name || 'Untitled tab';
  if (status === 'failed') return { kind: 'failed', name, tabId: tab.id };
  if (status === 'loading') return { kind: 'loading', name };
  if (!tabHasDrawing(tab)) return { kind: 'empty', name };
  return { kind: 'drawing', name, tabId: tab.id };
}

export function TabWindowFace({
  element,
  surface,
  selected,
  canChoose,
}: {
  element: ShapeElement;
  surface: CanvasSurface;
  // Selected, its Open button stays shown; otherwise it shows while the window is hovered.
  selected: boolean;
  // False on a locked window or a read-only canvas: the tab stays as it is, whoever the person is.
  canChoose?: boolean;
}) {
  const ctx = useTabWindows();
  const choose = canChoose === false ? undefined : ctx?.choose;
  const tabId = element.windowTabId;
  // A tab the window may not show (its own) is unavailable, as the export draws it.
  const found = tabId ? ctx?.tabs.find((t) => t.id === tabId) : undefined;
  const tab = found && ctx && tabWindowMayShow(found, ctx.ownTabId) ? found : undefined;
  const state = ctx
    ? tabWindowState(tabId, tab, tabId ? ctx.status(tabId) : 'loaded')
    : { kind: 'unchosen' as const };
  // Ask for the tab's content as the window shows it (it arrives only when opened or fetched).
  const request = ctx?.request;
  useEffect(() => {
    if (tab && request) request(tab.id);
  }, [tab, request]);
  // The Choose a Tab button the list opens under, while it is open.
  const [pickAnchor, setPickAnchor] = useState<HTMLElement | null>(null);
  const empty = TAB_WINDOW_EMPTY[surface];
  // Words and buttons grow with the window (they are canvas units, zoomed with the canvas), from their size on a
  // 220-unit window up to 2.4 times that, so a window placed at its 640 x 360 reads at a slide's usual zoom.
  const scale = Math.max(1, Math.min(2.4, element.height / 220));
  const px = (n: number) => Math.round(n * scale);
  const radius = Math.min(TAB_WINDOW_RADIUS, element.width / 2, element.height / 2);
  // A press on a control is its own, never the canvas's (no drag, no marquee, no deselect).
  const own = {
    onPointerDown: (e: React.PointerEvent) => e.stopPropagation(),
    onDoubleClick: (e: React.MouseEvent) => e.stopPropagation(),
  };

  const message = (title: string, action?: React.ReactNode) => (
    <div
      className="absolute inset-0 flex flex-col items-center justify-center px-4 text-center"
      style={{ background: empty.fill, color: empty.ink, gap: px(8) }}
    >
      <p className="font-semibold" style={{ fontSize: px(14), lineHeight: 1.3 }}>
        {title}
      </p>
      {action}
    </div>
  );
  const chooseAction = choose ? (
    <button
      type="button"
      {...own}
      data-tab-window-choose=""
      onClick={(e) => setPickAnchor(e.currentTarget)}
      className="pointer-events-auto rounded-md bg-brand-700 font-semibold text-white transition hover:bg-brand-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700"
      style={{ fontSize: px(12), padding: `${px(6)}px ${px(12)}px` }}
    >
      Choose a Tab
    </button>
  ) : null;

  return (
    <div
      data-tab-window={state.kind}
      className="group absolute inset-0 overflow-hidden"
      style={{ borderRadius: radius }}
    >
      {state.kind === 'drawing' && tab ? (
        // The tab it shows keeps that tab's own finish (docs/specs/008-canvas/finish.md): never sketched again here.
        <div data-sketch-skip="" className="absolute inset-0">
          <TabWindowDrawing tab={tab} elementId={element.id} />
        </div>
      ) : state.kind === 'unchosen' ? (
        message(choose ? 'Show a tab here' : 'No tab chosen', chooseAction)
      ) : state.kind === 'unavailable' ? (
        message("This tab isn't available.", chooseAction)
      ) : state.kind === 'loading' ? (
        message(`Loading ${state.name}…`)
      ) : state.kind === 'failed' ? (
        message(
          `Couldn't load ${state.name}.`,
          <button
            type="button"
            {...own}
            onClick={() => ctx?.retry(state.tabId)}
            className="pointer-events-auto rounded-md border border-current font-semibold"
            style={{ fontSize: px(12), padding: `${px(4)}px ${px(12)}px` }}
          >
            Retry
          </button>,
        )
      ) : (
        message(`Nothing on ${state.name} yet.`)
      )}
      {/* The frame's edge over the drawing, as on export. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          borderRadius: radius,
          boxShadow: `inset 0 0 0 1px ${element.strokeColor ?? TAB_WINDOW_HAIRLINE}`,
        }}
      />
      {ctx && tab ? (
        <Tooltip label={`Open ${tab.name || 'Untitled tab'}`}>
          <button
            type="button"
            aria-label={`Open ${tab.name || 'Untitled tab'}`}
            data-tab-window-open=""
            // A floating control, not part of the drawing: drawn as it is under Sketch.
            data-sketch-skip=""
            style={{
              right: px(8),
              top: px(8),
              height: px(28),
              gap: px(4),
              padding: `0 ${px(8)}px`,
              fontSize: px(12),
            }}
            {...own}
            onClick={() => ctx.open(tab.id)}
            className={`pointer-events-auto absolute flex items-center rounded-md bg-white/90 font-semibold text-slate-700 shadow-sm ring-1 ring-slate-900/10 transition hover:bg-white focus-visible:opacity-100 dark:bg-slate-900/90 dark:text-slate-100 dark:ring-white/15 ${
              selected
                ? 'opacity-100'
                : // Unseen until hovered, so untouchable until then: a tap that selects the window never opens the tab.
                  'pointer-events-none opacity-0 group-hover:pointer-events-auto group-hover:opacity-100'
            }`}
          >
            Open
            <OpenIcon />
          </button>
        </Tooltip>
      ) : null}
      {pickAnchor && ctx && choose ? (
        <TabWindowPicker
          anchor={pickAnchor}
          tabs={ctx.tabs}
          ownTabId={ctx.ownTabId}
          shown={tabId}
          onPick={(id) => {
            choose(element.id, id);
            setPickAnchor(null);
          }}
          onClose={() => setPickAnchor(null)}
        />
      ) : null}
    </div>
  );
}
