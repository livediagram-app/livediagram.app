import type { ReactNode } from 'react';
import { buttonClassName } from '@livediagram/ui';

// The marketing pages' primary CTA link: the brand pill at the ui package's
// `cta` Button size (between md and lg). Five pages hand-rolled it and had
// already drifted (the FAQ copy lost its focus-visible outline), hence one
// shared component. `size` picks the type scale: `base` for the
// feature-category hero/blocks, `sm` for the comparison / FAQ footer cards;
// layout extras (mt-3, group) come in via className.
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
      className={buttonClassName({
        size: size === 'base' ? 'cta' : 'cta-sm',
        className: `shadow-sm${className ? ` ${className}` : ''}`,
      })}
    >
      {children}
    </a>
  );
}
