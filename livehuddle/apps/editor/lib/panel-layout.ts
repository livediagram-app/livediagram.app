// Device-local layout for the editor's corner panels (docs/specs/007-editor/panel-docking.md).
//
// Which corner each panel docks into: or where it floats free: is a
// per-device ergonomic choice (screen size, handedness, external
// monitor), so unlike the synced user-preferences blob (docs/specs/007-editor/user-preferences.md) this
// lives ONLY in localStorage and is NEVER sent to the api / D1. Guests
// get it for free. Do not fold panel placement into UserPreferences.
//
// Eventing mirrors lib/user-preferences.ts (a same-tab custom event so
// the editor reacts to its own write, plus the browser's native
// `storage` event for cross-tab), but there is no network step.

import {
  createPanelLayout,
  type PanelCorner,
  type PanelLayoutOf,
} from '@liveworkspace/workbench/lib/panel-layout';

// The corners, the placement shapes and the snap geometry are every editor's, in the one copy.
export {
  CORNER_INSET_PX,
  cornerBottomInset,
  nearestSnapCorner,
  PANEL_CORNERS,
  STACK_GAP_PX,
  type CornerStackExtents,
  type PanelCorner,
  type PanelDragGeometry,
  type ResolvedPlacement,
} from '@liveworkspace/workbench/lib/panel-layout';

// The corner panels that participate in docking. Every one is built on the
// shared MovablePanel. The fixed zoom controls are deliberately absent: they
// are not a MovablePanel and stay pinned bottom-right. The Palette, the
// Explorer and Layers are not corner panels (the strip, and popovers off
// their buttons, docs/specs/007-editor/toolbar-layout.md), nor the retired Timer popover
// (docs/specs/012-collaboration/session-tools.md), nor the retired Avatar panel (the avatar palette now,
// docs/specs/008-canvas/avatar-mode.md), nor the retired AI assistant panel: a stored layout naming them is
// read like any unknown id.
// The Collaborate Panel's `collaborate` left with comments and actions (docs/specs/002-project-scope/
// not-in-livehuddle.md "Comments, actions, links and notes"); a stored layout naming it drops it.
export type PanelId =
  | 'minimap'
  // Format Panel (docs/specs/008-canvas/format-panel.md): what the painter copies, present only while it is on.
  // (The Eraser Panel's `eraser` left with the Eraser; a stored layout naming it drops it.)
  | 'format';

export const PANEL_IDS: readonly PanelId[] = ['minimap', 'format'];

export type PanelLayout = PanelLayoutOf<PanelId>;

// Each panel's home corner (docs/specs/007-editor/panel-docking.md "Default layout"), so a user who
// never rearranges anything sees the same chrome every time.
export const DEFAULT_PANEL_CORNER: Record<PanelId, PanelCorner> = {
  minimap: 'bottom-left',
  // The tool panel: bottom-right, above the bottom cluster. It exists only while its tool does, so it joins and
  // leaves its corner stack.
  format: 'bottom-right',
};

export const STORAGE_KEY = 'livehuddle:panel-layout:v1';
export const PANEL_LAYOUT_CHANGED_EVENT = 'livehuddle:panel-layout-changed';

// The default layout lists these in the order they stacked historically rather than PANEL_IDS order (the order
// within a corner is the stack order).
export const {
  defaultPanelLayout,
  normalizePanelLayout,
  readPanelLayout,
  writePanelLayout,
  dockPanel,
  freePanel,
  resetPanelPlacement,
  resolvePlacement,
} = createPanelLayout<PanelId>({
  ids: PANEL_IDS,
  defaultCorner: DEFAULT_PANEL_CORNER,
  defaultStacks: {
    'bottom-left': ['minimap'],
  },
  storageKey: STORAGE_KEY,
  changedEvent: PANEL_LAYOUT_CHANGED_EVENT,
});
