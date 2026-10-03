import type { ReactNode } from 'react';
import type { PanelCorner, PanelDragGeometry } from '@/lib/panel-layout';
import type { DockAnchor } from '@/lib/canvas-chrome';

export type MovablePanelDockProps = {
  docked?: boolean;
  // The corner the panel is currently docked in (when `docked`), so the
  // body-height measurement anchors correctly: a panel in a BOTTOM corner
  // grows upward from its stable bottom edge, not downward toward the tab
  // bar (which, clamped against the zoom controls, shrank it to nothing).
  dockedCorner?: PanelCorner;
  getDockBounds?: () => DOMRect | null;
  onDockDragStart?: () => void;
  onDockDrag?: (geom: PanelDragGeometry) => void;
  onDockDragEnd?: (geom: PanelDragGeometry) => void;
};

// The placement props a panel forwards straight through to the MovablePanel
// it renders. Every movable panel in the editor takes these and passes them
// on unchanged; nine of them had re-declared the set by hand.
//
// `onReset` is optional here; a panel that always offers reset narrows it by
// intersecting with a required declaration of its own.
export type MovablePanelPlacementProps = {
  position: { x: number; y: number } | null;
  onMoveTo: (x: number, y: number) => void;
  onReset?: () => void;
  // Corner-docking bundle (docs/specs/007-editor/panel-docking.md), forwarded to the inner MovablePanel.
  dock?: MovablePanelDockProps;
};

// The props of a panel that can open as a popover off a button: the Toolbar
// layout's Explorer (docs/specs/007-editor/toolbar-layout.md), and the Layers, Activity and Collaborate
// popovers over their cluster buttons (docs/specs/007-editor/live-app.md). Each is documented on
// MovablePanelProps below. A panel must forward `popoverAnchor` rather than
// let MovablePanel default it: it says where the button that opened the
// popover sits, so the popover hangs from that button with a pointer arrow.
export type MovablePanelPopoverProps = {
  popoverOpen?: boolean;
  popoverAnchor?: DockAnchor;
  asPopover?: boolean;
  dismissOnOutside?: boolean;
  onPopoverClose?: () => void;
};

export type MovablePanelProps = {
  // Caps-styled label that sits at the top-left of the header (acts as
  // the panel's name + the drag handle).
  title: string;
  // Last user-set position in canvas-relative pixels. `null` means the
  // panel hasn't been dragged yet — render at the default corner.
  position: { x: number; y: number } | null;
  // Where to render the panel when the user hasn't dragged it yet.
  // `top-right-stacked` is for panels that should sit below another
  // right-anchored panel (e.g. the Editor under the Palette).
  defaultCorner:
    'top-left' | 'top-right' | 'top-right-stacked' | 'top-banner' | 'bottom-left' | 'bottom-right';
  // Tailwind width utility for the panel body (e.g. `w-56`, `w-64`).
  width?: string;
  // Optional content rendered to the right of the title inside the
  // drag-handle row. Used by panels (e.g. Activity) that want to
  // surface a status badge in the header without inventing a new
  // bar. Pointer events stay live so buttons inside still click.
  headerExtra?: ReactNode;
  // A small adornment drawn DIRECTLY after the title (a count chip), as
  // opposed to `headerExtra`, which is pushed toward the button group and so
  // floated mid-header when a panel used it for a count.
  titleAdornment?: ReactNode;
  // Optional action controls rendered inside the header's button group,
  // immediately to the LEFT of the reset-position button. Unlike
  // `headerExtra` (which sits before the button group, by the title),
  // this slots into the same tight cluster as reset / minimise — for
  // panel-scoped affordances that belong with the chrome buttons (the
  // Palette's settings popover trigger). Only rendered in the desktop
  // floating-panel header; the popover has no header.
  headerActions?: ReactNode;
  // The help article this panel is explained by (docs/specs/018-help/contextual-help-links.md). Rendered as the
  // `?` chrome button beside reset / minimise, in BOTH the desktop header and
  // the popover's header band, so the help we already wrote is reachable from
  // the feature it documents rather than only by searching for it.
  //
  // Declared here rather than left to each panel's own headerActions so every
  // panel gets the same affordance in the same place — a help button that
  // moves around between panels teaches people not to look for it.
  helpArticle?: import('@/lib/help-articles').HelpArticleKey;
  // When provided, a "restore default" button appears to the left of
  // the minimise button. Wired by the caller to clear position state
  // so the panel snaps back to its default corner.
  onReset?: () => void;
  onMoveTo: (x: number, y: number) => void;
  // Optional: only called by the legacy dock-button minimise path
  // (the Layers panel uses it). Collapsible panels manage
  // their own banner state internally and never invoke this.
  onMinimize?: () => void;
  // When set AND the panel is at its default corner (position is null)
  // AND defaultCorner is 'top-right-stacked', the panel's top is
  // computed as `stackBelowY + 16` (16 = gap-4) instead of the
  // hardcoded top-[15rem]. This lets the caller stack a panel
  // dynamically beneath another resizable panel (the Comments / AI
  // panels sitting below the Palette, which changes height as it
  // collapses / expands). User drags break out of stacking
  // (position becomes non-null and explicit left/top win).
  stackBelowY?: number;
  // Optional ResizeObserver-driven callback fired with the panel's
  // current bounding box when it mounts and every time its size
  // changes. The Palette uses this so the Comments / AI panels can stack
  // beneath it; `bottomY` is the absolute offset (in offsetParent
  // coords) of the panel's bottom edge, so the consumer can hand it
  // back as `stackBelowY` and the panel above and below align
  // independently of which corner / top-utility class the upper
  // panel uses (top-2 on mobile vs top-4 on desktop).
  onSize?: (size: { width: number; height: number; bottomY: number }) => void;
  // When true the panel can collapse to a banner (title row only)
  // via its header button, on both mobile and desktop. The button's
  // icon flips between dash (collapse) and plus (expand) so the
  // same slot is the entry point in both directions. Mobile starts
  // collapsed by default; desktop starts expanded. Either stays as set
  // until the user clicks the button again. Replaces the dock-button minimise mechanism for opted-in
  // panels: the banner stays in the corner so the affordance is
  // always visible. See docs/specs/008-canvas/canvas-and-palette.md "Collapse to banner".
  collapsible?: boolean;
  // When true, start collapsed on first paint regardless of viewport.
  // Default (undefined / false) preserves the historical behaviour:
  // collapsible panels start collapsed only on mobile, expanded on
  // desktop. Used by panels that should default out of the way (the
  // Comments panel ships closed so it doesn't compete with the
  // Palette above it).
  defaultCollapsed?: boolean;
  // Render as a popover off a button rather than a floating panel: shown
  // only while `popoverOpen`, hung from `popoverAnchor`, with a slim header
  // band instead of the draggable title row.
  asPopover?: boolean;
  // Whether the button that owns this popover has it open.
  popoverOpen?: boolean;
  // Close the popover on any press outside it, as a menu does. The button
  // that opened it toggles it itself.
  dismissOnOutside?: boolean;
  // Called when the popover asks to close (an outside press, or its header's
  // close control), so the owner can clear its open panel.
  onPopoverClose?: () => void;
  popoverAnchor?: DockAnchor;
  // Drop the body's default top padding so the first child sits flush
  // against the panel header (floating) or the popover's top edge (dock).
  // Used by the palette, whose first child is a full-width tab band meant
  // to be flush; applies in BOTH render paths so the layouts match.
  flushTop?: boolean;
  // When true the body grows to its content instead of capping to the
  // available height + scrolling. Used by the palette so the shapes / tools /
  // … tab panels grow rather than showing a scrollbar (their content is
  // bounded; searchable tabs scroll their own inner grid).
  growBody?: boolean;
  // Stack this panel above its siblings. Every panel shares --z-panel, so
  // without it the order is whatever the DOM order happens to be — which is
  // how a panel mounted later ended up covering the palette. Only the palette
  // sets it today; a second claimant means the panels need a real focus-raise
  // rather than a second bump.
  elevated?: boolean;
  // --- Corner docking (docs/specs/007-editor/panel-docking.md, desktop only) ---
  // When true the panel renders as a static flex child of its corner
  // stack container (no absolute positioning / corner class), so the
  // container owns its resting position + reflow. Ignored while a drag
  // is in progress (the panel lifts to absolute to follow the pointer)
  // and in the popover path. Wired only by CanvasChrome's docking layout.
  docked?: boolean;
  // The corner the panel currently rests in while docked (see the bundle
  // type above) — drives the body-height anchor for bottom corners.
  dockedCorner?: PanelCorner;
  // Returns the positioning container's (<main>) viewport rect, so drag
  // coordinates can be expressed relative to it and the snap zones sized
  // to it. The PRESENCE of this prop is what routes the panel onto the
  // docking drag path instead of the legacy onMoveTo path; without it
  // MovablePanel behaves exactly as before.
  getDockBounds?: () => DOMRect | null;
  onDockDragStart?: () => void;
  onDockDrag?: (geom: PanelDragGeometry) => void;
  onDockDragEnd?: (geom: PanelDragGeometry) => void;
  // Stable anchor id for the interactive tour (docs/specs/007-editor/editor-tour.md), rendered as
  // `data-tour-id` on the panel root in BOTH render paths (floating panel
  // and popover) so tour steps can find the panel
  // whatever the layout.
  dataTourId?: string;
  children: ReactNode;
};
