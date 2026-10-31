'use client';

import type { ComponentProps } from 'react';
import { CommunityHelpLink as SharedLink } from '@liveworkspace/community-ui/links';
import { siteTrack } from '@livediagram/telemetry-client';

const trackHelp = (telemetryId: string) => siteTrack('UI', 'Opened', telemetryId);

// A deep link into the help centre's Community articles (docs/specs/018-help/contextual-help-links.md;
// docs/specs/025-community/community.md "Help"): @liveworkspace/community-ui's, sent through this site's telemetry.
export function CommunityHelpLink(props: Omit<ComponentProps<typeof SharedLink>, 'track'>) {
  return <SharedLink {...props} track={trackHelp} />;
}
