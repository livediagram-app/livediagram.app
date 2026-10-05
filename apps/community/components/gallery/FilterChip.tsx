import type { ReactNode } from 'react';

// One toggle chip in the gallery's filter rows (blueprint §10: a button with aria-pressed). Padding
// sizes it, so its label keeps a full line box and no optical correction is needed.
export function FilterChip({
  pressed,
  onClick,
  children,
  count,
}: {
  pressed: boolean;
  onClick: () => void;
  children: ReactNode;
  count?: number;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors duration-micro focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 ${
        pressed
          ? 'border-brand-500 bg-brand-500 text-white shadow-sm shadow-brand-500/25 dark:border-brand-400 dark:bg-brand-500/90'
          : 'border-slate-200 bg-white text-slate-700 hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-brand-500/50 dark:hover:bg-slate-800 dark:hover:text-brand-200'
      }`}
    >
      {children}
      {count !== undefined ? (
        <span
          className={`text-xs tabular-nums ${pressed ? 'text-white/80' : 'text-slate-400 dark:text-slate-500'}`}
        >
          {count}
        </span>
      ) : null}
    </button>
  );
}
