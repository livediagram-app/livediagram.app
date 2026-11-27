// A page's layout edits (docs/specs/007-editor/pages-mode.md "Layouts", "Hover previews the layout on the page,
// exactly as it lands"; Work Tracker 1502): placing a layout, and previewing a hovered one, through the one path
// (page-layout-place.ts). A press on the layout a hover shows commits the very elements shown, at once: nothing in
// between (an await, the popover closing and putting the preview back) can swap them for a fresh build.
import type { PageLayoutId } from '@livedocuments/templates';
import type { Tab } from '@livedocuments/document';
import { debugLog } from '@liveworkspace/workbench/lib/debug-log';
import { track } from '@/lib/telemetry';
import { createPreviewSettle, type LayoutPreviewAsk } from './layout-preview-settle';
import {
  layoutPlacedTab,
  showLayout,
  shownLayoutElements,
  shownLayoutFor,
  type LayoutBuild,
} from './page-layout-place';

// The layout builders, loaded once on first use (a hover's preview or a press): every page layout set, kept out of
// the editor's first load. `loaded` holds them once in, so a press after a hover runs without waiting.
let builder: Promise<LayoutBuild> | null = null;
let loaded: LayoutBuild | null = null;
const layoutBuilder = (): Promise<LayoutBuild> =>
  (builder ??= import('@livedocuments/templates/page-layout-build').then((m) => {
    loaded = m.buildPageLayoutOver;
    return loaded;
  }));

// One settle for every page's gallery: a hover anywhere replaces one still waiting anywhere.
const settle = createPreviewSettle();
// The newest preview asked for: a build answered after a newer ask draws nothing.
let latest = 0;

export function pageLayoutEdits({
  tabId,
  tab,
  elements,
  commitTab,
  isLocked,
  refusedLocked,
  onLayoutPlaced,
}: {
  tabId: string;
  // The tab and its elements now: what a hover places the layout on, and the board it is shown over.
  tab: Tab;
  elements: Tab['elements'];
  commitTab: (change: (t: Tab) => Tab | null) => void;
  isLocked: (pageId: string) => boolean;
  // Says why a locked page refuses the edit; true when it does.
  refusedLocked: (pageId: string, edit: string) => boolean;
  onLayoutPlaced: () => void;
}) {
  const place = (pageId: string, layoutId: PageLayoutId, build: LayoutBuild | null) => {
    track('Tab', 'Changed', 'PageLayout');
    // What the hover showed, read now, before anything can put the preview back.
    const seen = shownLayoutFor(tabId, pageId, layoutId, elements);
    commitTab((t) =>
      seen && t.elements === elements
        ? { ...t, elements: seen }
        : build
          ? layoutPlacedTab(t, pageId, layoutId, build)
          : null,
    );
    showLayout(null);
    onLayoutPlaced();
    debugLog('[page] layout placed', { tabId, pageId, layout: layoutId, shown: !!seen });
  };
  // Laid out in the page's content box with the page's own words and pictures carried in ("Content carries over"),
  // one tab edit. At once when the builders are in (always after a hover); else once they load.
  const applyLayout = async (pageId: string, layoutId: PageLayoutId): Promise<void> => {
    settle.cancel();
    latest++;
    if (refusedLocked(pageId, 'layout')) return;
    if (loaded) {
      place(pageId, layoutId, loaded);
      return;
    }
    place(pageId, layoutId, await layoutBuilder());
  };
  // A layout tile hovered or focused: the page drawn with it placed, by the canvas itself, writing nothing; null
  // puts the page back. Drawn once the pointer settles (layout-preview-settle.ts), so a sweep draws only its last tile.
  const previewLayout = (
    pageId: string,
    layoutId: PageLayoutId | null,
    how: LayoutPreviewAsk = 'focus',
  ) => {
    const ask = ++latest;
    if (!layoutId || isLocked(pageId)) {
      // Put back on the next frame, so focus moving from tile to tile (a blur, then a focus) never flashes the page.
      settle.ask('focus', () => {
        if (ask === latest && shownLayoutElements(tabId)) showLayout(null);
      });
      return;
    }
    settle.ask(how, () => {
      void layoutBuilder().then((build) => {
        if (ask !== latest) return;
        const placed = layoutPlacedTab(tab, pageId, layoutId, build);
        if (!placed) return;
        showLayout({ tabId, pageId, layout: layoutId, over: elements, elements: placed.elements });
      });
    });
  };
  return { applyLayout, previewLayout };
}
