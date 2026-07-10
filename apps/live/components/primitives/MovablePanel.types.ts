import type { ReactNode } from 'react';
import type { PanelCorner, PanelDragGeometry } from '@/lib/panel-layout';

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
    | 'top-left'
    | 'top-right'
    | 'top-right-stacked'
    | 'top-banner'
    | 'bottom-left'
    | 'bottom-right';
  // Tailwind width utility for the panel body (e.g. `w-56`, `w-64`).
  width?: string;
  // Optional content rendered to the right of the title inside the
  // drag-handle row. Used by panels (e.g. Activity) that want to
  // surface a status badge in the header without inventing a new
  // bar. Pointer events stay live so buttons inside still click.
  headerExtra?: ReactNode;
  // Optional action controls rendered inside the header's button group,
  // immediately to the LEFT of the reset-position button. Unlike
  // `headerExtra` (which sits before the button group, by the title),
  // this slots into the same tight cluster as reset / minimise — for
  // panel-scoped affordances that belong with the chrome buttons (the
  // Palette's settings popover trigger). Only rendered in the desktop
  // floating-panel header; the mobile dock popover has no header.
  headerActions?: ReactNode;
  // When provided, a "restore default" button appears to the left of
  // the minimise button. Wired by the caller to clear position state
  // so the panel snaps back to its default corner.
  onReset?: () => void;
  onMoveTo: (x: number, y: number) => void;
  // Optional: only called by the legacy dock-button minimise path
  // (the Activity panel still uses it). Collapsible panels manage
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
  // Mobile-only override for the top edge of `top-right` panels. Used
  // when ANOTHER panel sits above on mobile (Explorer above Palette),
  // so the Palette starts below it instead of overlapping. Ignored on
  // desktop, where the panel keeps its right-corner layout. Numeric
  // pixels, applied as an inline `top` so it wins over the Tailwind
  // mobile class without disturbing the `sm:top-4` desktop class.
  mobileTopOverridePx?: number;
  // CSS selector for DOM nodes that should be treated as inside the
  // panel even if they live outside `ref` (e.g. portal-mounted
  // submenus rendered to document.body). Without this, tapping an
  // ellipsis-menu item inside the panel body would count as a tap
  // OUTSIDE the panel and trigger the mobile auto-collapse, which
  // hides the rename input the same tap is about to mount.
  outsideExceptSelector?: string;
  // When true the panel can collapse to a banner (title row only)
  // via its header button, on both mobile and desktop. The button's
  // icon flips between dash (collapse) and plus (expand) so the
  // same slot is the entry point in both directions. Mobile starts
  // collapsed by default and auto-collapses on outside-tap; desktop
  // starts expanded and stays open until the user clicks the button
  // again. Replaces the dock-button minimise mechanism for opted-in
  // panels: the banner stays in the corner so the affordance is
  // always visible. See spec/09 "Collapse to banner".
  collapsible?: boolean;
  // When true, start collapsed on first paint regardless of viewport.
  // Default (undefined / false) preserves the historical behaviour:
  // collapsible panels start collapsed only on mobile, expanded on
  // desktop. Used by panels that should default out of the way (the
  // Comments panel ships closed so it doesn't compete with the
  // Palette above it).
  defaultCollapsed?: boolean;
  // Mobile dock mode. When true: force the panel open and position it
  // below the dock bar (using mobileTopOverridePx as the top offset).
  // When false: render nothing on mobile so the dock button is the
  // only affordance. When undefined: existing self-managed behaviour.
  mobileOpenOverride?: boolean;
  // When true, apply the mobile dock behaviour on desktop too (the
  // "minimal panel layout" user preference). The dock in Canvas.tsx
  // stays visible and panels render as popovers regardless of viewport.
  forceDockMode?: boolean;
  // Called when the user taps the collapse/minimize button while the
  // panel is dock-controlled. The dock should deactivate this panel.
  onMobileClose?: () => void;
  mobileDockAnchor?: { left: number; top: number; arrowOffset: number };
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
  // --- Corner docking (spec/63, desktop only) ---
  // When true the panel renders as a static flex child of its corner
  // stack container (no absolute positioning / corner class), so the
  // container owns its resting position + reflow. Ignored while a drag
  // is in progress (the panel lifts to absolute to follow the pointer)
  // and in the mobile / minimal dock paths. Wired only by CanvasChrome's
  // desktop docking layout.
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
  // Stable anchor id for the interactive tour (spec/79), rendered as
  // `data-tour-id` on the panel root in BOTH render paths (floating panel
  // and mobile/minimal dock popover) so tour steps can find the panel
  // whatever the layout.
  dataTourId?: string;
  children: ReactNode;
};
