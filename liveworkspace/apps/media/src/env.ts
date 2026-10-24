import type { App } from '@liveworkspace/index-client';
import { MEDIA_APPS, type MediaApp } from '@liveworkspace/media';

export interface Env {
  // 'production', 'staging' or 'development'.
  ENVIRONMENT: string;
  // The service's off switch: "false", "0" or "off" answers every route as missing. Unset is on.
  MEDIA_ENABLED?: string;
  MEDIA_DB: D1Database;
  // The images' bytes, keyed by image id. Optional so the service answers 503 rather than crash
  // without one.
  MEDIA?: R2Bucket;
  // Per-owner caps across every app, as decimal strings. Unset, blank, 0 or garbage is no cap.
  IMAGE_MAX_PER_OWNER?: string;
  IMAGE_MAX_BYTES_PER_OWNER?: string;
  // Each app's Worker secret (wrangler secret put), proving a caller is that app's own Worker. Unset
  // means that app can't use the service, and the sweep doesn't wait for it.
  MEDIA_KEY_LIVEDIAGRAM?: string;
  MEDIA_KEY_LIVEPLANNER?: string;
  MEDIA_KEY_LIVEDOCUMENTS?: string;
  MEDIA_KEY_LIVEDESIGN?: string;
  // Previews (liveworkspace/docs/previews.md). The index, asked who may see an item: its service binding (a
  // Worker's fetch to another Worker's route on its own zone isn't routed to it), else INDEX_URL.
  INDEX?: Fetcher;
  INDEX_URL?: string;
  // Where each app answers its export door (`<origin>/api/internal/items/:id/export`), called with that app's
  // media key. Unset, that app's items have no previews.
  APP_ORIGIN_LIVEDIAGRAM?: string;
  APP_ORIGIN_LIVEPLANNER?: string;
  APP_ORIGIN_LIVEDOCUMENTS?: string;
  APP_ORIGIN_LIVEDESIGN?: string;
}

const KEY_OF: Record<MediaApp, keyof Env> = {
  'livediagram.app': 'MEDIA_KEY_LIVEDIAGRAM',
  'liveplanner.app': 'MEDIA_KEY_LIVEPLANNER',
  'livedocuments.app': 'MEDIA_KEY_LIVEDOCUMENTS',
  'livedesign.app': 'MEDIA_KEY_LIVEDESIGN',
};

export function appKey(env: Env, app: MediaApp): string | undefined {
  const key = env[KEY_OF[app]];
  return typeof key === 'string' && key.trim() !== '' ? key : undefined;
}

// The apps that can use the service: those given a key.
export function keyedApps(env: Env): MediaApp[] {
  return MEDIA_APPS.filter((app) => appKey(env, app));
}

const OFF = new Set(['false', '0', 'off']);

export function mediaEnabled(env: Pick<Env, 'MEDIA_ENABLED'>): boolean {
  return !OFF.has(env.MEDIA_ENABLED?.trim().toLowerCase() ?? '');
}

// A cap from a [vars] entry, or null for none.
export function parsePositiveCap(raw: string | undefined): number | null {
  if (!raw) return null;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

// ---------- Previews: an index app, as this service names it ------------------------------------------------------

const MEDIA_APP_OF: Record<App, MediaApp> = {
  livediagram: 'livediagram.app',
  liveplanner: 'liveplanner.app',
  livedocuments: 'livedocuments.app',
  livedesign: 'livedesign.app',
};

const ORIGIN_OF: Record<App, keyof Env> = {
  livediagram: 'APP_ORIGIN_LIVEDIAGRAM',
  liveplanner: 'APP_ORIGIN_LIVEPLANNER',
  livedocuments: 'APP_ORIGIN_LIVEDOCUMENTS',
  livedesign: 'APP_ORIGIN_LIVEDESIGN',
};

// Where an app's export door is, with the key it takes, or null when either is not configured.
export function appDoor(env: Env, app: App): { origin: string; key: string } | null {
  const origin = env[ORIGIN_OF[app]];
  const key = appKey(env, MEDIA_APP_OF[app]);
  if (typeof origin !== 'string' || origin.trim() === '' || !key) return null;
  return { origin: origin.replace(/\/+$/, ''), key };
}

// The index's app, from the media app a key speaks for.
export function indexAppOf(app: MediaApp): App {
  return app.slice(0, -'.app'.length) as App;
}
