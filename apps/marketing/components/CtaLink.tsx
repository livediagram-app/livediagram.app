import type { ReactNode } from 'react';

// The marketing pages' primary CTA link: the px-5 brand pill sitting
// between the ui package's md and lg Button sizes, so it can't compose
// buttonClassName without a visible resize. Five pages hand-rolled it
// and had already drifted (the FAQ copy lost its focus-visible
// outline), hence one shared component. `size` picks the type scale —
// `base` for the feature-category hero/blocks, `sm` for the
// comparison / FAQ footer cards; layout extras (mt-3, group gap) come
// in via className.
export function CtaLink({
  href,
  size = 'base',
  className,
  children,
}: {
  href: string;
  size?: 'base' | 'sm';
  className?: string;
  children: ReactNode;
}) {
  return (
    <a
      href={href}
      className={`inline-flex items-center justify-center rounded-md bg-brand-500 px-5 py-2.5 font-medium text-white shadow-sm transition hover:bg-brand-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 ${
        size === 'base' ? 'text-base' : 'text-sm'
      }${className ? ` ${className}` : ''}`}
    >
      {children}
    </a>
  );
}
