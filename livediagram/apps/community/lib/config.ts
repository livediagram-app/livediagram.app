import { COMMUNITY_API_URL } from '@livediagram/api-schema';

// Where the api lives (docs/specs/025-community/community.md "The Community app"). In production the
// router stitches the api worker onto this hostname under `/api`, so the origin-relative default is
// right; local development points it at a `wrangler dev` (see .env.example). The api answers My Shares,
// and serves each post's card image, viewer and copy.
export const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? '/api';

// Where the posts live: the liveworkspace Community service (liveworkspace/docs/community.md), which keeps
// every app's posts, likes and reports. Production's unless the build names another (staging's, or a
// local `wrangler dev` on port 8791).
export const COMMUNITY_API = process.env.NEXT_PUBLIC_COMMUNITY_API ?? COMMUNITY_API_URL;

// How long the search box waits after the last keystroke before it filters (blueprint §5).
export const SEARCH_DEBOUNCE_MS = 300;
