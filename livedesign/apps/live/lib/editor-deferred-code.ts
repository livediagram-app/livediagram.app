import type { PresentationOverlay as PresentationOverlayComponent } from '@/components/canvas/PresentationOverlay';

// The editor's code that loads on demand (docs/specs/016-platform/web-performance.md), in one place so each
// surface's dynamic import and the prefetch below name the same module.
//
// - Content a board may draw as soon as it opens (Pages and their writing, tables):
//   fetched as the editor mounts, alongside the document request, so a board that has
//   one finds its code already in. A board without one pays nothing on the critical path.
// - Surfaces someone opens (the Explorer, search, layers, the style panel, tool panels, presenting): fetched
//   once the opened document has rendered and the page is idle, so a first open does not wait.

export const loadCanvasPages = () =>
  import('@/components/canvas/CanvasPages').then((m) => m.CanvasPages);
export const loadTableView = () => import('@/components/canvas/TableView').then((m) => m.TableView);

export const loadExplorerPanel = () => import('@/components/panels/Explorer');
export const loadEditorSearchPanel = () =>
  import('@/components/panels/EditorSearchPanel').then((m) => m.EditorSearchPanel);
export const loadLayersPanel = () =>
  import('@/components/panels/LayersPanel').then((m) => m.LayersPanel);
export const loadQuickStylePanel = () =>
  import('@/components/canvas/QuickStylePanel').then((m) => m.QuickStylePanel);
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

export const DOCUMENT_CONTENT_CODE = [loadCanvasPages, loadTableView] as const;

export const EDITOR_SURFACE_CODE = [
  loadExplorerPanel,
  loadEditorSearchPanel,
  loadLayersPanel,
  loadQuickStylePanel,
  loadPresentationOverlay,
  loadToolPanels,
] as const;
