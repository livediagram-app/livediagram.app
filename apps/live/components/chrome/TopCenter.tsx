import type {
  CSSProperties,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
  ReactNode,
} from 'react';

// Shared top-centre overlay region (spec/09). Every floating status pill
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

type BannerTone = 'neutral' | 'brand' | 'danger';

const TONE_CLASS: Record<BannerTone, string> = {
  neutral:
    'border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100',
  brand:
    'border-brand-200 bg-brand-50 text-brand-800 dark:border-brand-500/40 dark:bg-brand-500/15 dark:text-brand-100',
  danger:
    'border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/15 dark:text-rose-200',
};

// The positioned container: pinned to the top centre, above the canvas,
// laying its children out as a column of rows that never overlap. On
// mobile it anchors to the top LEFT (`left-3`, left-aligned) so it clears
// the mobile dock buttons that sit at the top right; from `sm:` up it
// centres (`sm:left-1/2 -translate-x-1/2`). `pointer-events-none` so the
// gaps between pills stay click-through; each pill re-enables pointer
// events for itself.
export function TopCenterStack({ children }: { children: ReactNode }) {
  return (
    // On mobile this stack starts BELOW the dock rather than beside it. Both
    // used to sit at top-3, and the stack spans the full width, so anything
    // wide enough — the vote-results banner, the timer pill, the mode banners
    // — ran underneath the dock buttons and covered them. Reserving width
    // instead was the obvious alternative and doesn't work: the dock's width
    // changes with its button count (Collaborate, AI, Poll and Vote all come
    // and go), while its height is a stable single row. 4.75rem clears the
    // dock's 12px top + 57px height with a small gap; revisit it if the dock
    // ever becomes two rows. From sm: up the stack is centred and the dock is
    // hidden (or, with minimal panels, far to the right), so it goes back to
    // top-3.
    //
    // Right-aligned on mobile, not left: these sit UNDER the dock, which is
    // itself pinned top-right, so lining them up with it keeps the pair
    // reading as one column of chrome instead of a banner adrift on the
    // opposite side of the canvas.
    //
    // It also drops BELOW the dock popovers on mobile (z-panel, under the
    // popovers' z-toolbar) so opening a panel simply covers the banners
    // instead of them punching through it. Desktop keeps z-chrome, where the
    // stack is centred and nothing overlaps it.
    <div className="pointer-events-none absolute right-3 top-[4.75rem] z-[var(--z-panel)] flex max-w-[calc(100%-1.5rem)] flex-col items-end gap-2 sm:left-1/2 sm:right-auto sm:top-3 sm:z-[var(--z-chrome)] sm:-translate-x-1/2 sm:items-center">
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
  // uses it to paint a draining background gradient (spec/39) — done as
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
