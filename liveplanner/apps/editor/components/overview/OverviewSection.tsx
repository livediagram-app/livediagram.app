import type { ReactNode } from 'react';
import { PlusIcon } from '@liveplanner/ui';

// A section of the Overview: its heading, anything on the heading's right, then its body.
export function OverviewSection({
  id,
  title,
  action,
  children,
}: {
  id: string;
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="flex min-w-0 flex-col gap-3">
      <div className="flex min-h-8 items-center justify-between gap-3">
        <h2 id={id} className="text-[15px] font-semibold text-slate-900 dark:text-slate-100">
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

// The look every tile shares: a raised card that lifts its border on hover when it is a button.
export const TILE_CLASS =
  'overflow-hidden rounded-xl border border-slate-200 bg-white text-left text-slate-900 shadow-sm transition dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100';
export const TILE_PRESSABLE =
  'cursor-pointer hover:border-brand-300 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 dark:hover:border-brand-500/60';

// The dashed "add" tile that closes a grid.
export function AddTile({
  label,
  hint,
  onClick,
  className = '',
}: {
  label: string;
  hint?: string;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border-[1.5px] border-dashed border-slate-300 p-4 text-[13px] font-semibold text-brand-700 transition hover:border-brand-400 hover:bg-brand-50/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 dark:border-slate-700 dark:text-brand-300 dark:hover:border-brand-500/60 dark:hover:bg-brand-500/10 ${className}`}
    >
      <PlusIcon size={18} />
      {label}
      {hint ? (
        <span className="text-xs font-normal text-slate-500 dark:text-slate-400">{hint}</span>
      ) : null}
    </button>
  );
}
