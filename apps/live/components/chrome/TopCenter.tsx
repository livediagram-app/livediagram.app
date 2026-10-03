import type {
  CSSProperties,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
  ReactNode,
} from 'react';
import { SOLID_BRAND_DARK } from '@livediagram/ui';

// Shared top-centre overlay region (docs/specs/008-canvas/canvas-and-palette.md). Every floating status pill
// that belongs at the top middle of the canvas — the owner / role badge,
// the editor mode banners (format painter, group, draw), the
// multi-selection toolbar, the session timer and the vote banner — used
// to pin itself independently to `left-1/2 top-X -translate-x-1/2`, so
// they overlapped whenever two were visible at once (and each reinvented
// the same pill chrome with minute differences). They now render as
// children of a single `TopCenterStack`, which lays them out as one
// centred, wrapping column. Within a row, items sit alongside each other
// on desktop and wrap underneath on narrow / mobile widths — exactly the
// "alongside, or under on mobile" behaviour the timer needs next to a
// banner.

type BannerTone = 'neutral' | 'brand' | 'live' | 'danger';

const TONE_CLASS: Record<BannerTone, string> = {
  neutral:
    'border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100',
  brand:
    'border-brand-200 bg-brand-50 text-brand-800 dark:border-brand-500/40 dark:bg-brand-500/15 dark:text-brand-100',
  // Solid, for a pill that reports something HAPPENING to your view right now
  // (being followed along, docs/specs/012-collaboration/follow-me-viewport.md) rather than a mode you turned on. It is
  // meant to be the loudest thing on the canvas until you stop it.
  live: `border-brand-500 bg-brand-500 text-white ${SOLID_BRAND_DARK}`,
  danger:
    'border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/15 dark:text-rose-200',
};

// The positioned container: pinned to the top centre, above the canvas,
// laying its children out as a column of rows that never overlap. On
// mobile it anchors to the top RIGHT (`right-3`, right-aligned), under the
// top row of chrome; from `sm:` up it centres (`sm:left-1/2 -translate-x-1/2`). `pointer-events-none` so the
// gaps between pills stay click-through; each pill re-enables pointer
// events for itself.
const STACK_TOP: Record<'toolbar' | 'dock' | 'none', string> = {
  toolbar: 'top-[4.25rem]',
  dock: 'top-[4.75rem]',
  none: 'top-[4.75rem] sm:top-3',
};

export function TopCenterStack({
  children,
  below,
}: {
  children: ReactNode;
  // A bar across the top of the canvas owns top-3, so the stack starts under it instead of on top
  // of it: the Toolbar layout's strip (docs/specs/007-editor/toolbar-layout.md, 46 px), or a
  // whiteboard's dock at the top (docs/specs/023-draw-mode/draw-mode.md "Where the dock sits",
  // 54 px).
  below?: 'toolbar' | 'dock';
}) {
  return (
    // On mobile this stack starts BELOW the top row of chrome rather than
    // beside it: the stack spans the full width, so anything wide enough (the
    // vote-results banner, the timer pill, the mode banners) would otherwise
    // run under the Toolbar strip, or a read-only visitor's menu button, and
    // cover it. From sm: up the stack is centred and goes back to top-3,
    // unless the Toolbar strip owns that row.
    //
    // It also drops BELOW the popovers on mobile (z-panel, under the
    // popovers' z-toolbar) so opening a panel simply covers the banners
    // instead of them punching through it. Desktop keeps z-chrome, where the
    // stack is centred and nothing overlaps it.
    <div
      className={`pointer-events-none absolute right-3 z-[var(--z-panel)] flex max-w-[calc(100%-1.5rem)] flex-col items-end gap-2 sm:left-1/2 sm:right-auto ${STACK_TOP[below ?? 'none']} sm:z-[var(--z-chrome)] sm:-translate-x-1/2 sm:items-center`}
    >
      {children}
    </div>
  );
}

// A horizontal group within the stack whose items sit alongside each other
// and wrap onto the next line on narrow widths. Used to keep the timer
// beside the active mode / selection banner (and under it on mobile).
export function TopCenterRow({
  className = '',
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={`flex flex-wrap items-center justify-center gap-2${className ? ` ${className}` : ''}`}
    >
      {children}
    </div>
  );
}

// A single pill. Visual chrome only — positioning comes from the
// surrounding stack / row. Padding, gap and text size vary per pill and
// are passed via `className`; tone picks the shared colour set.
export function TopCenterBanner({
  tone = 'neutral',
  className = '',
  style,
  onPointerDown,
  onContextMenu,
  children,
}: {
  tone?: BannerTone;
  className?: string;
  // Inline styles for effects a class can't express. The countdown pill
  // uses it to paint a draining background gradient (docs/specs/012-collaboration/session-tools.md) — done as
  // a background rather than an absolutely-positioned fill layer so the
  // pill needs no extra DOM and no stacking-context juggling to keep the
  // clock and buttons legible on top.
  style?: CSSProperties;
  onPointerDown?: (e: ReactPointerEvent) => void;
  onContextMenu?: (e: ReactMouseEvent) => void;
  children: ReactNode;
}) {
  return (
    <div
      // Marks this pill as floating UI so the canvas capture-phase
      // pointerdown handler bails before arming a gesture. Without it,
      // pressing a banner control (e.g. the draw-mode Cancel button)
      // while a draw is queued starts a draw-to-size gesture at the
      // button and drops the pending shape there on release; the
      // bubble-phase stopPropagation below can't stop the ancestor
      // capture handler that runs first.
      data-floating-panel=""
      onPointerDown={onPointerDown}
      onContextMenu={onContextMenu}
      style={style}
      className={`pointer-events-auto flex animate-fade-in items-center rounded-full border shadow-md ${TONE_CLASS[tone]}${className ? ` ${className}` : ''}`}
    >
      {children}
    </div>
  );
}
