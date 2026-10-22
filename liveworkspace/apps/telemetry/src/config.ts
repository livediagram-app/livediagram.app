// The Worker's settings. They live apart from src/index.ts because a Worker's entry module may only
// export handlers: the runtime refuses to start on any other export there.

// The path of liveworkspace.app this Worker owns: its API, under /api like every liveworkspace API.
export const API_PATH = '/api/telemetry';

const DAY_MS = 86_400_000;
// The dashboard's longest look back is 59 days (the last 30 and the 30 before them).
export const RETENTION_MS = 60 * DAY_MS;

// The ingest is posted to cross-site by every app's pages, as a CORS "simple request" (text/plain, no
// credentials), so it needs no preflight; the header only lets a page read the 204.
export const CORS = { 'Access-Control-Allow-Origin': '*' };
