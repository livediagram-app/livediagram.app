'use client';

import { useEffect, type ReactNode } from 'react';
import { useCommunityEnabled } from '@liveworkspace/community-ui';
import { useCommunitySite } from '../client';

// The whole Community app, unless it is switched off (livediagram/docs/specs/025-community/community.md "Turning the Community
// off"): then there is nothing here, and the visitor goes to the home page instead.
export function CommunityGate({ children }: { children: ReactNode }) {
  const { apiBase } = useCommunitySite();
  const enabled = useCommunityEnabled(apiBase);
  useEffect(() => {
    if (enabled) return;
    console.warn('[community] switched off; leaving for the home page');
    window.location.replace('/');
  }, [enabled]);
  return enabled ? children : null;
}
