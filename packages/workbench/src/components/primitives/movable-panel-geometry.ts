// The MovablePanel shapes the shared drag and inset code reads (docs/specs/007-editor/panel-docking.md).
// Each editor's MovablePanel.types.ts declares the full props; these are the parts every editor's
// props agree on, so its panel hands its own props to the shared hooks as they are.

// A panel's spot mid-drag, in the positioning container's coordinates, with that container's size.
// Each editor's lib/panel-layout.ts re-exports it for its snap rules.
export type PanelDragGeometry = {
  x: number;
  y: number;
  width: number;
  height: number;
  parentWidth: number;
  parentHeight: number;
};

// The corners a panel docks into (each editor's lib/panel-layout.ts PanelCorner).
export type PanelCorner = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

// Where a panel renders before anyone drags it.
export type MovablePanelDefaultCorner =
  'top-left' | 'top-right' | 'top-banner' | 'bottom-left' | 'bottom-right';

// The props the header-drag machinery reads (useMovablePanelDrag).
export type MovablePanelDragProps = {
  // Last user-set position in canvas-relative pixels; `null` until the panel is dragged.
  position: { x: number; y: number } | null;
  onMoveTo: (x: number, y: number) => void;
  // Whether the button that owns this popover has it open.
  popoverOpen?: boolean;
  // The positioning container's viewport rect; its presence routes the panel onto the docking path.
  getDockBounds?: () => DOMRect | null;
  onDockDragStart?: () => void;
  onDockDrag?: (geom: PanelDragGeometry) => void;
  onDockDragEnd?: (geom: PanelDragGeometry) => void;
};
