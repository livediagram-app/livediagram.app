import { ButtonContent, buttonClassName } from '../Button';

// Start Blank on the public sites (docs/specs/019-marketing/marketing-site.md "Start Blank"): a plain link to the
// wizard, never a menu of blanks. The wizard still asks what the visitor is making, and `start=blank` opens the
// chosen mode's blank with its start screen closed (each product's new-document route, "Start Blank after a
// mode"), so whoever asked for a blank is not offered templates again.
export const START_BLANK_HREF = '/new?start=blank';

// The header's way into the editor outside the marketing pages, last in the bar, at every width: a bordered
// secondary beside the Explorer link (Open Explorer, the filled one, for someone signed in). Each product binds it
// (its StartBlankLink) to the href for the page's funnel slot, the surface's `HeaderBlank`
// (docs/specs/019-marketing/landing-funnel.md); without a surface it is START_BLANK_HREF.
export function StartBlankLink({ href }: { href: string }) {
  return (
    <a
      href={href}
      className={buttonClassName({
        variant: 'secondary',
        size: 'md',
        className: 'relative shrink-0 shadow-sm touch-target-y',
      })}
    >
      <ButtonContent>Start Blank</ButtonContent>
    </a>
  );
}
