// The editor's code that loads on demand (docs/specs/016-platform/web-performance.md), in one place so each
// surface's dynamic import and the prefetch below name the same module.
//
// - Content a board may draw as soon as it opens (Pages and their writing, tables):
//   fetched as the editor mounts, alongside the design request, so a board that has
//   one finds its code already in. A board without one pays nothing on the critical path.
// - Surfaces someone opens (the Explorer, search, layers, the style panel, tool panels): fetched
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

export const loadExplorerPanel = () => import('@/components/panels/Explorer');
export const loadEditorSearchPanel = () =>
  import('@/components/panels/EditorSearchPanel').then((m) => m.EditorSearchPanel);
export const loadLayersPanel = () =>
  import('@/components/panels/LayersPanel').then((m) => m.LayersPanel);
export const loadQuickStylePanel = () =>
  import('@/components/canvas/QuickStylePanel').then((m) => m.QuickStylePanel);
export const loadToolPanels = () => import('@/components/canvas/tool-panels');

export const DESIGN_CONTENT_CODE = [loadCanvasPages, loadTableView] as const;

export const EDITOR_SURFACE_CODE = [
  loadExplorerPanel,
  loadEditorSearchPanel,
  loadLayersPanel,
  loadQuickStylePanel,
  loadToolPanels,
] as const;
