'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { browserNavigationDeps, navigateTo } from '@/lib/stale-build-navigation';

// The app's own programmatic navigation (docs/specs/016-platform/stale-builds.md): the router's
// transition, or a full page load once a newer build is live. Same shape as the router's push and
// replace, so call sites read as before.
export function useAppNavigation(): {
  push: (url: string) => void;
  replace: (url: string) => void;
} {
  const router = useRouter();
  return useMemo(() => {
    const deps = () => ({
      ...browserNavigationDeps(),
      navigateClient: (url: string, replace: boolean) =>
        replace ? router.replace(url) : router.push(url),
    });
    return {
      push: (url: string) => void navigateTo(url, false, deps()),
      replace: (url: string) => void navigateTo(url, true, deps()),
    };
  }, [router]);
}
