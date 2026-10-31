'use client';

import { useRef } from 'react';
import { COMMUNITY_HOME_PATH } from '@liveworkspace/community/paths';
import { useNearViewport } from '@liveworkspace/ui';
import { useCommunityEnabled } from '../tile/useCommunityEnabled';

// A public site footer's Community link (liveworkspace/docs/specs/007-community/community.md "Turning the Community
// off"): gone while the app's Community is switched off. It asks only once the footer comes near the viewport, so a
// page view that never reaches the footer costs no request.
export function CommunityFooterLink({ className }: { className?: string }) {
  const ref = useRef<HTMLAnchorElement>(null);
  const near = useNearViewport(ref);
  if (!useCommunityEnabled(undefined, near)) return null;
  return (
    <a ref={ref} href={COMMUNITY_HOME_PATH} className={className}>
      Community
    </a>
  );
}
