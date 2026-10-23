'use client';

import { useEffect } from 'react';
import { useAppNavigation } from '@/hooks/navigation/useAppNavigation';
import { EXPLORER_LANDING_PATH } from '@/lib/explorer-landing';

// /explorer lands on Home. In production the editor worker 302s this path before any HTML is served
// (src/worker.ts); this client replace is the dev-server / direct-asset fallback.
export default function ExplorerIndexRedirect() {
  const router = useAppNavigation();
  useEffect(() => {
    router.replace(EXPLORER_LANDING_PATH);
  }, [router]);
  return null;
}
