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
