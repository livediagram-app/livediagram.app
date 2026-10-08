'use client';

import dynamic from 'next/dynamic';
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';
import { useEditorContext } from '@/app/document/[id]/EditorContext';
import { useSelectTab } from '@/app/document/[id]/useSelectTab';
import { useIsMobileViewport } from '@/hooks/ui/useIsMobileViewport';
import { useSplitView } from '@/hooks/ui/useSplitView';
import { useViewportWidth } from '@/hooks/ui/useViewportWidth';
import {
  anchorFromEditorView,
  editorViewFromAnchor,
  type CanvasAnchor,
} from '@/lib/split-pane-view';
import { EDITOR_VIEWPORT_ATTR } from '@/lib/editor-viewport';
import { setLocalBesideTab } from '@/lib/split-presence';
import { SplitDivider } from './SplitDivider';
import { SplitSeamControls } from './SplitSeamControls';
import { SplitDropZone } from './SplitDropZone';
import { SplitViewContext } from './SplitViewContext';
import type { TabSvgViewportHandle } from './TabSvgViewport';

// The other pane loads with the first split: the SVG renderer and icon catalogues it draws with
// stay out of the editor's first load.
const SplitStaticPane = dynamic(() => import('./SplitStaticPane').then((m) => m.SplitStaticPane), {
  ssr: false,
});

// Side by side tabs (docs/specs/007-editor/split-view.md): two tabs of the document on screen, each
// keeping its side, with one site header across the top and one tab bar across the bottom. The
// editor (canvas, toolbars, panels) sits in the pane of the active tab; the other pane draws its tab
// live. Clicking into the other pane, or resting the pointer there, moves the editor across, and
// neither drawing moves. With no split this is a plain full-size box and changes nothing.
//
// With a split, the editor's box becomes a containing block (`transform`) so every `fixed` piece of
// its chrome lays out inside its pane. Its menus and dialogs render to the page body, in client
// coordinates, so they land where they always do; pointer maths reads the canvas's own rect.
export function SplitViewFrame({
  header,
  footer,
  children,
}: {
  // The site header and the tab bar under everything: inside the editor's column with no split,
  // across both panes with one.
  header: ReactNode;
  footer: ReactNode;
  // The editor's column, given what to put where the header and the footer go (themselves, or
  // spacers of their height), and whether a split is showing (chrome that stands down for one).
  children: (
    headerInColumn: ReactNode,
    footerInColumn: ReactNode,
    splitShowing: boolean,
  ) => ReactNode;
}) {
  const ctx = useEditorContext();
  const {
    tabs,
    activeId,
    documentId,
    hydrated,
    loadedTabIds,
    loadAllTabs,
    zenMode,
    embedMode,
    appChrome,
    slideDeck,
    viewport,
    canvasMainRef,
    skipTabFitRef,
    fitToScreen,
    activeTab,
  } = ctx;
  const selectTab = useSelectTab();
  const isMobile = useIsMobileViewport();
  const viewportWidth = useViewportWidth();
  const split = useSplitView({
    tabs,
    activeId,
    selectTab,
    documentId,
    hydrated,
    loadedTabIds,
    loadTabs: loadAllTabs,
    // Embeds and the workbench frame (no app chrome) keep one tab, like a phone.
    suspended: isMobile || zenMode || embedMode || !appChrome || slideDeck.presentingAt !== null,
  });
  const { pair, editorSide } = split;
  const staticId = pair ? (editorSide === 'left' ? pair.rightId : pair.leftId) : null;
  const staticTab = staticId ? tabs.find((t) => t.id === staticId) : undefined;
  const showing = !!staticTab;

  // The geometry: the right pane's width is the person's; the left pane takes the rest.
  const leftWidth = viewportWidth - split.rightWidth;
  const editorBox = !showing
    ? { left: 0, width: viewportWidth }
    : editorSide === 'left'
      ? { left: 0, width: leftWidth }
      : { left: leftWidth, width: split.rightWidth };
  const staticBox =
    editorSide === 'left'
      ? { left: leftWidth, width: split.rightWidth }
      : { left: 0, width: leftWidth };

  // The header's and the footer's heights, for the spacers that keep the editor's column laid out
  // as before. Seeded with their usual sizes (3.5rem, the 48px tab bar) so the first frame of a
  // split is already laid out.
  const headerRef = useRef<HTMLDivElement | null>(null);
  const footerRef = useRef<HTMLDivElement | null>(null);
  const headerHeight = useObservedHeight(headerRef, showing, 56);
  const footerHeight = useObservedHeight(footerRef, showing && footer !== null, 48);

  // The pane slides in once, when the split opens; moving the editor between panes is instant.
  const [arrived, setArrived] = useState(false);
  const [wasShowing, setWasShowing] = useState(showing);
  const [leaving, setLeaving] = useState(false);
  // Handing the view over as the editor moves, so neither drawing moves on screen.
  const staticHandle = useRef<TabSvgViewportHandle | null>(null);
  const [handoff, setHandoff] = useState<{ tabId: string; anchor: CanvasAnchor } | null>(null);
  if (wasShowing !== showing) {
    setWasShowing(showing);
    setArrived(false);
    // A pane hidden mid leave-animation (zen, a narrow window, a deleted tab) never ends it: the next split must
    // not arrive leaving. Nor may it start from the view an earlier split handed over (it opens fitted).
    if (!showing) {
      setLeaving(false);
      setHandoff(null);
    }
  }
  // The seam's Fit Both Sides, for the pane without the editor (the editor fits itself).
  const [fitNonce, setFitNonce] = useState(0);

  const focusPane = (via: 'Click' | 'Hover') => {
    if (!staticId) return;
    const main = canvasMainRef.current?.getBoundingClientRect();
    if (main) {
      // The view the editor leaves on its tab becomes that pane's view.
      setHandoff({ tabId: activeId, anchor: anchorFromEditorView(viewport.get(), main) });
      // And the pane's view becomes the editor's, measured where the canvas will be once the
      // editor's box has moved: same height and top, the other pane's span.
      const paneAnchor = staticHandle.current?.anchor();
      if (paneAnchor) {
        const next = editorViewFromAnchor(paneAnchor, {
          left: main.left - editorBox.left + staticBox.left,
          top: main.top,
          width: main.width - editorBox.width + staticBox.width,
          height: main.height,
        });
        skipTabFitRef.current = staticId;
        viewport.setView(next);
      }
    }
    split.focus(staticId, via);
  };

  // The editor keeps what it was centred on as its pane opens, closes or is resized: half the
  // change in its width is added to the pan. Only the split's own changes: a window resize keeps
  // the editor's usual behaviour, and a move to another tab hands its view over (focusPane) or lets
  // that tab's own view take over.
  const lastLayout = useRef({ width: editorBox.width, viewportWidth, activeId });
  useLayoutEffect(() => {
    const last = lastLayout.current;
    lastLayout.current = { width: editorBox.width, viewportWidth, activeId };
    if (last.width === editorBox.width || last.viewportWidth !== viewportWidth) return;
    if (last.activeId !== activeId) return;
    const dx = (editorBox.width - last.width) / 2;
    viewport.setOffset((o) => ({ x: o.x + dx, y: o.y }));
  }, [editorBox.width, viewportWidth, activeId, viewport]);

  // The chrome slides in from the side it left when the editor changes panes (split-view.css). Set
  // for the move, then cleared, so a panel opened later doesn't slide in too. Safe to lift: the
  // animated roots have no entrance animation of their own to replay, and the keyframes hold no end
  // state to snap back from.
  const [arrival, setArrival] = useState<{ side: 'left' | 'right' | null; from: string | null }>({
    side: editorSide,
    from: null,
  });
  if (arrival.side !== editorSide) {
    const moved = arrival.side !== null && editorSide !== null;
    setArrival({
      side: editorSide,
      from: moved ? (editorSide === 'right' ? 'from-left' : 'from-right') : null,
    });
  }
  useEffect(() => {
    if (!arrival.from) return;
    const timer = window.setTimeout(() => setArrival((a) => ({ ...a, from: null })), 400);
    return () => window.clearTimeout(timer);
  }, [arrival]);

  // Collaborators see us on the tab beside the one we edit (docs/specs/007-editor/split-view.md
  // "Presence"): the presence broadcast carries it.
  const besideTabId = showing ? staticId : null;
  useEffect(() => {
    setLocalBesideTab(besideTabId);
    return () => setLocalBesideTab(null);
  }, [besideTabId]);

  // Chrome that sizes itself from the window (floating panels, clamped popovers) re-reads on
  // resize; the editor's box just changed without the window doing so.
  useEffect(() => {
    window.dispatchEvent(new Event('resize'));
  }, [showing, editorSide]);

  const headerInColumn = showing ? (
    <div aria-hidden className="shrink-0" style={{ height: headerHeight }} />
  ) : (
    header
  );
  const footerInColumn =
    showing && footer !== null ? (
      <div aria-hidden className="shrink-0" style={{ height: footerHeight }} />
    ) : (
      footer
    );
  // The panes stop above the footer, which spans them.
  const paneBottom = showing && footer !== null ? footerHeight : 0;

  return (
    <SplitViewContext.Provider value={split}>
      <div className="relative h-dvh w-full overflow-hidden">
        {showing ? (
          // One header across both panes, above the editor's box.
          <div ref={headerRef} className="absolute inset-x-0 top-0 z-[3]">
            {header}
          </div>
        ) : null}
        <div
          // The box the editor's chrome sizes itself to (lib/editor-viewport): its pane, in a split.
          {...{ [EDITOR_VIEWPORT_ATTR]: showing ? 'pane' : 'window' }}
          data-split-arrive={arrival.from ?? undefined}
          className="absolute inset-y-0 z-[1] h-dvh"
          style={{
            left: editorBox.left,
            width: editorBox.width,
            // `clip`, so nothing of the editor's own bleeds over the other pane.
            ...(showing ? { transform: 'translateZ(0)', overflow: 'clip' } : null),
          }}
        >
          {children(headerInColumn, footerInColumn, showing)}
        </div>
        {staticTab ? (
          <div
            className={`absolute z-0 ${
              leaving ? 'split-pane-leave' : arrived ? '' : 'split-pane-enter'
            }`}
            style={{
              top: headerHeight,
              bottom: paneBottom,
              left: staticBox.left,
              width: staticBox.width,
            }}
            onAnimationEnd={(e) => {
              if (e.target !== e.currentTarget) return;
              if (leaving) {
                setLeaving(false);
                split.close();
              } else setArrived(true);
            }}
          >
            <SplitStaticPane
              key={staticTab.id}
              tab={staticTab}
              loaded={loadedTabIds.has(staticTab.id)}
              failed={split.staticLoadFailed}
              initialAnchor={handoff?.tabId === staticTab.id ? handoff.anchor : null}
              handleRef={staticHandle}
              fitNonce={fitNonce}
              onFocus={focusPane}
            />
          </div>
        ) : null}
        {showing ? (
          <div
            className="absolute z-[2]"
            style={{ top: headerHeight, bottom: paneBottom, left: leftWidth }}
          >
            <SplitDivider
              rightWidth={split.rightWidth}
              viewportWidth={viewportWidth}
              onResize={split.resize}
              onReset={split.resetWidth}
            />
            <SplitSeamControls
              canFit={
                (!!staticTab && staticTab.elements.length > 0) || activeTab.elements.length > 0
              }
              // Both sides at once: the editor's canvas and the other pane.
              onFit={() => {
                fitToScreen();
                setFitNonce((n) => n + 1);
              }}
              onClose={() => setLeaving(true)}
            />
          </div>
        ) : null}
        {showing && footer !== null ? (
          // The tab bar across both panes, under the editor's box like the header is over it.
          <div ref={footerRef} className="absolute inset-x-0 bottom-0 z-[3]">
            {footer}
          </div>
        ) : null}
      </div>
      <SplitDropZone split={split} tabs={tabs} loadedTabIds={loadedTabIds} />
    </SplitViewContext.Provider>
  );
}

// An element's height, kept current while `active` (and `fallback` until it is first measured).
function useObservedHeight(
  ref: RefObject<HTMLElement | null>,
  active: boolean,
  fallback: number,
): number {
  const [height, setHeight] = useState(fallback);
  useLayoutEffect(() => {
    const node = ref.current;
    if (!active || !node) return;
    const measure = () => setHeight(node.offsetHeight);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [ref, active]);
  return height;
}
