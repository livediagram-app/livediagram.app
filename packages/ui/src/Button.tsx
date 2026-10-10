import { Children, forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { SOLID_BRAND_DARK_CONTROL } from './brand-classes';

// The shared button primitive. Before this, every dialog / panel /
// toolbar re-typed the same Tailwind class soup for its buttons, and
// they drifted: secondary buttons disagreed on the dark hover border,
// some primaries shipped the `focus-visible` outline and some forgot
// it, disabled opacity bounced between 50 and 60. Codifying the three
// variants + size scale here makes those one decision instead of N.
//
// `variant` is the intent (brand primary / neutral outline / ghost: no fill or border until hovered, for a
// quiet action in a header row). There is no red or yellow variant: a delete looks like any other action in
// its place; `size` is the padding+type scale (sm is the dialog-action
// rhythm, lg the large CTA, cta / cta-sm the public sites' call-to-action
// pill). Everything else (onClick, type, disabled, aria-*, ref) passes
// straight through, so this is a drop-in for a raw <button>. Extra `className` is appended last so a caller
// can still add layout (w-full, mt-…) without re-stating the look.

// No red variant: a delete or a trash looks like any other action in its place (docs/specs/004-interface-design).
export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'solid';
export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg' | 'cta-sm' | 'cta';

const BASE =
  'optical-edges inline-flex items-center justify-center gap-2 rounded-md font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50 aria-disabled:cursor-not-allowed aria-disabled:opacity-50';

const VARIANTS: Record<ButtonVariant, string> = {
  primary: `bg-brand-700 text-white hover:bg-brand-800 focus-visible:outline-brand-700 ${SOLID_BRAND_DARK_CONTROL}`,
  secondary:
    'border border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:bg-slate-800',
  ghost:
    'text-slate-500 hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-slate-400 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100',
  // A filled button whose fill (and hover fill) the caller supplies in `className`, for an action that takes on a
  // colour it represents, such as a share role's. White text, so the fill must hold 4.5:1 against white.
  solid: 'text-white focus-visible:outline-slate-400',
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
