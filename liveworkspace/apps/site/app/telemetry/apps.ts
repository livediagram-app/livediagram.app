// The app filter (liveworkspace/docs/telemetry.md "The dashboard"): which choice the page shows, and
// how it rides in the URL, so `?app=livediagram.app` is a link to that app's numbers.

import {
  ALL_TELEMETRY_APPS,
  isTelemetryAppFilter,
  TELEMETRY_APPS,
  TELEMETRY_SUMMARY_PATH,
  type TelemetryAppFilter,
} from '@liveworkspace/telemetry';

export const APP_PARAM = 'app';

export const APP_CHOICES: { key: TelemetryAppFilter; label: string }[] = [
  { key: ALL_TELEMETRY_APPS, label: 'All apps' },
  ...TELEMETRY_APPS.map((app) => ({ key: app, label: app })),
];

// The filter a URL's query asks for: anything unknown reads as every app.
export function appFilterOf(search: string): TelemetryAppFilter {
  const asked = new URLSearchParams(search).get(APP_PARAM);
  return isTelemetryAppFilter(asked) ? asked : ALL_TELEMETRY_APPS;
}

// The same query with the filter set, keeping anything else it carries. Every app is the default, so
// it leaves the parameter out.
export function searchWithApp(search: string, app: TelemetryAppFilter): string {
  const params = new URLSearchParams(search);
  if (app === ALL_TELEMETRY_APPS) params.delete(APP_PARAM);
  else params.set(APP_PARAM, app);
  const query = params.toString();
  return query ? `?${query}` : '';
}

// The service's summary for a filter: the telemetry Worker, on the same origin as this page (and
// in development, through the dev server's proxy).
export function summaryUrl(app: TelemetryAppFilter): string {
  return `/api/telemetry${TELEMETRY_SUMMARY_PATH}?${APP_PARAM}=${encodeURIComponent(app)}`;
}

// The filter in the address bar, as an external store (useSyncExternalStore): the page is a static
// export, so the server render always reads every app, and the browser reads the real query.
const listeners = new Set<() => void>();

export function subscribeAppFilter(onChange: () => void): () => void {
  listeners.add(onChange);
  window.addEventListener('popstate', onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener('popstate', onChange);
  };
}

export const appFilterSnapshot = (): TelemetryAppFilter => appFilterOf(window.location.search);
export const appFilterServerSnapshot = (): TelemetryAppFilter => ALL_TELEMETRY_APPS;

// Picks a filter: rewrites the query in place (no new history entry) and tells the page.
export function setAppFilter(app: TelemetryAppFilter): void {
  const url = window.location.pathname + searchWithApp(window.location.search, app);
  window.history.replaceState(null, '', url);
  for (const listener of listeners) listener();
}
