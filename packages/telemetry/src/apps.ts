// The apps that send telemetry to liveworkspace (liveworkspace/docs/specs/008-telemetry/telemetry.md). One central
// service, so each event names the app it came from, and the dashboard can show every app at once or
// filter to one. An app is named by its public site, the way people know it.

export const TELEMETRY_APPS = [
  'livediagram.app',
  'liveplanner.app',
  'livedocuments.app',
  'livedesign.app',
] as const;

// Apps registered before their launch (liveworkspace/docs/specs/002-architecture/integrating-an-app.md "Registered
// before launch"): their events are taken and stored, and the dashboard, which lists TELEMETRY_APPS, shows none of
// them until launch moves them there.
export const HELD_TELEMETRY_APPS = ['livehuddle.app'] as const;

export type TelemetryApp = (typeof TELEMETRY_APPS)[number] | (typeof HELD_TELEMETRY_APPS)[number];

// Every app the service takes events from: the listed and the held.
const ACCEPTED_TELEMETRY_APPS: readonly TelemetryApp[] = [
  ...TELEMETRY_APPS,
  ...HELD_TELEMETRY_APPS,
];

// The dashboard's "every app" choice. Not an app: never stored, only asked for.
export const ALL_TELEMETRY_APPS = 'all';

export type TelemetryAppFilter = TelemetryApp | typeof ALL_TELEMETRY_APPS;

export function isTelemetryApp(value: unknown): value is TelemetryApp {
  return (
    typeof value === 'string' && (ACCEPTED_TELEMETRY_APPS as readonly string[]).includes(value)
  );
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
  'livehuddle.app': [
    'https://livehuddle.app',
    'https://www.livehuddle.app',
    'https://staging.livehuddle.app',
  ],
};

// The app an origin belongs to, or null for one no app serves.
export function telemetryAppOfOrigin(origin: string): TelemetryApp | null {
  for (const app of ACCEPTED_TELEMETRY_APPS) {
    if (TELEMETRY_APP_ORIGINS[app].includes(origin)) return app;
  }
  return null;
}

// liveworkspace.app itself, as a sender: the one Explorer (liveworkspace/docs/specs/010-site/site.md "The Explorer")
// lives there for every app, so its events count for the app the page is filtered to, or, filtered to
// All Apps, for liveworkspace.app. Only the Explorer's own events are taken from it
// (explorer-events.ts), in an app's name or its own.
export const PLATFORM_TELEMETRY_APP = 'liveworkspace.app';
export type PlatformTelemetryApp = typeof PLATFORM_TELEMETRY_APP;

// What a batch may name: an app, or the platform.
export type TelemetrySender = TelemetryApp | PlatformTelemetryApp;

// Every sender, for the All apps summary.
export const TELEMETRY_SENDERS: readonly TelemetrySender[] = [
  ...TELEMETRY_APPS,
  PLATFORM_TELEMETRY_APP,
];

export function isTelemetrySender(value: unknown): value is TelemetrySender {
  return value === PLATFORM_TELEMETRY_APP || isTelemetryApp(value);
}

export const PLATFORM_TELEMETRY_ORIGINS: readonly string[] = [
  'https://liveworkspace.app',
  'https://www.liveworkspace.app',
  'https://staging.liveworkspace.app',
];

export function isPlatformOrigin(origin: string): boolean {
  return PLATFORM_TELEMETRY_ORIGINS.includes(origin);
}
