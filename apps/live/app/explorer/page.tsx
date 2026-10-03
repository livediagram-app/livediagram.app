'use client';

import { useEffect } from 'react';
import { useAppNavigation } from '@/hooks/navigation/useAppNavigation';

// /explorer is an index with no content of its own: every section
// lives at /explorer/<section> (docs/specs/013-workspace/folders.md, routes.ts). Default landing
// is Home (docs/specs/013-workspace/explorer-home.md, timeline.md §8.1). In production the live worker 302s this path before
// any HTML is served (src/worker.ts); this client replace is the
// dev-server / direct-asset fallback. Both, plus selectedFromRoute's
// default case, have to agree on the landing section.
export default function ExplorerIndexRedirect() {
  // Full page loads once a newer build is live (docs/specs/016-platform/stale-builds.md).
  const router = useAppNavigation();
  useEffect(() => {
    router.replace('/explorer/home');
  }, [router]);
  return null;
}
