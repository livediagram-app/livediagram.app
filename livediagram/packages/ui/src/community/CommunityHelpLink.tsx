'use client';

import { COMMUNITY_HELP, type CommunityHelpArticle } from '@livediagram/help-registry/community';
import { siteTrack } from '@livediagram/telemetry-client';
import { CommunityHelpLink as HelpLink } from '@liveworkspace/community-ui/help-link';

// A deep link into the help centre's Community articles (docs/specs/018-help/contextual-help-links.md;
// docs/specs/025-community/community.md "Help"), for the public sites, sent as `UI·Opened·<article id>` like every
// help deep link the editor makes. The link itself is every app's (@liveworkspace/community-ui/help-link); this binds
// it to livediagram's two articles and its telemetry. Three looks: `quiet` (default), `inline` and `button`.
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
  return (
    <HelpLink
      href={href}
      onOpen={() => siteTrack('UI', 'Opened', telemetryId)}
      variant={variant}
      className={className}
    >
      {children}
    </HelpLink>
  );
}
