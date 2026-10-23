import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { SOLID_BRAND_DARK_CONTROL } from './classes';

// liveplanner's shared Button (packages/ui/src/Button.tsx): brand primary, neutral outline, ghost, or a solid
// fill the caller supplies; no red variant, a delete looks like any other action in its place.

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'solid';
export type ButtonSize = 'xs' | 'sm' | 'md';

const BASE =
  'inline-flex items-center justify-center gap-2 rounded-md font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50';

const VARIANTS: Record<ButtonVariant, string> = {
  primary: `bg-brand-700 text-white hover:bg-brand-800 focus-visible:outline-brand-700 ${SOLID_BRAND_DARK_CONTROL}`,
  secondary:
    'border border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:bg-slate-800',
  ghost:
    'text-slate-500 hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-slate-400 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100',
  solid: 'text-white focus-visible:outline-slate-400',
};

const SIZES: Record<ButtonSize, string> = {
  xs: 'px-3 py-1.5 text-xs',
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-sm',
};

export function buttonClassName({
  variant = 'primary',
  size = 'sm',
  className,
}: { variant?: ButtonVariant; size?: ButtonSize; className?: string } = {}): string {
  return `${BASE} ${VARIANTS[variant]} ${SIZES[size]}${className ? ` ${className}` : ''}`;
}

export const Button = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: ButtonSize }
>(function Button({ variant, size, className, type = 'button', ...rest }, ref) {
  return (
    <button
      ref={ref}
      type={type}
      className={buttonClassName({ variant, size, className })}
      {...rest}
    />
  );
});
