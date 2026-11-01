// What the export service is given (wrangler.toml; liveworkspace/docs/specs/003-accounts/data-export.md "The service").
import type { App } from '@liveworkspace/index-client';

export interface Env {
  ENVIRONMENT?: string;
  // Accounts' key: its calls in, and the service's call back.
  EXPORT_KEY_ACCOUNTS?: string;
  // The index, listing a person's or a team's items, and the media service, their images.
  INDEX_KEY_EXPORT?: string;
  MEDIA_KEY_EXPORT?: string;
  // Each app's export door: where, and the key it takes from the service.
  APP_ORIGIN_LIVEDIAGRAM?: string;
  APP_ORIGIN_LIVEPLANNER?: string;
  APP_ORIGIN_LIVEDOCUMENTS?: string;
  APP_ORIGIN_LIVEDESIGN?: string;
  DATA_EXPORT_KEY_LIVEDIAGRAM?: string;
  DATA_EXPORT_KEY_LIVEPLANNER?: string;
  DATA_EXPORT_KEY_LIVEDOCUMENTS?: string;
  DATA_EXPORT_KEY_LIVEDESIGN?: string;
  INDEX?: Fetcher;
  MEDIA?: Fetcher;
  ACCOUNTS?: Fetcher;
  EXPORTS?: R2Bucket;
  DATA_EXPORT?: DurableObjectNamespace;
}

/** A setting, or undefined when it is unset or blank. */
export function setting(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

// A held app (livehuddle) has no export door until it launches: no origin or key, so the service can't reach it.
const ORIGIN_OF: Partial<Record<App, keyof Env>> = {
  livediagram: 'APP_ORIGIN_LIVEDIAGRAM',
  liveplanner: 'APP_ORIGIN_LIVEPLANNER',
  livedocuments: 'APP_ORIGIN_LIVEDOCUMENTS',
  livedesign: 'APP_ORIGIN_LIVEDESIGN',
};

const KEY_OF: Partial<Record<App, keyof Env>> = {
  livediagram: 'DATA_EXPORT_KEY_LIVEDIAGRAM',
  liveplanner: 'DATA_EXPORT_KEY_LIVEPLANNER',
  livedocuments: 'DATA_EXPORT_KEY_LIVEDOCUMENTS',
  livedesign: 'DATA_EXPORT_KEY_LIVEDESIGN',
};

export function appOrigin(env: Env, app: App): string | undefined {
  const name = ORIGIN_OF[app];
  return name ? setting(env[name] as string | undefined)?.replace(/\/+$/, '') : undefined;
}

export function appKey(env: Env, app: App): string | undefined {
  const name = KEY_OF[app];
  return name ? setting(env[name] as string | undefined) : undefined;
}
