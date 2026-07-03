import { forwardRef, type ButtonHTMLAttributes } from 'react';

// The shared button primitive. Before this, every dialog / panel /
// toolbar re-typed the same Tailwind class soup for its buttons, and
// they drifted: secondary buttons disagreed on the dark hover border,
// some primaries shipped the `focus-visible` outline and some forgot
// it, disabled opacity bounced between 50 and 60. Codifying the three
// variants + size scale here makes those one decision instead of N.
//
// `variant` is the intent (brand primary / destructive / neutral
// outline); `size` is the padding+type scale (sm is the dialog-action
// rhythm, lg the marketing CTA). Everything else — onClick, type,
// disabled, aria-*, ref — passes straight through, so this is a drop-in
// for a raw <button>. Extra `className` is appended last so a caller
// can still add layout (w-full, mt-…) without re-stating the look.

export type ButtonVariant = 'primary' | 'danger' | 'secondary';
export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg';

const BASE =
  'inline-flex items-center justify-center gap-2 rounded-md font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50';

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-brand-500 text-white hover:bg-brand-600 focus-visible:outline-brand-500',
  danger: 'bg-rose-600 text-white hover:bg-rose-700 focus-visible:outline-rose-500',
  secondary:
    'border border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:bg-slate-800',
};

const SIZES: Record<ButtonSize, string> = {
  // The editor dialogs' compact action rhythm (Share / footer actions).
  xs: 'px-3 py-1.5 text-xs',
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-sm',
  lg: 'px-6 py-3 text-base',
};

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'sm', className, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={`${BASE} ${VARIANTS[variant]} ${SIZES[size]}${className ? ` ${className}` : ''}`}
      {...rest}
    />
  );
});
