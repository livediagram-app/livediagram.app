import { ButtonContent, buttonClassName } from '../Button';

// Start Blank on the public sites (docs/specs/019-marketing/marketing-site.md "Start Blank"): a plain link to the
// wizard, never a menu of blanks. The wizard still asks what the visitor is making, and `start=blank` opens the
// chosen mode's blank with its start screen closed (each product's new-document route, "Start Blank after a
// mode"), so whoever asked for a blank is not offered templates again.
export const START_BLANK_HREF = '/new?start=blank';

// The header's secondary, beside Choose Template. Each product binds it (its StartBlankLink) to the href for the
// page's funnel slot, the surface's `HeaderBlank` (docs/specs/019-marketing/landing-funnel.md); without a surface
// it is START_BLANK_HREF.
export function StartBlankLink({ href, className = '' }: { href: string; className?: string }) {
  return (
    <a
      href={href}
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
