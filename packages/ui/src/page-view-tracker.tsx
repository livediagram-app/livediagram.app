import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

// Page view telemetry (docs/specs/017-telemetry/page-view-telemetry.md in each product): one `Page·View·<path>`
// per path change, shared by every frontend. Mounted once in each app's root layout through a small client
// adapter that hands it the app's own policy-wrapped track(), so the build gate and the user-preferences
// opt-out stay app-owned. Each product binds it once to its own page-view vocabulary (`pageViewPath` from its
// api-schema, which turns a pathname into the path reported, or null for one it cannot express): its
// PageViewTracker.
//
// `usePathname` is only the trigger. The path reported is `window.location.pathname`, because under a basePath
// (help, telemetry, a Community) `usePathname` drops the prefix and `/canvas/the-canvas` would be counted as a
// marketing page. A query-only change (a tab or folder switch) leaves the pathname alone, so it is not a new page.

export type PageViewTrack = (category: 'Page', action: 'View', type: string) => void;

export function createPageViewTracker(pageViewPath: (pathname: string) => string | null) {
  // The last path reported on this page. The same path twice in a row is one
  // view: in production a path can't repeat without a navigation between, so
  // this only absorbs StrictMode's dev-time double effect. A reload starts a
  // fresh module, so it still counts.
  let lastReported: string | null = null;

  function reportPageView(track: PageViewTrack, pathname: string): void {
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
  function resetPageViewTrackerForTests(): void {
    lastReported = null;
  }

  function PageViewTracker({ track }: { track: PageViewTrack }) {
    const pathname = usePathname();
    useEffect(() => {
      reportPageView(track, window.location.pathname);
    }, [pathname, track]);
    return null;
  }

  return { reportPageView, resetPageViewTrackerForTests, PageViewTracker };
}
