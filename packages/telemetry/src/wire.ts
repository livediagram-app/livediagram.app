// What an app sends the central ingest (liveworkspace/docs/telemetry.md "Sending events").

import type { TelemetrySender } from './apps';

// Where the service lives. Apps take it as configuration (NEXT_PUBLIC_TELEMETRY_URL in the browser,
// TELEMETRY_URL in a Worker), so local development and staging can point elsewhere.
export const TELEMETRY_URL = 'https://www.liveworkspace.app/api/telemetry';

// The public dashboard page, which every app's own /telemetry redirects to.
export const TELEMETRY_DASHBOARD_URL = 'https://www.liveworkspace.app/telemetry';

// The ingest and summary paths, under the service's URL. Like every liveworkspace API, the service
// sits under /api; the dashboard page is /telemetry.
export const TELEMETRY_EVENTS_PATH = '/events';
export const TELEMETRY_SUMMARY_PATH = '/summary';

// One event: three small fields, never user content (each app's vocabulary is closed, and checked
// at ingest). `type` is optional.
export type TelemetryWireEvent = {
  category: string;
  action: string;
  type?: string | null;
};

// A batch, as POSTed. The browser sends it as `text/plain` JSON so a cross-site send needs no CORS
// preflight and carries no cookies.
export type TelemetryBatch = {
  app: TelemetrySender;
  events: TelemetryWireEvent[];
};

// The most events one batch may store; the rest of a longer batch is dropped.
export const TELEMETRY_BATCH_MAX = 100;

// Proves a batch came from one of an app's own Workers (they send no Origin): the app's own secret,
// so a key can only ever speak for its app.
export const TELEMETRY_KEY_HEADER = 'X-Telemetry-Key';

// Defence-in-depth bound on `type`: a short token of safe characters, not a fixed enum, so a new
// shape or template needs no change here. Rejects anything that looks like free text.
export const TELEMETRY_TYPE_PATTERN = /^[A-Za-z0-9 ._-]{1,40}$/;
