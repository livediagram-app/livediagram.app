'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { pageViewPath } from '@livediagram/api-schema';

// Page view telemetry (spec/150): one `Page·View·<path>` per path change,
// shared by every frontend. Mounted once in each app's root layout through a
// small client adapter that hands it the app's own policy-wrapped track(), so
// the build gate and the spec/20 opt-out stay app-owned.
//
// `usePathname` is only the trigger. The path reported is
// `window.location.pathname`, because under a basePath (help, telemetry)
// `usePathname` drops the prefix and `/canvas/the-canvas` would be counted as
// a marketing page. A query-only change (a tab or folder switch) leaves the
// pathname alone, so it is not a new page.

type Track = (category: 'Page', action: 'View', type: string) => void;

// The last path reported on this page. The same path twice in a row is one
// view: in production a path can't repeat without a navigation between, so
// this only absorbs StrictMode's dev-time double effect. A reload starts a
// fresh module, so it still counts.
let lastReported: string | null = null;

export function reportPageView(track: Track, pathname: string): void {
  const path = pageViewPath(pathname);
  if (path === null || path === lastReported) return;
  lastReported = path;
  try {
    track('Page', 'View', path);
  } catch {
    // Telemetry must never throw into the host app.
  }
}

// Test seam: module state outlives a test's render tree.
export function resetPageViewTrackerForTests(): void {
  lastReported = null;
}

export function PageViewTracker({ track }: { track: Track }) {
  const pathname = usePathname();
  useEffect(() => {
    reportPageView(track, window.location.pathname);
  }, [pathname, track]);
  return null;
}
