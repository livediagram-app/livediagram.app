import { lazyPanel } from '@liveworkspace/ui/lazy-panel';
import type { PresentationOverlay as PresentationOverlayComponent } from '@/components/canvas/PresentationOverlay';

// The editor's code that loads on demand (docs/specs/016-platform/web-performance.md), in one place so each
// surface's dynamic import and the prefetch below name the same module.
//
// - Content a board may draw as soon as it opens (Pages and their writing, tables):
//   fetched as the editor mounts, alongside the document request, so a board that has
//   one finds its code already in. A board without one pays nothing on the critical path.
// - Surfaces someone opens (the Explorer, search, the Quick Style bar, tool panels, presenting): fetched
//   once the opened document has rendered and the page is idle, so a first open does not wait.

export const loadCanvasPages = () =>
  import('@/components/canvas/CanvasPages').then((m) => m.CanvasPages);
export const loadArticleFlows = () =>
  import('@/components/canvas/article/ArticleFlows').then((m) => m.ArticleFlows);
export const loadTableView = () => import('@/components/canvas/TableView').then((m) => m.TableView);
// What the editor draws with a document's pages, drawn as lazy panels (@liveworkspace/ui/lazy-panel) so the warm paint
// can have their code in before it paints (WARM_PAINT_CODE below): then they draw in the paint's own commit. The pages
// and their writing are content, so a failed load throws to the canvas's error boundary as before.
export const CanvasPages = lazyPanel('CanvasPages', loadCanvasPages, { onFail: 'throw' });
export const ArticleFlows = lazyPanel('ArticleFlows', loadArticleFlows, { onFail: 'throw' });
export const PageContentsSidebar = lazyPanel('PageContentsSidebar', () =>
  import('@/components/canvas/PageContentsSidebar').then((m) => m.PageContentsSidebar),
);

export const loadExplorerPanel = () => import('@/components/panels/Explorer');
export const loadEditorSearchPanel = () =>
  import('@/components/panels/EditorSearchPanel').then((m) => m.EditorSearchPanel);
export const loadQuickStyleBar = () =>
  import('@/components/canvas/QuickStyleBar').then((m) => m.QuickStyleBar);
export const QuickStyleBar = lazyPanel('QuickStyleBar', loadQuickStyleBar);
// The tours (docs/specs/007-editor/pages-tour.md, element-tours.md), mounted with the editor.
export const PagesTourHost = lazyPanel('PagesTourHost', () =>
  import('@/components/tour/PagesTourHost').then((m) => m.PagesTourHost),
);
export const ElementTourHost = lazyPanel('ElementTourHost', () =>
  import('@/components/tour/ElementTourHost').then((m) => m.ElementTourHost),
);
// The presentation overlay holds the deck's keys (the arrows, Escape), so a deck must not start before it
// can listen: starting one waits for this load (useSlideDeck), and the host draws the loaded component
// directly (loadedPresentationOverlay) rather than through a lazy wrapper that would miss the first frame.
let presentationOverlay: typeof PresentationOverlayComponent | null = null;
export const loadPresentationOverlay = () =>
  import('@/components/canvas/PresentationOverlay').then(
    (m) => (presentationOverlay = m.PresentationOverlay),
  );
export const loadedPresentationOverlay = () => presentationOverlay;
export const loadToolPanels = () => import('@/components/canvas/tool-panels');

export const DOCUMENT_CONTENT_CODE = [
  CanvasPages.preload,
  ArticleFlows.preload,
  loadTableView,
] as const;

export const EDITOR_SURFACE_CODE = [
  loadExplorerPanel,
  loadEditorSearchPanel,
  QuickStyleBar.preload,
  loadPresentationOverlay,
  loadToolPanels,
] as const;

// What the warm paint (docs/specs/006-document/offline-mode.md "The code it draws is in first") waits for before it
// paints, at most WARM_PAINT_CODE_WAIT_MS: what it mounts with the canvas (measured on the signed-in export, Work
// Tracker 960). Anything left waiting on its code draws a beat late, behind React's reveal throttle.
export const WARM_PAINT_CODE = [
  CanvasPages.preload,
  ArticleFlows.preload,
  PageContentsSidebar.preload,
  QuickStyleBar.preload,
  PagesTourHost.preload,
  ElementTourHost.preload,
] as const;
