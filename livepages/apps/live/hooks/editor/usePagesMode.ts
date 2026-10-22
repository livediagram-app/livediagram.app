// Pages mode's pages (docs/specs/007-editor/pages-mode.md): the active tab's pages
// laid out in their row, the edits to them (page-edits) and framing one in the view. It
// also centres the view on the page you were last on (the first, the first time) whenever the
// tab changes.
import type { LogoToolsView } from './useLogoTools';
import {
  useCallback,
  useEffect,
  useEffectEvent,
  useInsertionEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from 'react';
import {
  articleMarginPx,
  articlesOf,
  pageFitBox,
  pagesOf,
  layOutPages,
  pageKindOf,
  withContentOnAPage,
  tabWireframeFrameTheme,
  type WireframeFrameTheme,
  type Element,
  type LaidOutPage,
  type Tab,
} from '@livepages/document';
import { besideSideInsets, computeFitBelow, computeReadingFrame } from '@/lib/viewport';

// The most a wireframe page's fit zooms in (a watch's face fills the screen at about this).
const WIREFRAME_FIT_MAX_ZOOM = 2.5;
import { sideChromeInsets } from '@/lib/side-chrome-insets';
import { pageInView } from '@/lib/page-contents';
import { topStripInset } from '@/lib/top-strip-inset';
import { debugLog } from '@/lib/debug-log';
import { track } from '@/lib/telemetry';
import { getTheme } from '@/lib/themes';
import { themeAccent, themeBackgroundPresets, type ThemeBackgroundPreset } from '@/lib/page-paint';
import type { ArticlesView } from './useArticles';
import { pageEdits, type PageEdits } from './page-edits';
import type { PageLayoutId } from '@livepages/templates';
import { glideViewport, type ViewPose } from '@/lib/viewport-glide';
import type { View } from '@/lib/viewport-store';
import { lastPageKey } from '@/lib/last-page';
import { setCurrentPageKind } from '@/lib/current-page-kind';
import { useLastPage } from './useLastPage';
import { usePageSnap } from './usePageSnap';

export type { PageEdits };

export type PagesModeView = {
  pages: LaidOutPage[];
  // The whole row, when `pages` shows only some of it (a page slide presenting): a document's
  // writing is laid out across all of its pages whichever of them are shown.
  rowPages?: LaidOutPage[];
  // Frames one page in the view (its label's press).
  focusPage: (pageId: string) => void;
  // Fit (the zoom cluster's, Shift+1) in Pages: frames the page nearest the middle of what shows
  // beside the Contents sidebar, not the whole tab (docs/specs/007-editor/pages-mode.md
  // "Contents" "Framing beside it").
  fitPageInView: () => void;
  // An article page framed for writing on a phone: its text column across the screen.
  readPage: (pageId: string) => void;
  // A finger's pan over an article page begun from the view now: moves it by a screen-px drag.
  // Absent where nothing pans the view from a page (presenting).
  panFrom?: () => (dx: number, dy: number) => void;
  // Backgrounds drawn from the tab's theme, offered first in the page panel.
  themeBackgrounds: ThemeBackgroundPreset[];
  // The tab theme's accent: a document's accent unless it picked one of its own.
  themeAccent: string;
  // The tab theme's colours a wireframe page's frame is drawn in (docs/specs/007-editor/
  // wireframe-pages.md "Choosing the device").
  frameTheme: WireframeFrameTheme;
  // The articles' writing on the pages (useArticles), composed in by the editor.
  articles?: ArticlesView | null;
  // The tab's default face, for what the pages draw themselves (a layout preview).
  tabFont?: string;
  // The tab's elements, for the content a previewed layout carries over from its page.
  elements?: Element[];
  // A layout previewed on a page while its tile is hovered: the page's own content is hidden
  // under it (the clip leaves the page out) so the preview never mixes with it.
  layoutPreview: { pageId: string; layout: PageLayoutId } | null;
  setLayoutPreview: (preview: { pageId: string; layout: PageLayoutId } | null) => void;
  // A logo page's own tools, each person's (docs/specs/007-editor/logo-pages.md): composed in by
  // the editor.
  logo?: LogoToolsView;
  // Absent where the viewer may not change the pages (a view role, a locked tab).
  edit?: PageEdits;
  // A slide page's place in the slide deck (PageDeckButton), composed in by the editor; absent
  // where the deck cannot be changed.
  deck?: PageDeckControls;
  // A page slide presenting: the surround is blacked out round the sheet, as a projector shows it.
  letterbox?: boolean;
};

export type PageDeckControls = {
  // The deck's slide of this page (on this tab), if it has one.
  slideOf: (pageId: string) => { id: string; hidden: boolean; notes: string } | undefined;
  add: (pageId: string) => void;
  toggleHidden: (slideId: string) => void;
  // The slide's speaker notes, as the Slide Deck panel writes them (an empty string removes them).
  setNotes: (slideId: string, notes: string) => void;
};

export function usePagesMode(deps: {
  activeTab: Tab;
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
  // open) another.
  framePageRef?: RefObject<((pageId: string) => void) | null>;
  // Given the landing framing, so the fit on landing
  // on a tab (useTabEntryEffects) frames the page you were last on (else the first), not the
  // whole row of pages.
  frameFirstPageRef?: RefObject<(() => void) | null>;
  // The document's id and the view's store, so the page you were last on is remembered per tab
  // in this browser (useLastPage); without either, landing frames the first page.
  documentId?: string;
  viewport?: { get: () => View; subscribe: (listener: () => void) => () => void };
  // A new document by its flow id, so its writing can take the caret.
  onArticleCreated?: (flow: string) => void;
  // The view is not this person's to snap onto a page: following someone, or presenting.
  snapSuspended?: () => boolean;
}): PagesModeView {
  const { activeTab, canEdit, tabLoaded, commitTabs } = deps;
  const tabId = activeTab.id;

  // Frames a page (the first by default) below a top strip, seen whole, whatever its kind: the page
  // itself, so turning or resizing one frames it again (page-edits). `read` frames an article page
  // to be written on a phone instead: its text column across the screen.
  // A page framed on request (its navigator, its label, a page just added, an article page taking
  // the caret on a phone) glides there; the frame on entering the mode lands at once. A glide under
  // way gives way to the next, or to a finger's pan.
  const glide = useRef<(() => void) | null>(null);
  useEffect(() => () => glide.current?.(), []);
  // What shows of the canvas: below the Toolbar strip, beside the Contents panel wherever it sits
  // (docs/specs/007-editor/pages-mode.md "Contents"), so a page centres in what shows beside it.
  const measure = () => {
    const canvas = deps.canvasMainRef.current;
    if (!canvas) return null;
    const inset = topStripInset(canvas);
    const sides = sideChromeInsets(canvas);
    return { width: canvas.offsetWidth, height: canvas.offsetHeight, inset, sides };
  };
  const frameFor = (
    m: NonNullable<ReturnType<typeof measure>>,
    page?: LaidOutPage,
    read = false,
  ) => {
    const { inset, sides } = m;
    const size = { width: m.width - sides.left - sides.right, height: m.height };
    const doc = page?.flow ? articlesOf(activeTab)[page.flow] : undefined;
    return besideSideInsets(
      read && page && doc
        ? computeReadingFrame(size, page.rect, inset, articleMarginPx(doc.style))
        : computeFitBelow(
            size,
            pageFitBox(page),
            inset,
            // A wireframe page is a device at its real size (a watch is 198 px wide): its fit may
            // zoom in past 100% to fill the screen; paper stays at most at its own size.
            page?.kind === 'wireframe' ? WIREFRAME_FIT_MAX_ZOOM : undefined,
          ),
      sides,
    );
  };
  const glideTo = (to: ViewPose) => {
    glide.current?.();
    glide.current = glideViewport(deps.getViewport(), to, {
      zoom: deps.setViewportZoom,
      offset: deps.setViewportOffset,
    });
  };
  const frame = (page?: LaidOutPage, read = false, glides = false) => {
    const m = measure();
    if (!m) return;
    const { zoom, offset } = frameFor(m, page, read);
    glide.current?.();
    glide.current = null;
    if (glides) {
      glideTo({ zoom, offset });
    } else {
      deps.setViewportZoom(zoom);
      deps.setViewportOffset(offset);
    }
    debugLog('[page] framed', {
      tabId,
      page: page?.id ?? 'first',
      inset: m.inset,
      sides: m.sides,
      zoom,
      glides,
    });
  };
  // The pages laid out once per change to the stored pages, so everything drawn from them (the
  // Map's picture, the export preview) keeps its memo while the view pans and zooms.
  const storedPages = activeTab.pages;
  const legacyOrientation = activeTab.pageOrientation;
  const current = useMemo(
    () => pagesOf({ pages: storedPages, pageOrientation: legacyOrientation }),
    [storedPages, legacyOrientation],
  );
  const pages = useMemo(() => layOutPages(current), [current]);
  // The view rests on a page once a pan or a zoom lets go (docs/specs/007-editor/pages-mode.md
  // "Getting around the pages").
  usePageSnap({
    on: true,
    pages,
    viewport: deps.viewport,
    measure: () => {
      const m = measure();
      if (!m) return null;
      return {
        screen: { width: m.width, height: m.height },
        band: {
          left: m.sides.left,
          right: m.width - m.sides.right,
          top: m.inset,
          bottom: m.height,
        },
      };
    },
    fitOf: (page) => {
      const m = measure();
      return m ? frameFor(m, page) : deps.getViewport();
    },
    glideTo,
    cancelGlide: () => {
      glide.current?.();
      glide.current = null;
    },
    suspended: deps.snapSuspended ?? (() => false),
  });
  // The page you were last on, remembered as the view rests (docs/specs/007-editor/
  // pages-mode.md "Back to the page you were on").
  const last = useLastPage({
    on: true,
    storeKey: deps.documentId ? lastPageKey(deps.documentId, tabId) : undefined,
    pages,
    canvasMainRef: deps.canvasMainRef,
    viewport: deps.viewport,
  });
  // The landing frame: the page you were last on, else the first.
  const frameLanding = () => {
    const row = layOutPages(pagesOf(activeTab));
    frame(last.remembered(row) ?? row[0]);
    last.arm();
  };
  // Centred on the page after the tab's own first fit (a frame later), so the page wins.
  const centre = useEffectEvent(frameLanding);
  // Entering the mode with a board that does not fit its first page puts it onto a page made
  // around it, where it is (withContentOnAPage, docs/specs/007-editor/pages-mode.md "Into
  // pages"): no element moves, resizes or scales. One edit, so one undo takes the page away, said
  // in a toast. Then the view frames the first page.
  const putOnAPage = useEffectEvent(() => {
    if (!canEdit || activeTab.locked === true) return;
    const placed = withContentOnAPage(activeTab);
    if (!placed) return;
    commitTabs((ts) => ts.map((t) => (t.id === tabId ? (withContentOnAPage(t) ?? t) : t)));
    deps.toastInfo('Put onto a page that fits it. Undo takes the page away.');
    track('Tab', 'Changed', 'PageFitToContent');
    debugLog('[page] content put onto a page', {
      tabId,
      size: placed.pages[0]?.size ?? 'a4',
    });
  });
  // The tab's own fit on landing (and a fit asked for with new content) frames that page too,
  // so whichever lands last, the view ends on the page rather than the whole row.
  const { frameFirstPageRef } = deps;
  useInsertionEffect(() => {
    if (frameFirstPageRef) frameFirstPageRef.current = frameLanding;
  });
  useEffect(() => {
    if (!tabLoaded) return;
    const raf = requestAnimationFrame(() => centre());
    return () => cancelAnimationFrame(raf);
  }, [tabLoaded, tabId]);
  // Its own effect so an editor role that resolves after the tab has loaded still gets the page.
  useEffect(() => {
    if (tabLoaded && canEdit) putOnAPage();
  }, [tabLoaded, tabId, canEdit]);

  // Edit rights now, for a commit made as the panel closes (layout phase: current before any
  // passive cleanup of that render runs).
  const canEditNow = useRef(canEdit && activeTab.locked !== true);
  useLayoutEffect(() => {
    canEditNow.current = canEdit && activeTab.locked !== true;
  });
  const mayEdit = useCallback(() => canEditNow.current, []);
  const [layoutPreview, setLayoutPreview] = useState<PagesModeView['layoutPreview']>(null);
  // A page just added or duplicated, or the one before a deleted page: framed once it is in the
  // row (a frame later, as its sheet mounts or the row closes up).
  const [goTo, setGoTo] = useState<string | null>(null);
  const goToLanded = useEffectEvent(() => {
    const page = layOutPages(pagesOf(activeTab)).find((p) => p.id === goTo);
    if (!page) return;
    setGoTo(null);
    frame(page, false, true);
  });
  const landed = goTo !== null && pagesOf(activeTab).some((p) => p.id === goTo);
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

  const focusPage = (pageId: string) => {
    const page = pages.find((p) => p.id === pageId);
    // Gone to: the page someone is on now (Select All's reach, the palette's page).
    if (page) setCurrentPageKind(pageKindOf(page), page.id);
    frame(page, false, true);
  };
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
  const frameTheme = tabWireframeFrameTheme(activeTab);
  const tabFont = activeTab.font;
  const fitPageInView = () => {
    const canvas = deps.canvasMainRef.current;
    if (!canvas) return;
    const id = pageInView(
      pages,
      deps.getViewport(),
      { width: canvas.offsetWidth, height: canvas.offsetHeight },
      sideChromeInsets(canvas),
    );
    frame(
      pages.find((p) => p.id === id),
      false,
      true,
    );
  };
  const shared = {
    pages,
    focusPage,
    fitPageInView,
    readPage,
    panFrom,
    themeBackgrounds,
    themeAccent: themeAccent(theme),
    frameTheme,
    tabFont,
    elements: activeTab.elements,
    layoutPreview,
    setLayoutPreview,
  };
  if (!canEdit || activeTab.locked === true) return shared;
  return {
    ...shared,
    // mayEdit reads a ref, but only when an edit commits (in a handler), never during render.
    // oxlint-disable-next-line react/refs
    edit: pageEdits({
      tabId,
      tab: activeTab,
      current,
      elements: activeTab.elements,
      layers: activeTab.layers,
      commitTabs,
      onGoTo: setGoTo,
      onArticleCreated: deps.onArticleCreated,
      onLayoutPlaced: deps.clearSelection,
      mayEdit,
      toastInfo: deps.toastInfo,
      theme,
    }),
  };
}
