'use client';

import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';
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
  defaultCorner: 'top-left' | 'top-right' | 'top-right-stacked' | 'bottom-left' | 'bottom-right';
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
  // changes. Used by the Palette to publish its height upward so the
  // ContextPanel can stack below it.
  onSize?: (size: { width: number; height: number }) => void;
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
  // Counter the parent bumps whenever it wants to force the banner
  // open (e.g. navigating to a theme accordion from an Activity row).
  // Only meaningful with `collapsible`. On every change of this value
  // the local collapsed state resets to false; mount value is ignored
  // so the panel still picks its viewport-driven default on first
  // render. Optional; callers that don't need imperative open omit it.
  expandSignal?: number;
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
  collapsible = false,
  expandSignal,
  children,
}: MovablePanelProps) {
  const ref = useRef<HTMLDivElement>(null);
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
  const [collapsed, setCollapsed] = useState(() => collapsible && isMobileViewportSync());

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
      onSize({ width: rect.width, height: rect.height });
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
    if (collapsible && e.pointerType === 'touch') {
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

  // Outside-tap auto-close. Window-level pointerdown listener: when
  // the panel is expanded on mobile AND the user taps anywhere that
  // isn't inside this panel, collapse. Bypassed entirely on desktop
  // (`(min-width: 640px)`) where the user is in control of when to
  // close. Active only while expanded so a collapsed panel doesn't
  // churn listeners on every canvas interaction.
  useEffect(() => {
    if (!collapsible || collapsed) return;
    if (typeof window === 'undefined') return;
    if (window.matchMedia?.(`(min-width: ${MOBILE_BREAKPOINT_PX}px)`).matches) return;
    const onPointerDown = (e: PointerEvent) => {
      const node = ref.current;
      if (!node) return;
      if (e.target instanceof Node && node.contains(e.target)) return;
      setCollapsed(true);
    };
    window.addEventListener('pointerdown', onPointerDown, true);
    return () => window.removeEventListener('pointerdown', onPointerDown, true);
  }, [collapsible, collapsed]);

  // When stackBelowY is provided and we're still at the default
  // corner, use it as a dynamic top (above the panel sitting at
  // its bottom + a 16px gap). Falls back to the static top-[15rem]
  // class when stackBelowY isn't wired (legacy callers, or no
  // measurement yet on first paint).
  const useDynamicStack =
    position === null && defaultCorner === 'top-right-stacked' && stackBelowY !== undefined;
  const style: React.CSSProperties = position
    ? { left: position.x, top: position.y }
    : useDynamicStack
      ? // Vertical only: leave the horizontal pin to a responsive
        // className below so the stacked panel can go full-width on
        // mobile (inset-x-2) and stay pinned to the right edge on
        // desktop (right-4).
        { top: stackBelowY + 16 }
      : {};
  const cornerClass = position
    ? ''
    : useDynamicStack
      ? 'inset-x-2 sm:left-auto sm:right-4'
      : defaultCorner === 'top-right'
        ? // Mobile: pin to the top of the viewport with a small
          // breathing-room margin on each side so a `w-auto sm:w-<size>`
          // palette becomes a banner that doesn't kiss the screen
          // edges. Desktop: original corner.
          'inset-x-2 top-2 sm:inset-x-auto sm:right-4 sm:top-4'
        : defaultCorner === 'top-right-stacked'
          ? // Same mobile-banner rule as `top-right` but using the
            // static fallback top (15rem) instead of the dynamic
            // stackBelowY (which isn't wired here).
            'inset-x-2 top-[15rem] sm:inset-x-auto sm:right-4'
          : defaultCorner === 'bottom-left'
            ? 'bottom-4 left-4'
            : defaultCorner === 'bottom-right'
              ? 'bottom-4 right-4'
              : 'left-4 top-4';

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
      className={`pointer-events-auto absolute z-10 flex animate-pop-in ${width} flex-col rounded-lg border border-slate-200 bg-white shadow-lg shadow-slate-900/5 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:shadow-slate-950/40 ${cornerClass}`}
    >
      <div
        onPointerDown={beginDrag}
        className={`flex items-center justify-between gap-2 rounded-t-lg px-2 pt-2 pb-1.5 ${drag ? 'cursor-grabbing' : 'cursor-grab'}`}
      >
        <span className="select-none text-[10px] font-semibold uppercase tracking-wider text-slate-500">
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
            <Tooltip title="Reset position" description="Snap back to the default corner.">
              <button
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={onReset}
                aria-label={`Reset ${title.toLowerCase()} position`}
                className="flex h-5 w-5 items-center justify-center rounded text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-200"
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
                ? collapsed
                  ? `Expand ${title.toLowerCase()}`
                  : `Collapse ${title.toLowerCase()}`
                : `Minimize ${title.toLowerCase()}`
            }
            description={
              collapsible
                ? collapsed
                  ? 'Show the panel body.'
                  : 'Hide the panel body, keep the banner.'
                : 'Collapse to a dock button.'
            }
          >
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => {
                if (collapsible) {
                  setCollapsed((v) => !v);
                  return;
                }
                onMinimize?.();
              }}
              aria-label={
                collapsible
                  ? collapsed
                    ? `Expand ${title.toLowerCase()}`
                    : `Collapse ${title.toLowerCase()}`
                  : `Minimize ${title.toLowerCase()}`
              }
              className="flex h-5 w-5 items-center justify-center rounded text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            >
              {collapsible && collapsed ? (
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
          on long lists. When `collapsible` is true the body hides
          whenever the user has collapsed it (regardless of viewport). */}
      <div className={`flex flex-col ${collapsible && collapsed ? 'hidden' : ''}`}>{children}</div>
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
