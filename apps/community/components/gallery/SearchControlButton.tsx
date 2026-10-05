import type { ComponentProps, ReactNode } from 'react';
import { ChevronDownIcon } from '@livediagram/ui';

// One of the controls inside the search box (My Shares, Category, Tags, Sort; docs/specs/025-community/
// community.md "Gallery"): an icon and a label, the label dropped on phones so they fit beside the
// text (the accessible name stays). Tinted while it narrows or orders the results. A menu's trigger carries a
// chevron; a plain toggle (My Shares) does not.
export function SearchControlButton({
  icon,
  label,
  active,
  badge,
  open = false,
  chevron = true,
  ...props
}: {
  icon: ReactNode;
  label: string;
  active: boolean;
  // A count shown beside the label (chosen tags).
  badge?: number;
  open?: boolean;
  chevron?: boolean;
} & Omit<ComponentProps<'button'>, 'children'>) {
  return (
    <button
      type="button"
      {...props}
      className={`inline-flex h-8 items-center gap-1.5 rounded-lg px-2 text-sm font-medium transition-colors duration-micro focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-600 sm:px-2.5 ${
        active
          ? 'bg-brand-50 text-brand-700 hover:bg-brand-100 dark:bg-brand-500/15 dark:text-brand-200 dark:hover:bg-brand-500/25'
          : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200'
      }`}
    >
      <span aria-hidden className="flex">
        {icon}
      </span>
      <span className="max-w-32 truncate max-sm:hidden">{label}</span>
      {badge ? (
        <span className="rounded-full bg-brand-500 px-1.5 text-[11px] font-semibold leading-4 text-white">
          {badge}
        </span>
      ) : null}
      {chevron ? (
        <ChevronDownIcon
          aria-hidden
          size={12}
          className={`transition-transform duration-micro motion-reduce:transition-none max-sm:hidden ${open ? 'rotate-180' : ''}`}
        />
      ) : null}
    </button>
  );
}
