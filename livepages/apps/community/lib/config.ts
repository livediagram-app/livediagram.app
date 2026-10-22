// Where the api lives (docs/specs/025-community/community.md "The Community app"). In production the
// router stitches the api worker onto this hostname under `/api`, so the origin-relative default is
// right; local development points it at a `wrangler dev` (see .env.example).
export const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? '/api';

// How long the search box waits after the last keystroke before it filters (blueprint §5).
export const SEARCH_DEBOUNCE_MS = 300;
