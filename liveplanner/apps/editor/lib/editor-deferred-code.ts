// The editor's code that loads on demand (docs/specs/016-platform/web-performance.md), in one place so each
// surface's dynamic import and the prefetch below name the same module.
//
// - Content a board may draw as soon as it opens (tables,
//   facilitation panels): fetched as the editor mounts, alongside the project request, so a board that has
//   one finds its code already in. A board without one pays nothing on the critical path.
// - Surfaces someone opens (the Explorer, search): fetched
//   once the opened project has rendered and the page is idle, so a first open does not wait.
// - What the warm paint draws at once (WARM_PAINT_CODE): drawn as lazy panels (@liveworkspace/ui/lazy-panel), so with
//   their code in they draw in the paint's own commit.
import { lazyPanel } from '@liveworkspace/ui/lazy-panel';
import { FillTabPending } from '@/components/plan/FillTabPending';

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
// A failure throws to PlanSheetsArea's boundary, which closes what was open and says why, as it did on next/dynamic.
export const PlanSheetsHost = lazyPanel('PlanSheetsHost', loadPlanSheetsHost, { onFail: 'throw' });
// The Plan tour's host, mounted with the editor (EditorTours).
export const PlanTourHost = lazyPanel('PlanTourHost', () =>
  import('@/components/tour/PlanTourHost').then((m) => m.PlanTourHost),
);
// A board on the canvas (ShapeContentRouter): its loading cover while its code lands, its failure to the canvas's
// error boundary.
export const PlanBoardView = lazyPanel(
  'PlanBoardView',
  () => import('@/components/plan/PlanBoardView').then((m) => m.PlanBoardView),
  { onFail: 'throw', fallback: FillTabPending },
);

export const PROJECT_CONTENT_CODE = [loadTableView, loadCollabFaceRouter] as const;

export const EDITOR_SURFACE_CODE = [
  loadExplorerPanel,
  loadEditorSearchPanel,
  loadSessionElementSettings,
  PlanSheetsHost.preload,
] as const;

// What the warm paint (docs/specs/006-project/offline-mode.md "The code it draws is in first") waits for before it
// paints, at most WARM_PAINT_CODE_WAIT_MS: the board, the card panel host and the Plan tour's host it mounts with a
// Board first tab, the boundaries its commit left waiting on code (measured with a commit probe on
// e2e/perf/warm-open.perf.ts's plan, Work Tracker 1111). A panel left waiting draws a beat after the paint and holds a
// reveal behind it.
export const WARM_PAINT_CODE = [
  PlanBoardView.preload,
  PlanSheetsHost.preload,
  PlanTourHost.preload,
] as const;
