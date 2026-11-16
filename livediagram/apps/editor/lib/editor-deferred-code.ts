import { lazyPanel } from '@liveworkspace/ui/lazy-panel';
import type { PresentationOverlay as PresentationOverlayComponent } from '@/components/canvas/PresentationOverlay';

// The editor's code that loads on demand (docs/specs/016-platform/web-performance.md), in one place so each
// surface's dynamic import and the prefetch below name the same module.
//
// - Content a board may draw as soon as it opens (the Draw dock, tables,
//   facilitation panels): fetched as the editor mounts, alongside the document request, so a board that has
//   one finds its code already in. A board without one pays nothing on the critical path.
// - Surfaces someone opens (the Explorer, search, layers, the style panel, tool panels, presenting): fetched
//   once the opened document has rendered and the page is idle, so a first open does not wait.

export const loadWhiteboardDock = () =>
  import('@/components/canvas/whiteboard/WhiteboardDock').then((m) => m.WhiteboardDock);
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
// The panels the editor mounts with the canvas, drawn as lazy panels (@liveworkspace/ui/lazy-panel) so the warm paint
// can have their code in before it paints (WARM_PAINT_CODE below): then they draw in the paint's own commit.
export const QuickStylePanel = lazyPanel('QuickStylePanel', loadQuickStylePanel);
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
export const loadSessionElementSettings = () =>
  import('@/components/canvas/SessionElementSettings');

export const DOCUMENT_CONTENT_CODE = [
  loadWhiteboardDock,
  loadTableView,
  loadCollabFaceRouter,
] as const;

export const EDITOR_SURFACE_CODE = [
  loadExplorerPanel,
  loadEditorSearchPanel,
  loadLayersPanel,
  QuickStylePanel.preload,
  loadPresentationOverlay,
  loadToolPanels,
  loadSessionElementSettings,
] as const;

// What the warm paint (docs/specs/006-document/offline-mode.md "The code it draws is in first") waits for before it
// paints, at most WARM_PAINT_CODE_WAIT_MS: the panels it mounts with the canvas (measured with
// e2e/perf/warm-open.perf.ts, Work Tracker 960). A panel left waiting on its code holds back the ordinary load.
export const WARM_PAINT_CODE = [QuickStylePanel.preload, ElementTourHost.preload] as const;
