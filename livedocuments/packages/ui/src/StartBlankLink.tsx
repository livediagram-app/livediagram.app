import { ctaHref, isCtaSource, type CtaSurface } from '@livedocuments/api-schema';
import { START_BLANK_HREF, StartBlankLink as SharedLink } from '@liveworkspace/ui/start-blank-link';

export { START_BLANK_HREF };

// Start Blank on the public sites (docs/specs/019-marketing/marketing-site.md "Start Blank"): @liveworkspace/ui's
// plain link to the wizard, carrying the surface's `HeaderBlank` funnel slot
// (docs/specs/019-marketing/landing-funnel.md); without a surface it is a plain link.
export function StartBlankLink({
  ctaSurface,
  className,
}: {
  ctaSurface?: CtaSurface;
  className?: string;
}) {
  const source = ctaSurface ? `${ctaSurface}.HeaderBlank` : null;
  return (
    <SharedLink
      href={isCtaSource(source) ? ctaHref(START_BLANK_HREF, source) : START_BLANK_HREF}
      className={className}
    />
  );
}
