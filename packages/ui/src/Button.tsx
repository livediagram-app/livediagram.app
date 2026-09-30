import { Children, forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { SOLID_BRAND_DARK_CONTROL } from './brand-classes';

// The shared button primitive. Before this, every dialog / panel /
// toolbar re-typed the same Tailwind class soup for its buttons, and
// they drifted: secondary buttons disagreed on the dark hover border,
// some primaries shipped the `focus-visible` outline and some forgot
// it, disabled opacity bounced between 50 and 60. Codifying the three
// variants + size scale here makes those one decision instead of N.
//
// `variant` is the intent (brand primary / destructive / neutral
// outline / caution: a soft yellow for an action with a way back, such as a
// delete that goes to the Trash); `size` is the padding+type scale (sm is the dialog-action
// rhythm, lg the large CTA, cta / cta-sm the public sites' call-to-action
// pill). Everything else (onClick, type, disabled, aria-*, ref) passes
// straight through, so this is a drop-in for a raw <button>. Extra `className` is appended last so a caller
// can still add layout (w-full, mt-…) without re-stating the look.

export type ButtonVariant = 'primary' | 'danger' | 'secondary' | 'caution';
export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg' | 'cta-sm' | 'cta';

const BASE =
  'optical-edges inline-flex items-center justify-center gap-2 rounded-md font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50';

const VARIANTS: Record<ButtonVariant, string> = {
  primary: `bg-brand-500 text-white hover:bg-brand-600 focus-visible:outline-brand-500 ${SOLID_BRAND_DARK_CONTROL}`,
  danger: 'bg-rose-600 text-white hover:bg-rose-700 focus-visible:outline-rose-500',
  // Soft yellow, not a solid fill: noticed, not alarming. Amber-900 on amber-50
  // (and amber-100 on the dark tint) keep the label well above 4.5:1.
  caution:
    'border border-amber-300 bg-amber-50 text-amber-900 hover:border-amber-400 hover:bg-amber-100 focus-visible:outline-amber-500 dark:border-amber-400/40 dark:bg-amber-400/15 dark:text-amber-100 dark:hover:border-amber-400/60 dark:hover:bg-amber-400/25',

  secondary:
    'border border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:bg-slate-800',
};

const SIZES: Record<ButtonSize, string> = {
  // The editor dialogs' compact action rhythm (Share / footer actions).
  xs: 'px-3 py-1.5 text-xs',
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-sm',
  lg: 'px-6 py-3 text-base',
  // The public sites' primary call-to-action pill (marketing's CtaLink, the
  // help centre's contact actions): wider than md, shorter than lg, in the
  // small or the base type scale.
  'cta-sm': 'px-5 py-2.5 text-sm',
  cta: 'px-5 py-2.5 text-base',
};

// Class-string escape hatch for ANCHORS styled as buttons: Next's <Link>
// (and plain <a>) can't render through the <button>-only primitive, so
// link call sites (sign-in CTAs, join-page actions) compose the same
// classes instead of re-typing the soup. Kept beside the variant tables
// so the two can never drift; Button itself renders through it.
export function buttonClassName({
  variant = 'primary',
  size = 'sm',
  className,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
} = {}): string {
  return `${BASE} ${VARIANTS[variant]} ${SIZES[size]}${className ? ` ${className}` : ''}`;
}

// A button's label centres its cap band, not its line box (docs/specs/004-interface-design/
// optical-alignment.md): each text run renders in `text-optical-line`, which keeps the line's height, so
// the button is the size it always was. Icons and other elements pass through untouched. Links styled
// with `buttonClassName` wrap their content in this too.
export function ButtonContent({ children }: { children: ReactNode }) {
  return (
    <>
      {Children.map(children, (child) =>
        typeof child === 'string' || typeof child === 'number' ? (
          <span className="text-optical-line">{child}</span>
        ) : (
          child
        ),
      )}
    </>
  );
}

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant, size, className, type = 'button', children, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={buttonClassName({ variant, size, className })}
      {...rest}
    >
      <ButtonContent>{children}</ButtonContent>
    </button>
  );
});
