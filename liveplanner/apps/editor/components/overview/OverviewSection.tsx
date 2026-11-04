import type { ReactNode } from 'react';
import { PlusIcon } from '@liveplanner/ui';

// A section of the Overview: its heading and a short muted line under it, anything on the heading's right, then its
// body.
export function OverviewSection({
  id,
  title,
  subtitle,
  action,
  children,
}: {
  id: string;
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="flex min-w-0 flex-col gap-4">
      <div className="flex min-h-8 items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h2 id={id} className="text-base font-semibold text-slate-900 dark:text-slate-100">
            {title}
          </h2>
          {subtitle ? (
            <p className="text-[13px] text-slate-500 dark:text-slate-400">{subtitle}</p>
          ) : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

// The Overview's bands (docs/specs/026-plan/plan-overview.md "Bands"): each section on a surface of its own, so they
// stand apart. `plain` is the page's backdrop; `wash` a soft wash of the accent (the brand ramp, which is the
// Overview theme's accent while it is open) with a hairline of it at each edge; `panel` the third band below `lg` and,
// from `lg`, the side panel's quiet raised surface. `foot` keeps room at the band's foot for the dock (`lg`: from lg).
const BAND_TONE = {
  plain: '',
  wash: 'border-y border-brand-100 bg-brand-50/70 dark:border-brand-400/15 dark:bg-brand-400/[0.06]',
  panel:
    'lg:border-l lg:border-slate-200 lg:bg-white/70 lg:px-8 dark:lg:border-slate-800 dark:lg:bg-slate-900/60',
} as const;
const BAND_FOOT = {
  always: 'pb-[calc(6rem+env(safe-area-inset-bottom))]',
  lg: 'lg:pb-[calc(6rem+env(safe-area-inset-bottom))]',
} as const;

export function OverviewBand({
  tone,
  foot,
  children,
}: {
  tone: keyof typeof BAND_TONE;
  foot?: keyof typeof BAND_FOOT;
  children: ReactNode;
}) {
  return (
    <div
      data-overview-band={tone}
      className={`min-w-0 px-4 py-8 sm:px-10 sm:py-10 ${BAND_TONE[tone]} ${foot ? BAND_FOOT[foot] : ''}`}
    >
      {children}
    </div>
  );
}

// The look every tile shares: a raised card that lifts its border on hover when it is a button.
export const TILE_CLASS =
  'overflow-hidden rounded-xl border border-slate-200 bg-white text-left text-slate-900 shadow-sm transition dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100';
export const TILE_PRESSABLE =
  'cursor-pointer hover:border-brand-300 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 dark:hover:border-brand-500/60';

// The dashed "add" tile that closes a grid (docs/specs/026-plan/plan-overview.md "Tabs", "Card Types"): a calm dashed
// tile, a plus in a soft brand circle over its label and a hint, the whole tile one button. Hover brightens its border
// and wash and lifts the circle's tint; nothing in it moves. `below` is a row of extra controls under the button's
// face (the Add Tab tile's kind chips), outside the button so they stay buttons of their own; `face` sizes the face
// (the Add Tab tile's matches a tab's 16:10 preview).
export function AddTile({
  label,
  hint,
  onClick,
  face = '',
  below,
  className = '',
}: {
  label: string;
  hint?: string;
  onClick: () => void;
  face?: string;
  below?: ReactNode;
  className?: string;
}) {
  return (
    <div
      data-add-tile=""
      className={`group relative flex flex-col overflow-hidden rounded-xl border-[1.5px] border-dashed border-slate-300 bg-white/40 transition hover:border-brand-400 hover:bg-brand-50/70 has-[:focus-visible]:border-brand-400 dark:border-slate-700 dark:bg-slate-900/30 dark:hover:border-brand-500/60 dark:hover:bg-brand-500/10 ${className}`}
    >
      <button
        type="button"
        onClick={onClick}
        className={`flex flex-1 cursor-pointer flex-col items-center justify-center gap-2 p-4 text-center focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-600 ${below ? 'rounded-t-xl' : 'rounded-xl'} ${face}`}
      >
        <span
          aria-hidden
          className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-50 text-brand-700 ring-1 ring-brand-200 transition group-hover:bg-brand-100 group-hover:ring-brand-300 dark:bg-brand-500/15 dark:text-brand-300 dark:ring-brand-500/30 dark:group-hover:bg-brand-500/25"
        >
          <PlusIcon size={18} />
        </span>
        <span className="text-[13px] font-semibold text-slate-800 dark:text-slate-100">
          {label}
        </span>
        {hint ? <span className="text-xs text-slate-500 dark:text-slate-400">{hint}</span> : null}
      </button>
      {below}
    </div>
  );
}
