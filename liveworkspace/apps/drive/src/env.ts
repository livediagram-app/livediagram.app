import { driveKeyBytes, type GoogleConfig } from '@liveworkspace/drive/server';
import type { AppName, DriveEnvironment } from '@liveworkspace/drive';
import type { DriveMirror } from './mirror/durable-object';

export interface Env {
  // 'production', 'staging' or 'development': names the Drive root folder and which app origins a return page may
  // be on.
  ENVIRONMENT?: string;
  // The OAuth client (a var) and its secret, the Picker's key and app id (liveworkspace/docs/specs/005-drive/drive.md "Configuration").
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  GOOGLE_PICKER_KEY?: string;
  GOOGLE_APP_ID?: string;
  // Tests only: Google's OAuth and Drive from one fake host.
  GOOGLE_BASE_URL?: string;
  // base64 of 32 bytes: seals refresh tokens; the state and channel keys are derived from it.
  DRIVE_TOKEN_KEY?: string;
  // liveworkspace's origin: the redirect URI, the files' lwOrigin, the push address.
  DRIVE_PUBLIC_URL?: string;
  // The accounts origin: tokens are checked against `${ACCOUNTS_URL}/api/auth`.
  ACCOUNTS_URL?: string;
  // Comma-separated: every app's API resource. A token addressed to any of them is let in.
  INDEX_AUDIENCES?: string;
  // The index: its binding, else INDEX_URL (local development); the key it knows the service by.
  INDEX?: Fetcher;
  INDEX_URL?: string;
  INDEX_KEY_DRIVE?: string;
  // The keys the index's signal and accounts' account deletion carry.
  DRIVE_KEY_INDEX?: string;
  DRIVE_KEY_ACCOUNTS?: string;
  // Each app's DRIVE_KEY, for its export and import doors.
  DRIVE_KEY_LIVEDIAGRAM?: string;
  DRIVE_KEY_LIVEPLANNER?: string;
  DRIVE_KEY_LIVEDOCUMENTS?: string;
  DRIVE_KEY_LIVEDESIGN?: string;
  // Where each app answers its doors, and opens an item.
  APP_ORIGIN_LIVEDIAGRAM?: string;
  APP_ORIGIN_LIVEPLANNER?: string;
  APP_ORIGIN_LIVEDOCUMENTS?: string;
  APP_ORIGIN_LIVEDESIGN?: string;
  DRIVE_MIRROR: DurableObjectNamespace<DriveMirror>;
}

const KEY_OF: Record<AppName, keyof Env> = {
  livediagram: 'DRIVE_KEY_LIVEDIAGRAM',
  liveplanner: 'DRIVE_KEY_LIVEPLANNER',
  livedocuments: 'DRIVE_KEY_LIVEDOCUMENTS',
  livedesign: 'DRIVE_KEY_LIVEDESIGN',
};

const ORIGIN_OF: Record<AppName, keyof Env> = {
  livediagram: 'APP_ORIGIN_LIVEDIAGRAM',
  liveplanner: 'APP_ORIGIN_LIVEPLANNER',
  livedocuments: 'APP_ORIGIN_LIVEDOCUMENTS',
  livedesign: 'APP_ORIGIN_LIVEDESIGN',
};

export const setting = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined;

const withoutTrailingSlash = (value: string) => value.replace(/\/+$/, '');

export function appKey(env: Env, app: AppName): string | undefined {
  return setting(env[KEY_OF[app]]);
}

export function appOrigin(env: Env, app: AppName): string | undefined {
  const origin = setting(env[ORIGIN_OF[app]]);
  return origin ? withoutTrailingSlash(origin) : undefined;
}

export function environmentOf(env: Pick<Env, 'ENVIRONMENT'>): DriveEnvironment {
  const value = setting(env.ENVIRONMENT);
  return value === 'staging' || value === 'development' ? value : 'production';
}

const DEFAULT_PUBLIC_URL = 'https://liveworkspace.app';

/** liveworkspace's origin in this environment. */
export function publicOrigin(env: Pick<Env, 'DRIVE_PUBLIC_URL'>): string {
  return withoutTrailingSlash(setting(env.DRIVE_PUBLIC_URL) ?? DEFAULT_PUBLIC_URL);
}

export function accountsUrl(env: Env): string {
  return withoutTrailingSlash(setting(env.ACCOUNTS_URL) ?? DEFAULT_PUBLIC_URL);
}

export function audiences(env: Env): string[] {
  return (env.INDEX_AUDIENCES ?? '')
    .split(',')
    .map((a) => a.trim())
    .filter(Boolean);
}

let warnedKeyInvalid = false;

/** Whether the deployment offers Drive: a client id, its secret, and a 32-byte DRIVE_TOKEN_KEY. A key that is set but
 *  malformed is a misconfiguration, logged once per isolate. */
export function driveConfigured(env: Env): boolean {
  if (!setting(env.GOOGLE_CLIENT_ID) || !setting(env.GOOGLE_CLIENT_SECRET)) return false;
  if (driveKeyBytes(env.DRIVE_TOKEN_KEY)) return true;
  if (env.DRIVE_TOKEN_KEY && !warnedKeyInvalid) {
    warnedKeyInvalid = true;
    console.warn('drive: key-invalid (DRIVE_TOKEN_KEY must be base64 of 32 bytes)');
  }
  return false;
}

export function googleConfig(env: Env): GoogleConfig {
  return {
    clientId: setting(env.GOOGLE_CLIENT_ID) ?? '',
    clientSecret: setting(env.GOOGLE_CLIENT_SECRET) ?? '',
    ...(setting(env.GOOGLE_BASE_URL) ? { baseUrl: setting(env.GOOGLE_BASE_URL) } : {}),
  };
}
