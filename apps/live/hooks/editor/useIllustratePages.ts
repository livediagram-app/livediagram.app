// Illustrate mode's pages (docs/specs/007-editor/illustrate-pages.md): the active tab's pages
// laid out in their row, the edits to them (illustrate-page-edits) and framing one in the view. It
// also centres the view on the first page whenever the mode or the tab changes.
import {
  useCallback,
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from 'react';
import {
  articleMarginPx,
  articlesOf,
  hasPageLook,
  illustratePageFitBox,
  illustratePagesOf,
  layOutIllustratePages,
  withContentPaginated,
  type EditorMode,
  type LaidOutPage,
  type Tab,
} from '@livediagram/document';
import { computeFitBelow, computeReadingFrame } from '@/lib/viewport';
import { topStripInset } from '@/lib/top-strip-inset';
import { debugLog } from '@/lib/debug-log';
import { track } from '@/lib/telemetry';
import { getTheme } from '@/lib/themes';
import {
  themeAccent,
  themeBackgroundPresets,
  type ThemeBackgroundPreset,
} from '@/lib/illustrate-page-paint';
import type { ArticlesView } from './useArticles';
import { illustratePageEdits, type IllustratePageEdits } from './illustrate-page-edits';
import type { PageLayoutId } from '@livediagram/templates';
import { glideViewport, type ViewPose } from '@/lib/viewport-glide';

export type { IllustratePageEdits };

export type IllustratePagesView = {
  pages: LaidOutPage[];
  // The whole row, when `pages` shows only some of it (a page slide presenting): a document's
  // writing is laid out across all of its pages whichever of them are shown.
  rowPages?: LaidOutPage[];
  // Frames one page in the view (its label's press).
  focusPage: (pageId: string) => void;
  // An article page framed for writing on a phone: its text column across the screen.
  readPage: (pageId: string) => void;
  // A finger's pan over an article page begun from the view now: moves it by a screen-px drag.
  // Absent where nothing pans the view from a page (presenting).
  panFrom?: () => (dx: number, dy: number) => void;
  // Backgrounds drawn from the tab's theme, offered first in the page panel.
  themeBackgrounds: ThemeBackgroundPreset[];
  // The tab theme's accent: a document's accent unless it picked one of its own.
  themeAccent: string;
  // The articles' writing on the pages (useArticles), composed in by the editor.
  articles?: ArticlesView | null;
  // The tab's default face, for what the pages draw themselves (a layout preview).
  tabFont?: string;
  // A layout previewed on a page while its tile is hovered: the page's own content is hidden
  // under it (the clip leaves the page out) so the preview never mixes with it.
  layoutPreview: { pageId: string; layout: PageLayoutId } | null;
  setLayoutPreview: (preview: { pageId: string; layout: PageLayoutId } | null) => void;
  // Absent where the viewer may not change the pages (a view role, a locked tab).
  edit?: IllustratePageEdits;
  // A slide page's place in the slide deck (PageDeckButton), composed in by the editor; absent
  // where the deck cannot be changed.
  deck?: PageDeckControls;
  // A page slide presenting: the surround is blacked out round the sheet, as a projector shows it.
  letterbox?: boolean;
};

export type PageDeckControls = {
  // The deck's slide of this page (on this tab), if it has one.
  slideOf: (pageId: string) => { id: string; hidden: boolean } | undefined;
  add: (pageId: string) => void;
  toggleHidden: (slideId: string) => void;
};

export function useIllustratePages(deps: {
  activeTab: Tab;
  mode: EditorMode;
  canEdit: boolean;
  tabLoaded: boolean;
  commitTabs: (map: (ts: Tab[]) => Tab[]) => void;
  canvasMainRef: RefObject<HTMLElement | null>;
  setViewportZoom: (zoom: number) => void;
  setViewportOffset: (offset: { x: number; y: number }) => void;
  // The view now, for a page framed with a glide from wherever the view is.
  getViewport: () => ViewPose;
  clearSelection: () => void;
  toastInfo: (message: string) => void;
  // A new document by its flow id, so its writing can take the caret.
  onArticleCreated?: (flow: string) => void;
}): IllustratePagesView | null {
  const { activeTab, mode, canEdit, tabLoaded, commitTabs } = deps;
  const on = hasPageLook(mode);
  const tabId = activeTab.id;

  // Frames a page (the first by default) below a top strip, seen whole, whatever its kind. The fit
  // box holds either orientation, so turning a page needs no refit. `read` frames an article page
  // to be written on a phone instead: its text column across the screen.
  // A page framed on request (its navigator, its label, a page just added, an article page taking
  // the caret on a phone) glides there; the frame on entering the mode lands at once. A glide under
  // way gives way to the next, or to a finger's pan.
  const glide = useRef<(() => void) | null>(null);
  useEffect(() => () => glide.current?.(), []);
  const frame = (page?: LaidOutPage, read = false, glides = false) => {
    const canvas = deps.canvasMainRef.current;
    if (!canvas) return;
    const inset = topStripInset(canvas);
    const size = { width: canvas.offsetWidth, height: canvas.offsetHeight };
    const doc = page?.flow ? articlesOf(activeTab)[page.flow] : undefined;
    const { zoom, offset } =
      read && page && doc
        ? computeReadingFrame(size, page.rect, inset, articleMarginPx(doc.style))
        : computeFitBelow(size, illustratePageFitBox(page), inset);
    glide.current?.();
    glide.current = null;
    if (glides) {
      glide.current = glideViewport(
        deps.getViewport(),
        { zoom, offset },
        { zoom: deps.setViewportZoom, offset: deps.setViewportOffset },
      );
    } else {
      deps.setViewportZoom(zoom);
      deps.setViewportOffset(offset);
    }
    debugLog('[illustrate-page] framed', { tabId, page: page?.id ?? 'first', inset, zoom, glides });
  };
  // Centred on the first page after the tab's own first fit (a frame later), so the page wins.
  const centre = useEffectEvent(() =>
    frame(layOutIllustratePages(illustratePagesOf(activeTab))[0]),
  );
  // Entering the mode with content off the first page and no pages yet lays the content out into
  // pages (withContentPaginated, docs/specs/007-editor/illustrate-pages.md "Into pages"): one
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
    debugLog('[illustrate-page] content laid out into pages', { tabId, pages: n });
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
    () => illustratePagesOf({ pages: storedPages, pageOrientation: legacyOrientation }),
    [storedPages, legacyOrientation],
  );
  const pages = useMemo(() => layOutIllustratePages(current), [current]);

  // Edit rights now, for a commit made as the panel closes (layout phase: current before any
  // passive cleanup of that render runs).
  const canEditNow = useRef(canEdit && activeTab.locked !== true);
  useLayoutEffect(() => {
    canEditNow.current = canEdit && activeTab.locked !== true;
  });
  const mayEdit = useCallback(() => canEditNow.current, []);
  const [layoutPreview, setLayoutPreview] = useState<IllustratePagesView['layoutPreview']>(null);
  // A page just added or duplicated: framed once it lands in the row (a frame later, as its
  // sheet mounts).
  const [goTo, setGoTo] = useState<string | null>(null);
  const goToLanded = useEffectEvent(() => {
    const page = layOutIllustratePages(illustratePagesOf(activeTab)).find((p) => p.id === goTo);
    if (!page) return;
    setGoTo(null);
    frame(page, false, true);
  });
  const landed = goTo !== null && illustratePagesOf(activeTab).some((p) => p.id === goTo);
  useEffect(() => {
    if (!landed) return;
    const raf = requestAnimationFrame(() => goToLanded());
    return () => cancelAnimationFrame(raf);
  }, [landed]);

  if (!on) return null;
  const focusPage = (pageId: string) =>
    frame(
      pages.find((p) => p.id === pageId),
      false,
      true,
    );
  const readPage = (pageId: string) =>
    frame(
      pages.find((p) => p.id === pageId),
      true,
      true,
    );
  const panFrom = () => {
    glide.current?.();
    glide.current = null;
    const from = deps.getViewport();
    return (dx: number, dy: number) =>
      deps.setViewportOffset({
        x: from.offset.x + dx / from.zoom,
        y: from.offset.y + dy / from.zoom,
      });
  };
  const theme = getTheme(activeTab.theme);
  const themeBackgrounds = themeBackgroundPresets(theme);
  const tabFont = activeTab.font;
  const shared = {
    pages,
    focusPage,
    readPage,
    panFrom,
    themeBackgrounds,
    themeAccent: themeAccent(theme),
    tabFont,
    layoutPreview,
    setLayoutPreview,
  };
  if (!canEdit || activeTab.locked === true) return shared;
  return {
    ...shared,
    // mayEdit reads a ref, but only when an edit commits (in a handler), never during render.
    // eslint-disable-next-line react-hooks/refs
    edit: illustratePageEdits({
      tabId,
      current,
      elements: activeTab.elements,
      commitTabs,
      onCreated: setGoTo,
      onArticleCreated: deps.onArticleCreated,
      onLayoutPlaced: deps.clearSelection,
      mayEdit,
    }),
  };
}
