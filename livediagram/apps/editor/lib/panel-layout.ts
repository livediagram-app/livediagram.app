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
// their buttons, docs/specs/007-editor/toolbar-layout.md), nor are Poll and Vote (popovers off the
// Session strip, docs/specs/012-collaboration/session-tools.md), nor the retired AI assistant panel: a stored layout naming them is
// read like any unknown id.
export type PanelId =
  | 'collaborate'
  | 'minimap'
  // Laser Panel (docs/specs/008-canvas/laser-panel.md): the pen's settings, present only while the Laser
  // tool is.
  | 'laser'
  // Spotlight Panel (docs/specs/008-canvas/spotlight-panel.md): the light's look, on the same terms.
  | 'spotlight'
  // Eraser Panel (docs/specs/008-canvas/eraser-panel.md): the brush's settings, on the same terms.
  | 'eraser'
  // Format Panel (docs/specs/008-canvas/format-panel.md): what the painter copies, on the same terms.
  | 'format'
  // Slide Deck panel (docs/specs/012-collaboration/presentation-mode.md): where a deck is built and started.
  | 'slide-deck';

export const PANEL_IDS: readonly PanelId[] = [
  'collaborate',
  'minimap',
  'laser',
  'spotlight',
  'eraser',
  'format',
  'slide-deck',
];

export type PanelLayout = PanelLayoutOf<PanelId>;

// Each panel's home corner (docs/specs/007-editor/panel-docking.md "Default layout"), so a user who
// never rearranges anything sees the same chrome every time.
export const DEFAULT_PANEL_CORNER: Record<PanelId, PanelCorner> = {
  // Collaborate (docs/specs/012-collaboration/assigned-actions.md §5): a popover over its cluster
  // button, so its corner is only where a stored layout falls back to.
  collaborate: 'bottom-right',
  minimap: 'bottom-left',
  // The tool panels: bottom-right, above the bottom cluster. Each exists only while its tool does, so it joins and
  // leaves its corner stack.
  laser: 'bottom-right',
  spotlight: 'bottom-right',
  eraser: 'bottom-right',
  format: 'bottom-right',
  'slide-deck': 'bottom-right',
};

export const STORAGE_KEY = 'livediagram:panel-layout:v1';
export const PANEL_LAYOUT_CHANGED_EVENT = 'livediagram:panel-layout-changed';

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
    'bottom-right': ['collaborate'],
  },
  storageKey: STORAGE_KEY,
  changedEvent: PANEL_LAYOUT_CHANGED_EVENT,
});
