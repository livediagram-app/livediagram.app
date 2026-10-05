'use client';

import { useRef, useState } from 'react';
import { useClickOutside } from '@livediagram/ui';
import { HelpArticleLink } from '@/components/primitives/HelpArticleLink';
import { isMobileViewportSync } from '@/lib/responsive';

// The corner-docking props bundle (docs/specs/007-editor/panel-docking.md). CanvasChrome builds one of
// these per panel when docking is active and panel wrappers spread it
// straight onto their inner MovablePanel, so each wrapper only grows by
// one optional prop. Empty / absent => the panel stays on the legacy
// (non-docking) drag path.
import type { MovablePanelDockProps, MovablePanelProps } from './MovablePanel.types';
import { useMovablePanelDrag } from './useMovablePanelDrag';
import { useMovablePanelMeasure } from './useMovablePanelMeasure';
import { MovablePanelHeader, PanelTitle } from './MovablePanelHeader';
import { useMinimalChrome } from '@/components/providers/minimal-chrome';
import { useUiScale } from '@/components/providers/ui-scale';
import { toSurfacePx, uiScaleStyle } from '@/lib/ui-scale';
import { cornerInsetStyle } from './movable-panel-scale';

export type { MovablePanelDockProps };

// Floating, draggable panel pinned over the canvas. The header row is the
// drag handle; a minimize button collapses the panel into a dock button
// (which the caller renders elsewhere — see Canvas's bottom dock).
//
// Width is fixed at construction time (via the `width` Tailwind utility)
// and the body grows with its content. No user-driven resize — keeping
// the panels uniformly-sized makes the chrome easier to reason about.
export function MovablePanel({
  title,
  elevated,
  position,
  defaultCorner,
  width = 'w-56',
  headerExtra,
  titleAdornment,
  headerActions,
  helpArticle,
  onReset,
  onMoveTo,
  onMinimize,
  stackBelowY,
  onSize,
  collapsible = false,
  defaultCollapsed = false,
  popoverOpen,
  asPopover = false,
  dismissOnOutside = false,
  onPopoverClose,
  popoverAnchor,
  flushTop = false,
  growBody = false,
  docked = false,
  dockedCorner,
  getDockBounds,
  onDockDragStart,
  onDockDrag,
  onDockDragEnd,
  dataTourId,
  children,
}: MovablePanelProps) {
  const minimalChrome = useMinimalChrome();
  // UI scale (docs/specs/007-editor/ui-scale.md): the panel is zoomed at its
  // root, so every screen-px offset written on it goes through toSurfacePx.
  const scale = useUiScale('panels');
  const px = (v: number) => toSurfacePx(v, scale);
  const ref = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  // Banner-collapse state. Only meaningful when `collapsible` is
  // true. Initial value depends on the viewport: mobile users start
  // collapsed so the canvas isn't covered by the chrome, desktop
  // users start expanded because the palette fits in the corner
  // without crowding the canvas. Initial value is read sync on first
  // render via `isMobileViewportSync` so the panel paints in the
  // right state on first mount (no expand-then-collapse flash).
  const [collapsed, setCollapsed] = useState(
    () => collapsible && (defaultCollapsed || isMobileViewportSync()),
  );
  // Header drag machinery (legacy free-move + corner docking) lives in
  // useMovablePanelDrag; the header mounts beginDrag below.
  const { docking, drag, dockDragPos, dockLifted, beginDrag } = useMovablePanelDrag({
    ref,
    position,
    onMoveTo,
    collapsible,
    collapsed,
    setCollapsed,
    popoverOpen,
    scale,
    getDockBounds,
    onDockDragStart,
    onDockDrag,
    onDockDragEnd,
  });

  // Panel geometry measurement (the body max-height cap + the onSize
  // publish) — see useMovablePanelMeasure.
  const bodyMaxH = useMovablePanelMeasure({
    ref,
    headerRef,
    position,
    stackBelowY,
    defaultCorner,
    docked,
    dockedCorner,
    onSize,
  });

  // A popover off a button (the Toolbar layout's Explorer, the cluster
  // popovers): shown only while the button has it open.
  const popoverShown = asPopover && popoverOpen === true;

  // Outside-tap auto-close, for a popover that opts in with
  // `dismissOnOutside` (the Toolbar Explorer, the Layers / Activity /
  // Collaborate cluster popovers: menus off a button). A popover's own
  // portalled menus count as inside: the outside-tap is most often a child
  // portal-menu item (Rename, Delete), and treating that as "dismiss the
  // panel" hides the rename input the same tap is about to mount.
  useClickOutside(
    ref,
    () => onPopoverClose?.(),
    dismissOnOutside && popoverShown,
    // The button that opened the popover toggles it itself. The tour popover
    // (docs/specs/007-editor/editor-tour.md) is always "inside": it sits next to the panel it's
    // explaining, so tapping its Next button must not dismiss that panel out
    // from under the highlight. A popover's own portalled menus and confirms
    // (a layer's row menu, Delete's confirm) are inside too, or choosing
    // from one would close the popover under it.
    '[data-dock-button],[data-tour-popover],[data-menu-surface],[role="dialog"]',
  );

  // When stackBelowY is provided and we're still at the default
  // corner, use it as a dynamic top (above the panel sitting at
  // its bottom + a 16px gap). Falls back to the static top-[15rem]
  // class when stackBelowY isn't wired (legacy callers, or no
  // measurement yet on first paint).
  const useDynamicStack =
    position === null && defaultCorner === 'top-right-stacked' && stackBelowY !== undefined;
  // Mobile drops the inter-panel gap to 4px because the palette
  // banner-collapses to a one-line strip there: keeping the old
  // desktop 16px gap left a visible empty band between the two
  // panels. Desktop stays at 16 (gap-4) so the stacked panels keep
  // breathing room.
  const stackGapPx = typeof window !== 'undefined' && isMobileViewportSync() ? 4 : 16;
  // Clamp a persisted free position back into the live viewport: a
  // panel dropped at x≈2200 on an external monitor renders fully
  // clipped inside the overflow-hidden main on a laptop — invisible,
  // with its only recovery affordance (the header's Reset) on the
  // invisible panel itself. Keeping the header strip reachable makes
  // any stale position self-recoverable.
  const clampFree = (pos: { x: number; y: number }): { x: number; y: number } => {
    if (typeof window === 'undefined') return pos;
    const MIN_VISIBLE = 56;
    return {
      x: Math.min(Math.max(pos.x, 0), Math.max(0, window.innerWidth - MIN_VISIBLE)),
      y: Math.min(Math.max(pos.y, 0), Math.max(0, window.innerHeight - MIN_VISIBLE)),
    };
  };
  const style: React.CSSProperties = position
    ? (() => {
        const clamped = clampFree(position);
        return { left: px(clamped.x), top: px(clamped.y) };
      })()
    : useDynamicStack
      ? { top: stackBelowY + stackGapPx }
      : cornerInsetStyle(defaultCorner, scale);
  const cornerClass = position
    ? ''
    : useDynamicStack
      ? 'inset-x-3 sm:left-auto sm:right-4'
      : defaultCorner === 'top-right'
        ? 'inset-x-3 top-3 sm:inset-x-auto sm:right-4 sm:top-4'
        : defaultCorner === 'top-right-stacked'
          ? 'inset-x-3 top-[15rem] sm:inset-x-auto sm:right-4'
          : defaultCorner === 'top-banner'
            ? 'inset-x-3 top-3'
            : defaultCorner === 'bottom-left'
              ? 'bottom-4 left-4'
              : defaultCorner === 'bottom-right'
                ? 'bottom-4 right-4'
                : 'left-4 top-4';

  // Docked rest (docs/specs/007-editor/panel-docking.md): the panel sits in a corner stack container
  // and lets that flex column own its position + reflow — no absolute
  // positioning, no corner class, no inline left/top. A pointer-down that
  // hasn't yet crossed the drag threshold (drag set, not lifted) still
  // counts as rest, so a bare click never disturbs the layout.
  const isDockedRest = docking && docked && !dockLifted;
  // While LIFTED the panel is `position: fixed` against the VIEWPORT (not
  // reparented — that would remount it and drop the gesture), so it follows
  // the pointer via the viewport-space dockDragPos and is unaffected by its
  // corner stack container collapsing as it leaves the flow. Its siblings
  // reflow into the gap it left.
  const isDockDragging = docking && dockLifted;
  const finalStyle: React.CSSProperties | undefined = isDockedRest
    ? undefined
    : isDockDragging
      ? // Lift just above the resting panels so a dragged panel passes
        // over the others (but stays below toolbars / modals).
        {
          left: px(dockDragPos?.x ?? 0),
          top: px(dockDragPos?.y ?? 0),
          zIndex: 'calc(var(--z-panel) + 1)',
        }
      : style;
  const positionClass = isDockedRest ? 'relative' : isDockDragging ? 'fixed' : 'absolute';
  const finalCornerClass = isDockedRest || isDockDragging ? '' : cornerClass;

  if (asPopover && !popoverShown) return null;

  // A popover: hung from its button with an arrow, no draggable header.
  if (popoverShown) {
    const anchor = popoverAnchor;
    return (
      <div
        ref={ref}
        data-floating-panel=""
        data-tour-id={dataTourId}
        // Panel opacity reaches every panel (docs/specs/007-editor/user-preferences.md), the
        // popovers included. The buttons that open them are not panels and
        // stay opaque.
        data-panel-translucent=""
        onPointerDown={(e) => e.stopPropagation()}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        style={{
          ...uiScaleStyle(scale),
          ...(anchor?.bottom !== undefined
            ? {
                bottom: px(anchor.bottom + 12),
                left: px(anchor.left),
                maxHeight: `calc(100% - ${px(anchor.bottom + 24)}px)`,
              }
            : anchor
              ? {
                  top: px(anchor.top + 12),
                  left: px(anchor.left),
                  // Kept on the canvas below its button, as the one above it is: a short canvas
                  // (a phone in landscape, 286px) otherwise ran the Explorer under the tab bar.
                  maxHeight: `calc(100% - ${px(anchor.top + 24)}px)`,
                }
              : { top: px(56), right: px(12) }),
        }}
        className="pointer-events-auto absolute z-[var(--z-toolbar)] flex w-64 max-w-[calc(100vw-2rem)] cursor-default flex-col rounded-lg border border-slate-200 bg-white shadow-lg shadow-slate-900/5 transition-opacity duration-micro dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:shadow-slate-950/40"
      >
        {anchor ? (
          <div
            style={{ left: px(anchor.arrowOffset) - 7 }}
            className={`absolute h-3.5 w-3.5 rotate-45 border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 ${
              anchor.bottom !== undefined
                ? '-bottom-[7px] rounded-br-sm border-b border-r'
                : '-top-[7px] rounded-tl-sm border-l border-t'
            }`}
          />
        ) : null}
        {/* The popover has no draggable title row, so render a slim header
            band to keep the header options (panel title, headerExtra, and
            headerActions like the Explorer's "New" button) reachable.
            Reset-position / drag affordances are intentionally omitted:
            a popover doesn't drag. */}
        <div className="flex items-center justify-between gap-2 rounded-t-lg border-b border-slate-200 px-2 py-1.5 dark:border-slate-800">
          <span className="flex min-w-0 items-center gap-1.5">
            <PanelTitle title={title} />
            {titleAdornment}
          </span>
          {headerExtra || headerActions || (helpArticle && !minimalChrome) ? (
            <div className="ml-auto flex items-center gap-1">
              {headerExtra}
              {headerActions}
              {helpArticle && !minimalChrome ? <HelpArticleLink article={helpArticle} /> : null}
            </div>
          ) : null}
        </div>
        <div className={`min-h-0 overflow-y-auto overflow-x-hidden ${flushTop ? '' : 'pt-2'}`}>
          {children}
        </div>
      </div>
    );
  }

  // Progressive disclosure: the header's reset-position button renders only
  // once the panel has left its default spot (free-dragged, or docked into
  // a corner other than its home), so a never-rearranged layout keeps a
  // minimal header. 'top-right-stacked' panels home to the top-right stack;
  // 'top-banner' never equals a dock corner, so a docked banner-default
  // panel keeps its reset (the conservative fallback).
  const homeCorner = defaultCorner === 'top-right-stacked' ? 'top-right' : defaultCorner;
  const atDefaultSpot =
    position === null && (!docked || !dockedCorner || dockedCorner === homeCorner);

  return (
    <div
      ref={ref}
      data-floating-panel=""
      data-tour-id={dataTourId}
      // Marks the panel as opacity-controlled: globals.css applies the
      // user's --lvd-panel-opacity here (docs/specs/007-editor/user-preferences.md) and restores it to
      // opaque on hover / focus. The popover branch above carries it too.
      data-panel-translucent=""
      onPointerDown={(e) => e.stopPropagation()}
      onContextMenu={(e) => {
        // Swallow the right-click so it doesn't bubble to the canvas
        // (which would open the tab-level context menu underneath
        // this panel). Also stops the native browser menu inside
        // panels, which would feel out of place in editor chrome.
        e.preventDefault();
        e.stopPropagation();
      }}
      style={{ ...uiScaleStyle(scale), ...finalStyle }}
      // cursor-default so the panel body doesn't inherit the canvas's
      // grab cursor (the panel is a DOM descendant of the pannable
      // canvas surface); the header re-asserts cursor-grab since that's
      // the only part you can drag. When docked at rest the panel is a
      // static flex child of its corner stack (no absolute / corner class).
      className={`pointer-events-auto ${positionClass} ${elevated ? 'z-[calc(var(--z-panel)+1)]' : 'z-[var(--z-panel)]'} flex cursor-default ${width} flex-col rounded-lg border border-slate-200 bg-white shadow-lg shadow-slate-900/5 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:shadow-slate-950/40 ${finalCornerClass}`}
    >
      <MovablePanelHeader
        headerRef={headerRef}
        beginDrag={beginDrag}
        dragging={drag !== null}
        title={title}
        headerExtra={headerExtra}
        titleAdornment={titleAdornment}
        headerActions={headerActions}
        helpArticle={helpArticle}
        onReset={atDefaultSpot ? undefined : onReset}
        collapsible={collapsible}
        effectiveCollapsed={collapsed}
        onToggleCollapsed={() => setCollapsed((v) => !v)}
        onMinimize={onMinimize}
      />
      {/* Body. Children can use flex utilities to lay themselves out
          inside the panel's intrinsic width. Each panel handles its
          own internal scrolling so the body doesn't grow unbounded
          on long lists. When `collapsible` is true the body collapses
          via a grid-template-rows transition so it slides open / shut
          rather than popping (`hidden` had no transition; on mobile
          the abrupt swap was hard to follow as the panel chrome
          jumped to its new size). The grid child uses `overflow-y-auto`
          so long content scrolls; `grid-rows-[0fr]` still collapses it
          to 0px because the grid track constrains the child height. */}
      <div
        className={
          'grid transition-[grid-template-rows] duration-short ease-out ' +
          (collapsible && collapsed ? 'grid-rows-[0fr]' : 'grid-rows-[1fr]')
        }
        aria-hidden={collapsible && collapsed ? true : undefined}
      >
        <div
          style={!growBody && bodyMaxH !== null ? { maxHeight: px(bodyMaxH) } : undefined}
          // Horizontal overflow is always CLIPPED: panels are fixed-width by
          // design, so any x-overflow is a row failing to truncate (e.g. a
          // long document name), and a horizontal scrollbar would surface the
          // bug instead of containing it.
          // `overflow-hidden` is required for the grid-rows-[0fr] collapse to
          // actually clip the body: without an overflow set, the grid item's
          // min-content height keeps the `0fr` track from shrinking, so a
          // collapsible growBody panel (the Palette) toggled `collapsed` but
          // never visually collapsed. The scrolling (non-growBody) panels get
          // their clip from `overflow-y-auto`; growBody panels size to their
          // content, so plain `overflow-hidden` clips on collapse without
          // adding a scrollbar when expanded.
          className={
            growBody ? 'overflow-hidden' : 'scrollbar-slim overflow-y-auto overflow-x-hidden'
          }
        >
          <div className={`flex flex-col ${flushTop ? '' : 'pt-1'}`}>{children}</div>
        </div>
      </div>
    </div>
  );
}
