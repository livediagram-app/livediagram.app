// The editor's code that loads on demand (docs/specs/016-platform/web-performance.md), in one place so each
// surface's dynamic import and the prefetch below name the same module.
//
// - Surfaces someone opens (the Explorer, search, layers, tool panels): fetched
//   once the opened document has rendered and the page is idle, so a first open does not wait.

// Speech bubbles and the composer (docs/specs/008-canvas/avatar-mode.md "Speech bubbles"): fetched once someone who
// may speak enters Avatar mode, or when a bubble first arrives.
export const loadAvatarSpeechLayer = () =>
  import('@livehuddle/avatar/components/AvatarSpeechLayer').then((m) => m.AvatarSpeechLayer);

export const loadExplorerPanel = () => import('@/components/panels/Explorer');
export const loadEditorSearchPanel = () =>
  import('@/components/panels/EditorSearchPanel').then((m) => m.EditorSearchPanel);
export const loadToolPanels = () => import('@/components/canvas/tool-panels');

// A piece's panel (web-performance.md "A piece's panel"): fetched as a pointer comes over the face's button, it takes
// focus, or someone walks, and drawn the first time it is opened (lazyPanel, @livehuddle/ui).
export const loadCalendarWallPanels = () =>
  import('@/components/canvas/collab/CalendarWallPopover');
export const loadSuggestionBoxPanels = () =>
  import('@/components/canvas/collab/SuggestionBoxPopover');
export const loadRoomSignReader = () =>
  import('@/components/canvas/collab/RoomSignReader').then((m) => m.RoomSignReader);
export const loadWayfindingPopover = () =>
  import('@/components/canvas/wayfinding/WayfindingPopover').then((m) => m.WayfindingPopover);

export const EDITOR_SURFACE_CODE = [
  loadExplorerPanel,
  loadEditorSearchPanel,
  loadToolPanels,
] as const;
