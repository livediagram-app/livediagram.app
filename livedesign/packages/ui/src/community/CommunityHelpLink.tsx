'use client';

import type { ComponentProps } from 'react';
import { CommunityHelpLink as SharedLink } from '@liveworkspace/community-ui/links';
import { siteTrack } from '@livedesign/telemetry-client';

const trackHelp = (telemetryId: string) => siteTrack('UI', 'Opened', telemetryId);

// A deep link into the help centre's Community articles (docs/specs/025-community/community.md "Where Community is linked from"):
// @liveworkspace/community-ui's, sent through this site's telemetry as `UI·Opened·<article id>`.
export function CommunityHelpLink(props: Omit<ComponentProps<typeof SharedLink>, 'track'>) {
  return <SharedLink {...props} track={trackHelp} />;
}
