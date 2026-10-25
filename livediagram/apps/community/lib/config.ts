import { COMMUNITY_API_URL } from '@livediagram/api-schema';
import { workspaceOriginFor } from '@liveworkspace/sites';

// Where the api lives (docs/specs/025-community/community.md "The Community app"). In production the
// router stitches the api worker onto this hostname under `/api`, so the origin-relative default is
// right; local development points it at a `wrangler dev` (see .env.example). The api answers My Shares,
// and serves each post's card image, viewer and copy.
export const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? '/api';

// Where the posts live: the liveworkspace Community service (liveworkspace/docs/community.md), which keeps
// every app's posts, likes and reports. The build can name one (a `wrangler dev` on port 8791); else it is
// liveworkspace.app's as seen from this page (@liveworkspace/sites workspaceOriginFor): production's, staging's
// from a staging app, and the local site's on a dev server, which forwards it. Production's outside a browser.
export function communityApi(): string {
  const named = process.env.NEXT_PUBLIC_COMMUNITY_API;
  if (named) return named;
  if (typeof window === 'undefined') return COMMUNITY_API_URL;
  return `${workspaceOriginFor(window.location.host)}/api/community`;
}

// How long the search box waits after the last keystroke before it filters (blueprint §5).
export const SEARCH_DEBOUNCE_MS = 300;
