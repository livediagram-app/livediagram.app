// The editor's code that loads on demand (docs/specs/016-platform/web-performance.md), in one place so each
// surface's dynamic import and the prefetch below name the same module.
//
// - Content a board may draw as soon as it opens (tables,
//   facilitation panels): fetched as the editor mounts, alongside the document request, so a board that has
//   one finds its code already in. A board without one pays nothing on the critical path.
// - Surfaces someone opens (the Explorer, search, layers, the style panel, tool panels): fetched
//   once the opened document has rendered and the page is idle, so a first open does not wait.

export const loadTableView = () => import('@/components/canvas/TableView').then((m) => m.TableView);
export const loadCollabFaceRouter = () =>
  import('@/components/canvas/collab/CollabFaceRouter').then((m) => m.CollabFaceRouter);

export const loadExplorerPanel = () => import('@/components/panels/Explorer');
export const loadEditorSearchPanel = () =>
  import('@/components/panels/EditorSearchPanel').then((m) => m.EditorSearchPanel);
export const loadLayersPanel = () =>
  import('@/components/panels/LayersPanel').then((m) => m.LayersPanel);
export const loadQuickStylePanel = () =>
  import('@/components/canvas/QuickStylePanel').then((m) => m.QuickStylePanel);
export const loadToolPanels = () => import('@/components/canvas/tool-panels');
export const loadSessionElementSettings = () =>
  import('@/components/canvas/SessionElementSettings');

export const DOCUMENT_CONTENT_CODE = [loadTableView, loadCollabFaceRouter] as const;

export const EDITOR_SURFACE_CODE = [
  loadExplorerPanel,
  loadEditorSearchPanel,
  loadLayersPanel,
  loadQuickStylePanel,
  loadToolPanels,
  loadSessionElementSettings,
] as const;
