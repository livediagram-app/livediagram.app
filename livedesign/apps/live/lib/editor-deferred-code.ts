import { lazyPanel } from '@liveworkspace/ui/lazy-panel';

// The editor's code that loads on demand (docs/specs/016-platform/web-performance.md), in one place so each
// surface's dynamic import and the prefetch below name the same module.
//
// - Content a board may draw as soon as it opens (Pages and their writing, tables):
//   fetched as the editor mounts, alongside the design request, so a board that has
//   one finds its code already in. A board without one pays nothing on the critical path.
// - Surfaces someone opens (the Explorer, search, the Quick Style bar, tool panels): fetched
//   once the opened design has rendered and the page is idle, so a first open does not wait.

export const loadCanvasPages = () =>
  import('@/components/canvas/CanvasPages').then((m) => m.CanvasPages);
// A photo page's surfaces (docs/specs/031-photo/photo-pages.md): its pictures on the sheets, its tools on the
// canvas, its chrome and its panel, fetched once a tab has a photo page.
export const loadPhotoPagesLayer = () =>
  import('@/components/photo/PhotoPagesLayer').then((m) => m.PhotoPagesLayer);
export const loadPhotoCanvasOverlays = () =>
  import('@/components/photo/PhotoCanvasOverlays').then((m) => m.PhotoCanvasOverlays);
export const loadPhotoChrome = () =>
  import('@/components/photo/PhotoChrome').then((m) => m.PhotoChrome);
export const loadPhotoTools = () =>
  import('@/components/photo/PhotoToolsRail').then((m) => m.PhotoToolsRail);
export const loadPhotoPanel = () =>
  import('@/components/photo/PhotoPanel').then((m) => m.PhotoPanel);
export const loadTableView = () => import('@/components/canvas/TableView').then((m) => m.TableView);
// What the editor draws with a design's pages, drawn as lazy panels (@liveworkspace/ui/lazy-panel) so the warm paint
// can have their code in before it paints (WARM_PAINT_CODE below): then they draw in the paint's own commit. The pages
// are content, so a failed load throws to the canvas's error boundary as before.
export const CanvasPages = lazyPanel('CanvasPages', loadCanvasPages, { onFail: 'throw' });
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
export const loadToolPanels = () => import('@/components/canvas/tool-panels');

export const DESIGN_CONTENT_CODE = [CanvasPages.preload, loadTableView] as const;

export const EDITOR_SURFACE_CODE = [
  loadExplorerPanel,
  loadEditorSearchPanel,
  QuickStyleBar.preload,
  loadToolPanels,
] as const;

// What the warm paint (docs/specs/006-design/offline-mode.md "The code it draws is in first") waits for before it
// paints, at most WARM_PAINT_CODE_WAIT_MS: what it mounts with the canvas (Work Tracker 960). Anything left waiting on
// its code draws a beat late, behind React's reveal throttle.
export const WARM_PAINT_CODE = [
  CanvasPages.preload,
  PageContentsSidebar.preload,
  QuickStyleBar.preload,
  PagesTourHost.preload,
  ElementTourHost.preload,
] as const;
