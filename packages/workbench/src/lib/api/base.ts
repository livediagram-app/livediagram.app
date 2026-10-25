// Where the api lives, as the editor build was told (`NEXT_PUBLIC_API_BASE`, same origin by default).
// Its own module, free of browser code, so the root layout's inline scripts can read it too.
export const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? '/api';
