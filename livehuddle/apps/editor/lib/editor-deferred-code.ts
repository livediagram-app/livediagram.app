// The editor's code that loads on demand (docs/specs/016-platform/web-performance.md), in one place so each
// surface's dynamic import and the prefetch below name the same module.
//
// - Content a board may draw as soon as it opens (tables,
//   facilitation panels): fetched as the editor mounts, alongside the document request, so a board that has
//   one finds its code already in. A board without one pays nothing on the critical path.
// - Surfaces someone opens (the Explorer, search, layers, tool panels): fetched
//   once the opened document has rendered and the page is idle, so a first open does not wait.

// Speech bubbles and the composer (docs/specs/008-canvas/avatar-mode.md "Speech bubbles"): fetched once someone who
// may speak enters Avatar mode, or when a bubble first arrives.
export const loadAvatarSpeechLayer = () =>
  import('@liveworkspace/avatar/components/AvatarSpeechLayer').then((m) => m.AvatarSpeechLayer);

export const loadTableView = () => import('@/components/canvas/TableView').then((m) => m.TableView);

export const loadExplorerPanel = () => import('@/components/panels/Explorer');
export const loadEditorSearchPanel = () =>
  import('@/components/panels/EditorSearchPanel').then((m) => m.EditorSearchPanel);
export const loadToolPanels = () => import('@/components/canvas/tool-panels');

export const DOCUMENT_CONTENT_CODE = [loadTableView] as const;

export const EDITOR_SURFACE_CODE = [
  loadExplorerPanel,
  loadEditorSearchPanel,
  loadToolPanels,
] as const;
