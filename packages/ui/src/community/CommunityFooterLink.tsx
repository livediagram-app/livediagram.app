'use client';

import { COMMUNITY_HOME_PATH } from '@livediagram/api-schema';
import { useCommunityEnabled } from './useCommunityEnabled';

// The site footer's Community link (docs/specs/025-community/community.md "Where Community is linked from"), gone
// while the Community is switched off ("Turning the Community off"). Its own client island so the footer stays a
// server component.
export function CommunityFooterLink({ className }: { className?: string }) {
  if (!useCommunityEnabled()) return null;
  return (
    <a href={COMMUNITY_HOME_PATH} className={className}>
      Community
    </a>
  );
}
