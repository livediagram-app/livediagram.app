// The apps that send telemetry to liveworkspace (liveworkspace/docs/telemetry.md). One central
// service, so each event names the app it came from, and the dashboard can show every app at once or
// filter to one. An app is named by its public site, the way people know it.

export const TELEMETRY_APPS = [
  'livediagram.app',
  'liveplanner.app',
  'livedocuments.app',
  'livedesign.app',
] as const;

export type TelemetryApp = (typeof TELEMETRY_APPS)[number];

// The dashboard's "every app" choice. Not an app: never stored, only asked for.
export const ALL_TELEMETRY_APPS = 'all';

export type TelemetryAppFilter = TelemetryApp | typeof ALL_TELEMETRY_APPS;

export function isTelemetryApp(value: unknown): value is TelemetryApp {
  return typeof value === 'string' && (TELEMETRY_APPS as readonly string[]).includes(value);
}

export function isTelemetryAppFilter(value: unknown): value is TelemetryAppFilter {
  return value === ALL_TELEMETRY_APPS || isTelemetryApp(value);
}

// The browser origins each app's pages are served from, production and staging. A browser event is
// only stored when the page that sent it is one of its app's own origins, so one site can't post in
// another's name. Local development origins are allowed separately, by the ingest's environment.
export const TELEMETRY_APP_ORIGINS: Record<TelemetryApp, readonly string[]> = {
  'livediagram.app': [
    'https://livediagram.app',
    'https://www.livediagram.app',
    'https://staging.livediagram.app',
  ],
  'liveplanner.app': [
    'https://liveplanner.app',
    'https://www.liveplanner.app',
    'https://staging.liveplanner.app',
  ],
  'livedocuments.app': [
    'https://livedocuments.app',
    'https://www.livedocuments.app',
    'https://staging.livedocuments.app',
  ],
  'livedesign.app': [
    'https://livedesign.app',
    'https://www.livedesign.app',
    'https://staging.livedesign.app',
  ],
};

// The app an origin belongs to, or null for one no app serves.
export function telemetryAppOfOrigin(origin: string): TelemetryApp | null {
  for (const app of TELEMETRY_APPS) {
    if (TELEMETRY_APP_ORIGINS[app].includes(origin)) return app;
  }
  return null;
}
