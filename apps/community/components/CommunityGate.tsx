'use client';

import { useEffect, type ReactNode } from 'react';
import { useCommunityEnabled } from '@livediagram/ui';
import { API_BASE } from '@/lib/config';

// The whole Community app, unless it is switched off (docs/specs/025-community/community.md "Turning the Community
// off"): then there is nothing here, and the visitor goes to the home page instead.
export function CommunityGate({ children }: { children: ReactNode }) {
  const enabled = useCommunityEnabled(API_BASE);
  useEffect(() => {
    if (enabled) return;
    console.warn('[community] switched off; leaving for the home page');
    window.location.replace('/');
  }, [enabled]);
  return enabled ? children : null;
}
