import type { ReactNode } from 'react';
import { buttonClassName, ButtonContent } from '@livediagram/ui';

// The marketing pages' primary CTA link: the brand pill at the ui package's
// `cta` Button size (between md and lg). Five pages hand-rolled it and had
// already drifted (the FAQ copy lost its focus-visible outline), hence one
// shared component, used by the feature-category hero and blocks; layout extras
// (mt-3, group) come in via className.
export function CtaLink({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <a
      href={href}
      className={buttonClassName({
        size: 'cta',
        className: `shadow-sm${className ? ` ${className}` : ''}`,
      })}
    >
      <ButtonContent>{children}</ButtonContent>
    </a>
  );
}
