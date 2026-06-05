'use client';

import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';
import { useClickOutside } from '@/hooks/useClickOutside';
import { MOBILE_BREAKPOINT_PX, isMobileViewportSync } from '@/lib/responsive';
import { Tooltip } from './Tooltip';

type MovablePanelProps = {
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
  // dynamically beneath another resizable panel (the Editor /
  // ContextPanel sitting below the Palette, which now changes height
  // as accordions open / close). User drags break out of stacking
  // (position becomes non-null and explicit left/top win).
  stackBelowY?: number;
  // Optional ResizeObserver-driven callback fired with the panel's
  // current bounding box when it mounts and every time its size
  // changes. The Palette uses this so the ContextPanel can stack
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
  // When true the panel is forced expanded and tap-to-collapse on
  // mobile is disabled. Used while the user is renaming a child row
  // or working through a confirm modal — collapsing in the middle of
  // those flows hides the rename input / the diagram context for the
  // modal, which is disorienting on a phone. Caller tracks the
  // "in-flight" state and flips this on for the duration.
  lockOpen?: boolean;
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
  // always-visible Editor pane above it).
  defaultCollapsed?: boolean;
  // Counter the parent bumps whenever it wants to force the banner
  // open (e.g. navigating to a theme accordion from an Activity row).
  // Only meaningful with `collapsible`. On every change of this value
  // the local collapsed state resets to false; mount value is ignored
  // so the panel still picks its viewport-driven default on first
  // render. Optional; callers that don't need imperative open omit it.
  expandSignal?: number;
  // Mobile dock mode. When true: force the panel open and position it
  // below the dock bar (using mobileTopOverridePx as the top offset).
  // When false: render nothing on mobile so the dock button is the
  // only affordance. When undefined: existing self-managed behaviour.
  mobileOpenOverride?: boolean;
  // Called when the user taps the collapse/minimize button while the
  // panel is dock-controlled. The dock should deactivate this panel.
  onMobileClose?: () => void;
  mobileDockAnchor?: { left: number; top: number; arrowOffset: number };
  children: ReactNode;
};

// Floating, draggable panel pinned over the canvas. The header row is the
// drag handle; a minimize button collapses the panel into a dock button
// (which the caller renders elsewhere — see Canvas's bottom dock).
//
// Width is fixed at construction time (via the `width` Tailwind utility)
// and the body grows with its content. No user-driven resize — keeping
// the panels uniformly-sized makes the chrome easier to reason about.
export function MovablePanel({
  title,
  position,
  defaultCorner,
  width = 'w-56',
  headerExtra,
  onReset,
  onMoveTo,
  onMinimize,
  stackBelowY,
  onSize,
  mobileTopOverridePx,
  lockOpen = false,
  outsideExceptSelector,
  collapsible = false,
  defaultCollapsed = false,
  expandSignal,
  mobileOpenOverride,
  onMobileClose,
  mobileDockAnchor,
  children,
}: MovablePanelProps) {
  const ref = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  // Max height for the panel body so it never extends below the viewport.
  // Recomputed on mount, on resize, and whenever the panel's position
  // changes (drag end updates `position`; stackBelowY changes move it too).
  const [bodyMaxH, setBodyMaxH] = useState<number | null>(null);
  const [drag, setDrag] = useState<{
    startClientX: number;
    startClientY: number;
    startX: number;
    startY: number;
  } | null>(null);
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
  // Reactive mobile flag so a viewport rotation / desktop->mobile
  // resize re-applies the mobileTopOverridePx inline-style. Initial
  // value reads sync to avoid a one-frame flicker.
  const [isMobile, setIsMobile] = useState(isMobileViewportSync);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia?.(`(max-width: ${MOBILE_BREAKPOINT_PX - 1}px)`);
    if (!mq) return;
    const onChange = () => setIsMobile(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  // Constrain panel body to the remaining viewport space below its header.
  // Uses rAF so the panel has painted at its new position before we measure.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const compute = () => {
      const panel = ref.current;
      if (!panel) return;
      const panelTop = panel.getBoundingClientRect().top;
      const headerH = headerRef.current?.getBoundingClientRect().height ?? 36;
      setBodyMaxH(Math.max(window.innerHeight - panelTop - headerH - 16, 80));
    };
    const raf = requestAnimationFrame(compute);
    window.addEventListener('resize', compute);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', compute);
    };
    // Re-measure after drag (position changes) or dynamic stacking (stackBelowY changes).
  }, [position, stackBelowY]);

  // Publish the panel's bounding box upward whenever it changes
  // (the Palette uses this so the ContextPanel can stack below).
  // Cheap when no caller subscribes: the observer just never fires
  // a callback if `onSize` is undefined.
  useEffect(() => {
    if (!onSize) return;
    const node = ref.current;
    if (!node) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const rect = entry.contentRect;
      // offsetTop + offsetHeight gives the bottom edge in the
      // offsetParent's coordinate space. Both the Palette and the
      // stacked Editor share the same offsetParent (Canvas's main
      // element), so handing this value back as `stackBelowY` lets
      // the lower panel align below regardless of the upper panel's
      // own top-utility class.
      onSize({
        width: rect.width,
        height: rect.height,
        bottomY: node.offsetTop + node.offsetHeight,
      });
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [onSize]);

  useEffect(() => {
    if (!drag) return;
    const onMove = (e: PointerEvent) => {
      onMoveTo(
        drag.startX + (e.clientX - drag.startClientX),
        drag.startY + (e.clientY - drag.startClientY),
      );
    };
    const onUp = () => setDrag(null);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [drag, onMoveTo]);

  const beginDrag = (e: ReactPointerEvent) => {
    // Collapsible panels in their collapsed (banner) state treat the
    // entire title row as a tap target: clicking anywhere on the
    // banner expands the body, regardless of input device, because
    // the visible chrome is the banner row itself and pointing at it
    // is the most direct "open me" gesture. The +/- button still
    // works for explicit users. Mobile (touch) on an EXPANDED panel
    // also taps-to-collapse (a 375 px viewport has nowhere useful to
    // drag the panel to anyway, so the gesture is repurposed). On
    // desktop the expanded panel keeps drag semantics on the title
    // row, the +/- button is the collapse path.
    if (collapsible && collapsed) {
      e.stopPropagation();
      setCollapsed(false);
      return;
    }
    // Tap-to-collapse on mobile, except while the parent has locked
    // the panel open or the dock is controlling this panel (dock
    // button is the collapse affordance in that case).
    if (collapsible && e.pointerType === 'touch' && !lockOpen && mobileOpenOverride === undefined) {
      e.stopPropagation();
      setCollapsed(true);
      return;
    }
    e.stopPropagation();
    const node = ref.current;
    if (!node) return;
    const startX = node.offsetLeft;
    const startY = node.offsetTop;
    // If the panel hasn't been positioned yet, freeze the current corner
    // position so subsequent deltas don't snap it to (0,0).
    if (position === null) onMoveTo(startX, startY);
    setDrag({ startClientX: e.clientX, startClientY: e.clientY, startX, startY });
  };

  const dockControlledOpen = isMobile && mobileOpenOverride === true;
  // Dock-controlled on mobile: hide when not active, force open when active.
  const effectiveCollapsed = dockControlledOpen ? false : collapsed;

  // Imperative open from the parent. Whenever `expandSignal` changes
  // (compared to the value cached in the ref) we reset the local
  // collapsed state to false. The ref starts at the initial value so
  // the first render doesn't fire the effect (which would override
  // the viewport-driven mobile-default-collapsed initial state).
  const lastExpandSignalRef = useRef(expandSignal);
  useEffect(() => {
    if (!collapsible) return;
    if (expandSignal === lastExpandSignalRef.current) return;
    lastExpandSignalRef.current = expandSignal;
    setCollapsed(false);
  }, [collapsible, expandSignal]);

  // Outside-tap auto-close. Active only while the banner is
  // expanded on mobile; the matchMedia gate skips the listener on
  // desktop where the user is in control of when to close. Also
  // disabled while the parent has locked the panel open — the
  // outside-tap is most often a child portal-menu item (Rename,
  // Delete) and treating that as "user wants to dismiss the
  // panel" hides the rename input the same tap is about to mount.
  useClickOutside(
    ref,
    () => {
      if (dockControlledOpen) {
        onMobileClose?.();
      } else {
        setCollapsed(true);
      }
    },
    isMobile &&
      (dockControlledOpen ||
        (collapsible && !effectiveCollapsed && !lockOpen && mobileOpenOverride === undefined)),
    dockControlledOpen
      ? outsideExceptSelector
        ? `[data-mobile-dock],${outsideExceptSelector}`
        : '[data-mobile-dock]'
      : outsideExceptSelector,
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
  const style: React.CSSProperties = dockControlledOpen
    ? {}
    : position
      ? { left: position.x, top: position.y }
      : useDynamicStack
        ? { top: stackBelowY + stackGapPx }
        : isMobile && mobileTopOverridePx !== undefined && defaultCorner === 'top-right'
          ? { top: mobileTopOverridePx }
          : {};
  const cornerClass = dockControlledOpen
    ? ''
    : position
      ? ''
      : useDynamicStack
        ? 'inset-x-2 sm:left-auto sm:right-4'
        : defaultCorner === 'top-right'
          ? 'inset-x-2 top-2 sm:inset-x-auto sm:right-4 sm:top-4'
          : defaultCorner === 'top-right-stacked'
            ? 'inset-x-2 top-[15rem] sm:inset-x-auto sm:right-4'
            : defaultCorner === 'top-banner'
              ? 'inset-x-2 top-2'
              : defaultCorner === 'bottom-left'
                ? 'bottom-4 left-4'
                : defaultCorner === 'bottom-right'
                  ? 'bottom-4 right-4'
                  : 'left-4 top-4';

  if (isMobile && mobileOpenOverride === false) return null;

  // Dock-controlled on mobile: render as a popover with arrow, no header.
  if (dockControlledOpen) {
    const anchor = mobileDockAnchor;
    return (
      <div
        ref={ref}
        onPointerDown={(e) => e.stopPropagation()}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        style={anchor ? { top: anchor.top + 8, left: anchor.left } : { top: 50, right: 8 }}
        className="pointer-events-auto absolute z-20 flex w-64 max-w-[calc(100vw-1rem)] cursor-default flex-col rounded-lg border border-slate-200 bg-white shadow-lg shadow-slate-900/5 transition-opacity duration-150 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:shadow-slate-950/40"
      >
        {anchor ? (
          <div
            style={{ left: anchor.arrowOffset - 7 }}
            className="absolute -top-[7px] h-3.5 w-3.5 rotate-45 rounded-tl-sm border-l border-t border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
          />
        ) : null}
        <div className="overflow-y-auto pt-2">{children}</div>
      </div>
    );
  }

  return (
    <div
      ref={ref}
      onPointerDown={(e) => e.stopPropagation()}
      onContextMenu={(e) => {
        // Swallow the right-click so it doesn't bubble to the canvas
        // (which would open the tab-level context menu underneath
        // this panel). Also stops the native browser menu inside
        // panels, which would feel out of place in editor chrome.
        e.preventDefault();
        e.stopPropagation();
      }}
      style={style}
      // cursor-default so the panel body doesn't inherit the canvas's
      // grab cursor (the panel is a DOM descendant of the pannable
      // canvas surface); the header re-asserts cursor-grab since that's
      // the only part you can drag.
      className={`pointer-events-auto absolute z-10 flex animate-pop-in cursor-default ${width} flex-col rounded-lg border border-slate-200 bg-white shadow-lg shadow-slate-900/5 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:shadow-slate-950/40 ${cornerClass}`}
    >
      <div
        ref={headerRef}
        onPointerDown={beginDrag}
        className={`flex items-center justify-between gap-2 rounded-t-lg border-b border-slate-200 px-2 pt-2 pb-1.5 dark:border-slate-800 ${drag ? 'cursor-grabbing' : 'cursor-grab'}`}
      >
        <span className="select-none text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-200">
          {title}
        </span>
        {headerExtra ? (
          <div
            onPointerDown={(e) => e.stopPropagation()}
            className="ml-auto mr-1 flex items-center"
          >
            {headerExtra}
          </div>
        ) : null}
        <div className="flex items-center gap-0.5">
          {onReset ? (
            // Hidden on mobile: drag-to-move isn't available on touch
            // (the title row is repurposed as a tap-to-collapse target,
            // see beginDrag above), so a reset-position affordance has
            // nothing to reset. The button reappears on `sm:` and up
            // where dragging the title row pans the panel.
            <Tooltip title="Reset position" description="Snap back to the default corner.">
              <button
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={onReset}
                aria-label={`Reset ${title.toLowerCase()} position`}
                className="hidden h-5 w-5 items-center justify-center rounded text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 sm:flex dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100"
              >
                <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden fill="none">
                  {/* A diagonal arrow tucking back into a corner — a
                      familiar "snap-back" / restore glyph used in
                      window-manager toolbars. */}
                  <path
                    d="M6.5 3H9v2.5"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M9 3L5 7"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    strokeLinecap="round"
                  />
                  <path
                    d="M3 7v2h6"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </Tooltip>
          ) : null}
          <Tooltip
            title={
              collapsible
                ? effectiveCollapsed
                  ? `Expand ${title.toLowerCase()}`
                  : `Collapse ${title.toLowerCase()}`
                : `Minimize ${title.toLowerCase()}`
            }
            description={
              collapsible
                ? effectiveCollapsed
                  ? 'Show the panel body.'
                  : 'Hide the panel body, keep the banner.'
                : 'Collapse to a dock button.'
            }
          >
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => {
                if (dockControlledOpen) {
                  onMobileClose?.();
                  return;
                }
                if (collapsible) {
                  setCollapsed((v) => !v);
                  return;
                }
                onMinimize?.();
              }}
              aria-label={
                collapsible
                  ? effectiveCollapsed
                    ? `Expand ${title.toLowerCase()}`
                    : `Collapse ${title.toLowerCase()}`
                  : `Minimize ${title.toLowerCase()}`
              }
              className="flex h-5 w-5 items-center justify-center rounded text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100"
            >
              {collapsible && effectiveCollapsed ? (
                // Plus glyph: expand the body. Same 12 x 12 grid as
                // the dash so the button slot doesn't visually
                // jitter when the icon flips.
                <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
                  <line
                    x1="6"
                    y1="2.5"
                    x2="6"
                    y2="9.5"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                  <line
                    x1="2.5"
                    y1="6"
                    x2="9.5"
                    y2="6"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
              ) : (
                <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
                  <line
                    x1="2.5"
                    y1="6"
                    x2="9.5"
                    y2="6"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
              )}
            </button>
          </Tooltip>
        </div>
      </div>
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
          'grid transition-[grid-template-rows] duration-200 ease-out ' +
          (collapsible && effectiveCollapsed ? 'grid-rows-[0fr]' : 'grid-rows-[1fr]')
        }
        aria-hidden={collapsible && effectiveCollapsed ? true : undefined}
      >
        <div
          style={bodyMaxH !== null ? { maxHeight: bodyMaxH } : undefined}
          className="overflow-y-auto [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-200 dark:[&::-webkit-scrollbar-thumb]:bg-slate-700"
        >
          <div className="flex flex-col">{children}</div>
        </div>
      </div>
    </div>
  );
}

// Round dock button rendered next to the zoom controls when a MovablePanel
// is minimised. Same visual language as ZoomControls' IconButton but
// pill-shaped so it reads as a distinct entry-point.
export function DockButton({
  label,
  description,
  icon,
  onClick,
}: {
  label: string;
  description: string;
  icon: ReactNode;
  onClick: () => void;
}) {
  return (
    <Tooltip title={label} description={description}>
      <button
        type="button"
        onPointerDown={(e) => e.stopPropagation()}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        onClick={onClick}
        aria-label={label}
        className="pointer-events-auto flex h-11 w-11 animate-pop-in items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-lg shadow-slate-900/5 transition hover:bg-slate-50 hover:text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
      >
        {icon}
      </button>
    </Tooltip>
  );
}
