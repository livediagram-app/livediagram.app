import { forwardRef, type SelectHTMLAttributes } from 'react';

// The shared <select>. Callers used to render raw native selects, which
// kept the browser's default chrome (grey bevelled arrow, platform
// styling) next to fully custom-styled buttons and inputs — the Share
// dialog's expiry picker sat beside a custom segmented control and
// looked unfinished. This wraps a real native <select> (keyboard,
// mobile pickers, and screen-reader semantics for free) but hides the
// default chrome with `appearance-none` and draws its own chevron, so
// the closed control matches TextInput / Button.
//
// `variant`: 'outline' is the bordered field look (TextInput's palette);
// 'ghost' is borderless-until-hover for controls embedded in list rows
// (the team pane's role picker). `size` follows Button's compact dialog
// rhythm. Layout classes (flex-1, min-w-0, shrink-0, …) go on
// `className`, which lands on the wrapper so the chevron stays glued to
// the field. Options are passed as children, exactly like a raw select.

export type SelectVariant = 'outline' | 'ghost';
export type SelectSize = 'sm' | 'md';

const BASE =
  'w-full min-w-0 cursor-pointer appearance-none rounded-md outline-none transition dark:[&>option]:bg-slate-800';

const VARIANTS: Record<SelectVariant, string> = {
  outline:
    'border border-slate-200 bg-white text-slate-700 focus:border-brand-400 focus:ring-2 focus:ring-brand-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200',
  ghost:
    'border border-transparent bg-transparent font-medium text-slate-600 hover:border-slate-200 hover:bg-white focus:border-brand-400 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:bg-slate-700',
};

// Right padding reserves room for the chevron.
const SIZES: Record<SelectSize, string> = {
  sm: 'py-1 pl-1.5 pr-5 text-[11px]',
  md: 'py-1.5 pl-2 pr-6 text-xs',
};

export type SelectProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, 'size'> & {
  variant?: SelectVariant;
  size?: SelectSize;
};

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { variant = 'outline', size = 'md', className, children, ...rest },
  ref,
) {
  return (
    <span className={`relative inline-flex${className ? ` ${className}` : ''}`}>
      <select ref={ref} className={`${BASE} ${VARIANTS[variant]} ${SIZES[size]}`} {...rest}>
        {children}
      </select>
      <svg
        width="10"
        height="10"
        viewBox="0 0 12 12"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
        className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500"
      >
        <path d="M3 4.5 6 7.5 9 4.5" />
      </svg>
    </span>
  );
});
