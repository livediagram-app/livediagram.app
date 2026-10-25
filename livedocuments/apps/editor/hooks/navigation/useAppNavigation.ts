'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { interceptAppNavigation } from '@liveworkspace/workbench/lib/app-location';
import { browserNavigationDeps, navigateTo } from '@/lib/stale-build-navigation';

// The app's own programmatic navigation (docs/specs/016-platform/stale-builds.md): the router's
// transition, or a full page load once a newer build is live. Same shape as the router's push and
// replace, so call sites read as before. A workspace frame takes the move first (@liveworkspace/workbench/lib/app-location.ts).
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
    const go = (url: string, replace: boolean) => {
      if (interceptAppNavigation(url, replace)) return;
      void navigateTo(url, replace, deps());
    };
    return {
      push: (url: string) => go(url, false),
      replace: (url: string) => go(url, true),
    };
  }, [router]);
}
