'use client';

import { lucideCircleHelp } from '@livediagram/icons/lucide';
import { COMMUNITY_HELP, type CommunityHelpArticle } from '@livediagram/help-registry/community';
import { siteTrack } from '@livediagram/telemetry-client';
import { buttonClassName, ButtonContent } from '../Button';
import { lucideGlyph } from '../icons/lucide-glyph';

const HelpIcon = lucideGlyph(lucideCircleHelp, 14);

const QUIET_LINK =
  'inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 underline-offset-4 transition-colors duration-micro hover:text-brand-700 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 dark:text-slate-300 dark:hover:text-brand-300';

// Text that reads on in its sentence: the surrounding size, the brand colour, underlined on hover.
const INLINE_LINK =
  'font-medium text-brand-700 underline-offset-4 transition-colors duration-micro hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 dark:text-brand-300';

// A deep link into the help centre's Community articles (docs/specs/018-help/contextual-help-links.md;
// docs/specs/025-community/community.md "Help"), for the public sites, sent as `UI·Opened·<article id>` like every
// help deep link the editor makes. Opens in the same tab: the help centre is the same site. Three looks:
// - `quiet` (default): a small link with the help glyph, beside a control;
// - `inline`: words inside a sentence, in its own size;
// - `button`: a secondary button with the help glyph, beside a primary call to action.
export function CommunityHelpLink({
  article,
  children,
  variant = 'quiet',
  className = '',
}: {
  article: CommunityHelpArticle;
  children: string;
  variant?: 'quiet' | 'inline' | 'button';
  className?: string;
}) {
  const { href, telemetryId } = COMMUNITY_HELP[article];
  const look =
    variant === 'button'
      ? buttonClassName({ variant: 'secondary', size: 'cta', className: 'shadow-sm' })
      : variant === 'inline'
        ? INLINE_LINK
        : QUIET_LINK;
  return (
    <a
      href={href}
      onClick={() => siteTrack('UI', 'Opened', telemetryId)}
      className={`${look} ${className}`}
    >
      {variant === 'inline' ? (
        children
      ) : variant === 'button' ? (
        <ButtonContent>
          <HelpIcon aria-hidden />
          {children}
        </ButtonContent>
      ) : (
        <>
          <HelpIcon aria-hidden />
          {children}
        </>
      )}
    </a>
  );
}
