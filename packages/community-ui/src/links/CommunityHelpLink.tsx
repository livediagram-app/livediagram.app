'use client';

import { COMMUNITY_HELP, type CommunityHelpArticle } from '@liveworkspace/help-registry/community';
import { CommunityHelpLink as HelpLink } from '../help-link/CommunityHelpLink';

// A deep link into an app's help centre's Community articles (liveworkspace/docs/specs/007-community/community.md
// "Help"; each app's docs/specs/018-help/contextual-help-links.md), for the public sites: the shared link
// (../help-link) at the article's address, every app's alike. `track` sends it as `UI·Opened·<article id>` like
// every help deep link the editor makes; each app's ui binds its own site telemetry.
export function CommunityHelpLink({
  article,
  track,
  ...look
}: {
  article: CommunityHelpArticle;
  children: string;
  variant?: 'quiet' | 'inline' | 'button';
  className?: string;
  track: (telemetryId: string) => void;
}) {
  const { href, telemetryId } = COMMUNITY_HELP[article];
  return <HelpLink href={href} onOpen={() => track(telemetryId)} {...look} />;
}
