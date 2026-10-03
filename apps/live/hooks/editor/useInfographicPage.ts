// Infographic mode's pages (docs/specs/007-editor/infographic-pages.md): the active tab's pages
// laid out in their row, the edits to them (infographic-page-edits) and framing one in the view. It
// also centres the view on the first page whenever the mode or the tab changes.
import { useEffect, useEffectEvent, useMemo, useState, type RefObject } from 'react';
import {
  hasPageLook,
  infographicPageFitBox,
  infographicPagesOf,
  layOutInfographicPages,
  withContentPaginated,
  type EditorMode,
  type LaidOutPage,
  type Tab,
} from '@livediagram/document';
import { computeFitBelow } from '@/lib/viewport';
import { debugLog } from '@/lib/debug-log';
import { track } from '@/lib/telemetry';
import { getTheme } from '@/lib/themes';
import { themeBackgroundPresets, type ThemeBackgroundPreset } from '@/lib/infographic-page-paint';
import { infographicPageEdits, type InfographicPageEdits } from './infographic-page-edits';
import type { PageLayoutId } from '@livediagram/templates';

export type { InfographicPageEdits };

export type InfographicPagesView = {
  pages: LaidOutPage[];
  // Frames one page in the view (its label's press).
  focusPage: (pageId: string) => void;
  // Backgrounds drawn from the tab's theme, offered first in the page panel.
  themeBackgrounds: ThemeBackgroundPreset[];
  // The tab's default face, for what the pages draw themselves (a layout preview).
  tabFont?: string;
  // A layout previewed on a page while its tile is hovered: the page's own content is hidden
  // under it (the clip leaves the page out) so the preview never mixes with it.
  layoutPreview: { pageId: string; layout: PageLayoutId } | null;
  setLayoutPreview: (preview: { pageId: string; layout: PageLayoutId } | null) => void;
  // Absent where the viewer may not change the pages (a view role, a locked tab).
  edit?: InfographicPageEdits;
};

// The Toolbar layout's strip lies over the canvas's top edge; the page centres below it.
const TOP_STRIP_SELECTOR = '[data-toolbar-palette]:not(.hidden)';

/** How far a top strip laid over the canvas reaches down into it, in screen px. */
function topStripInset(canvas: HTMLElement): number {
  const strip = document.querySelector<HTMLElement>(TOP_STRIP_SELECTOR);
  if (!strip) return 0;
  const c = canvas.getBoundingClientRect();
  const s = strip.getBoundingClientRect();
  const overlaps = s.bottom > c.top && s.top < c.top + c.height / 2;
  return overlaps ? s.bottom - c.top : 0;
}

export function useInfographicPage(deps: {
  activeTab: Tab;
  mode: EditorMode;
  canEdit: boolean;
  tabLoaded: boolean;
  commitTabs: (map: (ts: Tab[]) => Tab[]) => void;
  canvasMainRef: RefObject<HTMLElement | null>;
  setViewportZoom: (zoom: number) => void;
  setViewportOffset: (offset: { x: number; y: number }) => void;
  clearSelection: () => void;
  toastInfo: (message: string) => void;
}): InfographicPagesView | null {
  const { activeTab, mode, canEdit, tabLoaded, commitTabs } = deps;
  const on = hasPageLook(mode);
  const tabId = activeTab.id;

  // Frames a page (the first by default) below a top strip. The fit box holds either orientation,
  // so turning a page needs no refit.
  const frame = (page?: LaidOutPage) => {
    const canvas = deps.canvasMainRef.current;
    if (!canvas) return;
    const inset = topStripInset(canvas);
    const { zoom, offset } = computeFitBelow(
      { width: canvas.offsetWidth, height: canvas.offsetHeight },
      infographicPageFitBox(page),
      inset,
    );
    deps.setViewportZoom(zoom);
    deps.setViewportOffset(offset);
    debugLog('[infographic-page] framed', { tabId, page: page?.id ?? 'first', inset, zoom });
  };
  // Centred on the first page after the tab's own first fit (a frame later), so the page wins.
  const centre = useEffectEvent(() =>
    frame(layOutInfographicPages(infographicPagesOf(activeTab))[0]),
  );
  // Entering the mode with content off the first page and no pages yet lays the content out into
  // pages (withContentPaginated, docs/specs/007-editor/infographic-pages.md "Into pages"): one
  // edit, so one undo puts it back, said in a toast. Then the view frames the first page.
  const paginate = useEffectEvent(() => {
    if (!canEdit || activeTab.locked === true) return;
    const laid = withContentPaginated(activeTab);
    if (!laid) return;
    commitTabs((ts) => ts.map((t) => (t.id === tabId ? (withContentPaginated(t) ?? t) : t)));
    const n = laid.pages.length;
    deps.toastInfo(
      n === 1
        ? 'Laid out onto a page. Undo puts it back.'
        : `Laid out into ${n} pages. Undo puts it back.`,
    );
    track('Tab', 'Changed', 'PagesLaidOut');
    debugLog('[infographic-page] content laid out into pages', { tabId, pages: n });
  });
  useEffect(() => {
    if (!on || !tabLoaded) return;
    const raf = requestAnimationFrame(() => centre());
    return () => cancelAnimationFrame(raf);
  }, [on, tabLoaded, tabId]);
  // Its own effect so an editor role that resolves after the tab has loaded still lays out.
  useEffect(() => {
    if (on && tabLoaded && canEdit) paginate();
  }, [on, tabLoaded, tabId, canEdit]);

  // The pages laid out once per change to the stored pages, so everything drawn from them (the
  // Map's picture, the export preview) keeps its memo while the view pans and zooms.
  const storedPages = activeTab.pages;
  const legacyOrientation = activeTab.pageOrientation;
  const current = useMemo(
    () => infographicPagesOf({ pages: storedPages, pageOrientation: legacyOrientation }),
    [storedPages, legacyOrientation],
  );
  const pages = useMemo(() => layOutInfographicPages(current), [current]);

  const [layoutPreview, setLayoutPreview] = useState<InfographicPagesView['layoutPreview']>(null);
  // A page just added or duplicated: framed once it lands in the row (a frame later, as its
  // sheet mounts).
  const [goTo, setGoTo] = useState<string | null>(null);
  const goToLanded = useEffectEvent(() => {
    const page = layOutInfographicPages(infographicPagesOf(activeTab)).find((p) => p.id === goTo);
    if (!page) return;
    setGoTo(null);
    frame(page);
  });
  const landed = goTo !== null && infographicPagesOf(activeTab).some((p) => p.id === goTo);
  useEffect(() => {
    if (!landed) return;
    const raf = requestAnimationFrame(() => goToLanded());
    return () => cancelAnimationFrame(raf);
  }, [landed]);

  if (!on) return null;
  const focusPage = (pageId: string) => frame(pages.find((p) => p.id === pageId));
  const themeBackgrounds = themeBackgroundPresets(getTheme(activeTab.theme));
  const tabFont = activeTab.font;
  const shared = { pages, focusPage, themeBackgrounds, tabFont, layoutPreview, setLayoutPreview };
  if (!canEdit || activeTab.locked === true) return shared;
  return {
    ...shared,
    edit: infographicPageEdits({
      tabId,
      current,
      elements: activeTab.elements,
      commitTabs,
      onCreated: setGoTo,
      onLayoutPlaced: deps.clearSelection,
    }),
  };
}
