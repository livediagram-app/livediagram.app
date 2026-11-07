'use client';

import { useEffect, type ReactNode } from 'react';
import { useCommunityEnabled } from '@liveworkspace/community-ui';
import { useCommunitySite } from './client';

// The whole Community page on an app's address, unless the app's Community is switched off (each product's
// docs/specs/025-community/community.md "Turning the Community off"): then there is nothing here, and the visitor goes to
// the app's home page instead. liveworkspace.app's page asks no app.
export function CommunityGate({ children }: { children: ReactNode }) {
  const { pageApp } = useCommunitySite();
  const enabled = useCommunityEnabled('/api', pageApp !== null);
  useEffect(() => {
    if (enabled) return;
    console.warn('[community] switched off; leaving for the home page');
    window.location.replace('/');
  }, [enabled]);
  return enabled ? children : null;
}
