// The editor's code that loads on demand (docs/specs/016-platform/web-performance.md), in one place so each
// surface's dynamic import and the prefetch below name the same module.
//
// - Content a board may draw as soon as it opens (tables,
//   facilitation panels): fetched as the editor mounts, alongside the project request, so a board that has
//   one finds its code already in. A board without one pays nothing on the critical path.
// - Surfaces someone opens (the Explorer, search): fetched
//   once the opened project has rendered and the page is idle, so a first open does not wait.

export const loadTableView = () => import('@/components/canvas/TableView').then((m) => m.TableView);
export const loadCollabFaceRouter = () =>
  import('@/components/canvas/collab/CollabFaceRouter').then((m) => m.CollabFaceRouter);

export const loadExplorerPanel = () => import('@/components/panels/Explorer');
export const loadEditorSearchPanel = () =>
  import('@/components/panels/EditorSearchPanel').then((m) => m.EditorSearchPanel);
export const loadSessionElementSettings = () =>
  import('@/components/canvas/SessionElementSettings');
// The card panel, type editor and required fields (PlanSheetsArea). Fetched at idle too: a card first opened after a
// release would otherwise ask for a chunk the release removed, and open nothing until a reload.
export const loadPlanSheetsHost = () =>
  import('@/components/plan/PlanSheetsHost').then((m) => m.PlanSheetsHost);

export const PROJECT_CONTENT_CODE = [loadTableView, loadCollabFaceRouter] as const;

export const EDITOR_SURFACE_CODE = [
  loadExplorerPanel,
  loadEditorSearchPanel,
  loadSessionElementSettings,
  loadPlanSheetsHost,
] as const;
