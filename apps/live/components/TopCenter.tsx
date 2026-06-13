import type {
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

export type BannerTone = 'neutral' | 'brand' | 'danger';

const TONE_CLASS: Record<BannerTone, string> = {
  neutral:
    'border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100',
  brand:
    'border-brand-200 bg-brand-50 text-brand-800 dark:border-brand-500/40 dark:bg-brand-500/15 dark:text-brand-100',
  danger:
    'border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/15 dark:text-rose-200',
};

// The positioned container: pinned to the top centre, above the canvas,
// laying its children out as a centred column of rows that never overlap.
// `pointer-events-none` so the gaps between pills stay click-through; each
// pill re-enables pointer events for itself.
export function TopCenterStack({ children }: { children: ReactNode }) {
  return (
    <div className="pointer-events-none absolute left-1/2 top-3 z-30 flex max-w-[calc(100%-1.5rem)] -translate-x-1/2 flex-col items-center gap-2">
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
      className={`flex flex-wrap items-start justify-center gap-2${className ? ` ${className}` : ''}`}
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
  onPointerDown,
  onContextMenu,
  children,
}: {
  tone?: BannerTone;
  className?: string;
  onPointerDown?: (e: ReactPointerEvent) => void;
  onContextMenu?: (e: ReactMouseEvent) => void;
  children: ReactNode;
}) {
  return (
    <div
      onPointerDown={onPointerDown}
      onContextMenu={onContextMenu}
      className={`pointer-events-auto flex animate-fade-in items-center rounded-full border shadow-md ${TONE_CLASS[tone]}${className ? ` ${className}` : ''}`}
    >
      {children}
    </div>
  );
}
