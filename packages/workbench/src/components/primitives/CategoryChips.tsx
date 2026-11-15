'use client';

// A row of category chips, each with its count, one pressed at a time (All first, by the caller's list): the layout
// gallery's categories and a logo page's display library. The row scrolls sideways rather than wrapping, unless
// `wrap` is set for a narrow home (a menu flyout), where a hidden chip could not be reached with a mouse wheel.

export type CategoryChip = { id: string; label: string; count: number };

export function CategoryChips({
  chips,
  value,
  onChoose,
  ariaLabel,
  wrap = false,
}: {
  chips: readonly CategoryChip[];
  value: string;
  onChoose: (id: string) => void;
  ariaLabel: string;
  wrap?: boolean;
}) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={
        wrap
          ? 'flex shrink-0 flex-wrap gap-1.5'
          : '-mx-1 flex shrink-0 gap-1.5 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'
      }
    >
      {chips.map((c) => {
        const on = c.id === value;
        return (
          <button
            key={c.id}
            type="button"
            aria-pressed={on}
            onClick={() => onChoose(c.id)}
            className={`flex shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium transition focus-visible:outline-2 focus-visible:outline-brand-600 ${
              on
                ? 'bg-brand-700 text-white shadow-sm dark:bg-brand-600'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            {c.label}
            <span
              className={`tabular-nums text-[10px] ${on ? 'text-white/80' : 'text-slate-500 dark:text-slate-400'}`}
            >
              {c.count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
