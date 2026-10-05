'use client';

import { lucideCircleHelp } from '@livediagram/icons/lucide';
import { COMMUNITY_HELP, type CommunityHelpArticle } from '@livediagram/help-registry/community';
import { siteTrack } from '@livediagram/telemetry-client';
import { lucideGlyph } from '../icons/lucide-glyph';

const HelpIcon = lucideGlyph(lucideCircleHelp, 14);

// A deep link into the help centre's Community articles (docs/specs/018-help/contextual-help-links.md;
// docs/specs/025-community/community.md "Help"), for the public sites: a quiet inline link with the help glyph, sent
// as `UI·Opened·<article id>` like every help deep link the editor makes. Opens in the same tab: the help centre is
// the same site.
export function CommunityHelpLink({
  article,
  children,
  className = '',
}: {
  article: CommunityHelpArticle;
  children: string;
  className?: string;
}) {
  const { href, telemetryId } = COMMUNITY_HELP[article];
  return (
    <a
      href={href}
      onClick={() => siteTrack('UI', 'Opened', telemetryId)}
      className={`inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 underline-offset-4 transition-colors duration-micro hover:text-brand-700 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 dark:text-slate-300 dark:hover:text-brand-300 ${className}`}
    >
      <HelpIcon aria-hidden />
      {children}
    </a>
  );
}
