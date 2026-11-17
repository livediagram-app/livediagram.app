import { lazyPanel } from '@liveworkspace/ui/lazy-panel';

// The editor's code that loads on demand (docs/specs/016-platform/web-performance.md), in one place so each
// surface's dynamic import and the prefetch below name the same module.
//
// - Surfaces someone opens (the Explorer, search, layers, tool panels): fetched
//   once the opened document has rendered and the page is idle, so a first open does not wait.

// Speech bubbles and the composer (docs/specs/008-canvas/avatar-mode.md "Speech bubbles"): fetched once someone who
// may speak enters Avatar mode, or when a bubble first arrives.
export const loadAvatarSpeechLayer = () =>
  import('@livehuddle/avatar/components/AvatarSpeechLayer').then((m) => m.AvatarSpeechLayer);

// The 3D view's walls (docs/specs/008-canvas/3d-view.md "Performance"): fetched the first time a walk wants them.
export const loadSpace3DWalls = () =>
  import('@/components/canvas/space-3d/Space3DWalls').then((m) => m.Space3DWalls);

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

// Element tours (docs/specs/007-editor/element-tours.md), mounted with the editor: a lazy panel
// (@liveworkspace/ui/lazy-panel), so the warm paint can have its code in before it paints and it draws in the paint's
// own commit.
export const ElementTourHost = lazyPanel('ElementTourHost', () =>
  import('@/components/tour/ElementTourHost').then((m) => m.ElementTourHost),
);
// The Receptionist's host (docs/specs/008-canvas/receptionist.md), mounted the first time a person walks, which a Space
// opened on the walk does with its warm paint.
export const ReceptionistHost = lazyPanel('ReceptionistHost', () =>
  import('@/components/tour/ReceptionistHost').then((m) => m.ReceptionistHost),
);

// What the warm paint (docs/specs/006-document/offline-mode.md "The code it draws is in first") waits for before it
// paints, at most WARM_PAINT_CODE_WAIT_MS: what it mounts with the canvas (Work Tracker 960). Anything left waiting on
// its code draws a beat late, behind React's reveal throttle.
export const WARM_PAINT_CODE = [ElementTourHost.preload, ReceptionistHost.preload] as const;
