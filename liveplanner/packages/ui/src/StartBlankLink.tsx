import { ctaHref, isCtaSource, type CtaSurface } from '@liveplanner/api-schema';
import { ButtonContent, buttonClassName } from '@liveworkspace/ui';

// Start Blank on the public sites (docs/specs/019-marketing/marketing-site.md "Start Blank"): a plain link to the
// wizard, never a menu of blanks. The wizard still asks what the visitor is making, and `start=blank` opens the
// chosen mode's blank with its start screen closed (docs/specs/007-editor/new-project-route.md "Start Blank after
// a mode"), so whoever asked for a blank is not offered templates again.
export const START_BLANK_HREF = '/new?start=blank';

// The header's secondary, beside Choose Template. Its funnel slot is the surface's `HeaderBlank`
// (docs/specs/019-marketing/landing-funnel.md); without a surface it is a plain link.
export function StartBlankLink({
  ctaSurface,
  className = '',
}: {
  ctaSurface?: CtaSurface;
  className?: string;
}) {
  const source = ctaSurface ? `${ctaSurface}.HeaderBlank` : null;
  return (
    <a
      href={isCtaSource(source) ? ctaHref(START_BLANK_HREF, source) : START_BLANK_HREF}
      className={buttonClassName({
        variant: 'secondary',
        size: 'md',
        className: `relative shrink-0 shadow-sm touch-target-y ${className}`,
      })}
    >
      <ButtonContent>Start Blank</ButtonContent>
    </a>
  );
}
