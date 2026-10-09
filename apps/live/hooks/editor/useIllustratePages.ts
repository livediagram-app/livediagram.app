// Illustrate mode's pages (docs/specs/007-editor/illustrate-pages.md): the active tab's pages
// laid out in their row, the edits to them (illustrate-page-edits) and framing one in the view. It
// also centres the view on the first page whenever the mode or the tab changes.
import type { LogoToolsView } from './useLogoTools';
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
  withContentOnAPage,
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
  // A logo page's own tools, each person's (docs/specs/007-editor/logo-pages.md): composed in by
  // the editor.
  logo?: LogoToolsView;
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
  // Given the page-framing call, so a page slide's row frames its page, on this tab or (once it is
  // open) another; set whether or not this tab is in Illustrate mode.
  framePageRef?: RefObject<((pageId: string) => void) | null>;
  // A new document by its flow id, so its writing can take the caret.
  onArticleCreated?: (flow: string) => void;
}): IllustratePagesView | null {
  const { activeTab, mode, canEdit, tabLoaded, commitTabs } = deps;
  const on = hasPageLook(mode);
  const tabId = activeTab.id;

  // Frames a page (the first by default) below a top strip, seen whole, whatever its kind: the page
  // itself, so turning or resizing one frames it again (illustrate-page-edits). `read` frames an article page
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
  // Entering the mode with a board that does not fit its first page puts it onto a page made
  // around it, where it is (withContentOnAPage, docs/specs/007-editor/illustrate-pages.md "Into
  // pages"): no element moves, resizes or scales. One edit, so one undo takes the page away, said
  // in a toast. Then the view frames the first page.
  const putOnAPage = useEffectEvent(() => {
    if (!canEdit || activeTab.locked === true) return;
    const placed = withContentOnAPage(activeTab);
    if (!placed) return;
    commitTabs((ts) => ts.map((t) => (t.id === tabId ? (withContentOnAPage(t) ?? t) : t)));
    deps.toastInfo('Put onto a page that fits it. Undo takes the page away.');
    track('Tab', 'Changed', 'PageFitToContent');
    debugLog('[illustrate-page] content put onto a page', {
      tabId,
      size: placed.pages[0]?.size ?? 'a4',
    });
  });
  useEffect(() => {
    if (!on || !tabLoaded) return;
    const raf = requestAnimationFrame(() => centre());
    return () => cancelAnimationFrame(raf);
  }, [on, tabLoaded, tabId]);
  // Its own effect so an editor role that resolves after the tab has loaded still gets the page.
  useEffect(() => {
    if (on && tabLoaded && canEdit) putOnAPage();
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
  // A page just added or duplicated, or the one before a deleted page: framed once it is in the
  // row (a frame later, as its sheet mounts or the row closes up).
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

  const { framePageRef } = deps;
  useEffect(() => {
    if (!framePageRef) return;
    framePageRef.current = setGoTo;
    return () => {
      framePageRef.current = null;
    };
  }, [framePageRef]);

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
      onGoTo: setGoTo,
      onArticleCreated: deps.onArticleCreated,
      onLayoutPlaced: deps.clearSelection,
      mayEdit,
      toastInfo: deps.toastInfo,
    }),
  };
}
