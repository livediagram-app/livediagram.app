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
  type CanvasSurface,
  type ShapeElement,
} from '@livediagram/document';
import { lucideArrowUpRight } from '@livediagram/icons/lucide';
import { lucideGlyph, Tooltip } from '@livediagram/ui';
import { PortalMenu } from '@/components/primitives/PortalMenu';
import { useTabWindows } from './tab-window-context';
import { TabWindowTabList } from './TabWindowTabList';

const OpenIcon = lucideGlyph(lucideArrowUpRight, 14);

const TabWindowDrawing = dynamic(
  () => import('./TabWindowDrawing').then((m) => m.TabWindowDrawing),
  {
    ssr: false,
  },
);

/** What a window shows, from its tab and that tab's content (the spec's States table). */
export type TabWindowState =
  | { kind: 'unchosen' }
  | { kind: 'unavailable' }
  | { kind: 'loading'; name: string }
  | { kind: 'failed'; name: string; tabId: string }
  | { kind: 'empty'; name: string }
  | { kind: 'drawing'; name: string; tabId: string };

export function tabWindowState(
  windowTabId: string | undefined,
  tab: { id: string; name: string; elements: readonly unknown[] } | undefined,
  status: 'loaded' | 'loading' | 'failed',
): TabWindowState {
  if (!windowTabId) return { kind: 'unchosen' };
  if (!tab) return { kind: 'unavailable' };
  const name = tab.name || 'Untitled tab';
  if (status === 'failed') return { kind: 'failed', name, tabId: tab.id };
  if (status === 'loading') return { kind: 'loading', name };
  if (tab.elements.length === 0) return { kind: 'empty', name };
  return { kind: 'drawing', name, tabId: tab.id };
}

export function TabWindowFace({
  element,
  surface,
  selected,
}: {
  element: ShapeElement;
  surface: CanvasSurface;
  // Selected, its Open button stays shown; otherwise it shows while the window is hovered.
  selected: boolean;
}) {
  const ctx = useTabWindows();
  const tabId = element.windowTabId;
  const tab = tabId ? ctx?.tabs.find((t) => t.id === tabId) : undefined;
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
  const radius = Math.min(TAB_WINDOW_RADIUS, element.width / 2, element.height / 2);
  // A press on a control is its own, never the canvas's (no drag, no marquee, no deselect).
  const own = {
    onPointerDown: (e: React.PointerEvent) => e.stopPropagation(),
    onDoubleClick: (e: React.MouseEvent) => e.stopPropagation(),
  };

  const message = (title: string, action?: React.ReactNode) => (
    <div
      className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-4 text-center"
      style={{ background: empty.fill, color: empty.ink }}
    >
      <p className="text-sm font-semibold">{title}</p>
      {action}
    </div>
  );
  const chooseAction = ctx?.choose ? (
    <button
      type="button"
      {...own}
      onClick={(e) => setPickAnchor(e.currentTarget)}
      className="pointer-events-auto rounded-md bg-brand-700 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-brand-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700"
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
        <TabWindowDrawing tab={tab} elementId={element.id} />
      ) : state.kind === 'unchosen' ? (
        message(ctx?.choose ? 'Show a tab here' : 'No tab chosen', chooseAction)
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
            className="pointer-events-auto rounded-md border border-current px-3 py-1 text-xs font-semibold"
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
            {...own}
            onClick={() => ctx.open(tab.id)}
            className={`pointer-events-auto absolute right-2 top-2 flex h-7 items-center gap-1 rounded-md bg-white/90 px-2 text-xs font-semibold text-slate-700 shadow-sm ring-1 ring-slate-900/10 transition hover:bg-white focus-visible:opacity-100 dark:bg-slate-900/90 dark:text-slate-100 dark:ring-white/15 ${
              selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
            }`}
          >
            Open
            <OpenIcon />
          </button>
        </Tooltip>
      ) : null}
      {pickAnchor && ctx?.choose ? (
        <PortalMenu
          anchor={pickAnchor}
          placement="below"
          onClose={() => setPickAnchor(null)}
          initialFocus="first"
        >
          <TabWindowTabList
            tabs={ctx.tabs}
            ownTabId={ctx.ownTabId}
            shown={tabId}
            onPick={(id) => {
              ctx.choose?.(element.id, id);
              setPickAnchor(null);
            }}
          />
        </PortalMenu>
      ) : null}
    </div>
  );
}
