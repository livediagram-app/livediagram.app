'use client';

import { useCommunityEnabled } from './useCommunityEnabled';

// The site footer's Community link (docs/specs/025-community/community.md "Where Community is linked from"), gone
// while the Community is switched off ("Turning the Community off"). Its own client island so the footer stays a
// server component.
export function CommunityFooterLink({ className }: { className?: string }) {
  if (!useCommunityEnabled()) return null;
  return (
    <a href="/community/" className={className}>
      Community
    </a>
  );
}
