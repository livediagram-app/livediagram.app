'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  browserNavigationDeps,
  installStaleBuildNavigation,
  setClientNavigator,
} from '@/lib/stale-build-navigation';

// Stale builds (docs/specs/016-platform/stale-builds.md): mounts once from the root layout. Its
// effect runs before the client router's own (a child's effects run first), so its popstate
// listener sees a back or forward first and can make it a full page load.
export function StaleBuildBoot() {
  const router = useRouter();
  useEffect(() => installStaleBuildNavigation(browserNavigationDeps()), []);
  useEffect(() => {
    setClientNavigator((url, replace) => (replace ? router.replace(url) : router.push(url)));
    return () => setClientNavigator(null);
  }, [router]);
  return null;
}
