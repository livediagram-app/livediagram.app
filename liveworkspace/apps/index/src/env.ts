import type { App } from '@liveworkspace/index-client';

// The webhook dispatcher's binding (webhooks/durable-object.ts), as the index calls it.
export type WebhookNamespace = {
  idFromName(name: string): DurableObjectId;
  get(id: DurableObjectId): { kick(): Promise<void> };
};

export interface Env {
  // 'production', 'staging' or 'development'. Development signs grants with an ephemeral key when
  // GRANT_SIGNING_KEY is unset.
  ENVIRONMENT: string;
  // The service's off switch: "false", "0" or "off" answers every route as missing. Unset is on.
  INDEX_ENABLED?: string;
  INDEX_DB: D1Database;
  // The accounts origin, e.g. https://www.liveworkspace.app: tokens are checked against
  // `${ACCOUNTS_URL}/api/auth`, and grants are issued as `${ACCOUNTS_URL}/api/index`.
  ACCOUNTS_URL?: string;
  // Comma-separated: every app's API resource. A token addressed to any of them is let in.
  INDEX_AUDIENCES?: string;
  // The private ES256 JWK, as JSON with its `kid`, that grants are signed with.
  GRANT_SIGNING_KEY?: string;
  // Accounts' key (its INDEX_MERGE_KEY): the guest-to-account merge, and purging a closed account.
  MERGE_KEY?: string;
  // Each app's key (wrangler secret put), the app's INDEX_KEY. Unset means that app can't push, and the
  // index can't call it.
  INDEX_KEY_LIVEDIAGRAM?: string;
  INDEX_KEY_LIVEPLANNER?: string;
  INDEX_KEY_LIVEDOCUMENTS?: string;
  INDEX_KEY_LIVEDESIGN?: string;
  // The Google Drive mirror's service (liveworkspace/docs/specs/005-drive/drive.md "Contracts > The index"): its key here, with
  // which it acts for a person and sets their drive_mirrored flag; the key the index signals it with (its
  // DRIVE_KEY_INDEX); and the binding the signal goes through. Without the binding no signal is sent.
  INDEX_KEY_DRIVE?: string;
  DRIVE_KEY_INDEX?: string;
  DRIVE?: Fetcher;
  // The migration's handoff (migration-handoff.ts), per person. Absent (tests, local), not limited.
  MIGRATION_LIMITER?: RateLimit;
  // Share-password guesses (share-guesses.ts): per visitor's network, and per item whatever the network. Absent
  // (tests, local), not limited.
  SHARE_GUESS_VISITOR_LIMITER?: RateLimit;
  SHARE_GUESS_ITEM_LIMITER?: RateLimit;
  // Where each app's internal routes live (copy, purge, revoke).
  APP_ORIGIN_LIVEDIAGRAM?: string;
  APP_ORIGIN_LIVEPLANNER?: string;
  APP_ORIGIN_LIVEDOCUMENTS?: string;
  APP_ORIGIN_LIVEDESIGN?: string;
  // Webhooks (liveworkspace/docs/specs/004-index/webhooks.md): the AES-GCM key their URLs and secrets are sealed with
  // (base64 of 32 bytes; without it the routes answer 503 and nothing is sent), and the one dispatcher whose alarm
  // sends them. Absent (tests), nothing is woken.
  WEBHOOK_KEY?: string;
  WEBHOOKS?: WebhookNamespace;
}

const KEY_OF: Record<App, keyof Env> = {
  livediagram: 'INDEX_KEY_LIVEDIAGRAM',
  liveplanner: 'INDEX_KEY_LIVEPLANNER',
  livedocuments: 'INDEX_KEY_LIVEDOCUMENTS',
  livedesign: 'INDEX_KEY_LIVEDESIGN',
};

const ORIGIN_OF: Record<App, keyof Env> = {
  livediagram: 'APP_ORIGIN_LIVEDIAGRAM',
  liveplanner: 'APP_ORIGIN_LIVEPLANNER',
  livedocuments: 'APP_ORIGIN_LIVEDOCUMENTS',
  livedesign: 'APP_ORIGIN_LIVEDESIGN',
};

const setting = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined;

export function appKey(env: Env, app: App): string | undefined {
  return setting(env[KEY_OF[app]]);
}

export function appOrigin(env: Env, app: App): string | undefined {
  return setting(env[ORIGIN_OF[app]])?.replace(/\/+$/, '');
}

const DEFAULT_ACCOUNTS_URL = 'https://www.liveworkspace.app';

export function accountsUrl(env: Env): string {
  return (setting(env.ACCOUNTS_URL) ?? DEFAULT_ACCOUNTS_URL).replace(/\/+$/, '');
}

export function audiences(env: Env): string[] {
  return (env.INDEX_AUDIENCES ?? '')
    .split(',')
    .map((a) => a.trim())
    .filter(Boolean);
}

const OFF = new Set(['false', '0', 'off']);

export function indexEnabled(env: Pick<Env, 'INDEX_ENABLED'>): boolean {
  return !OFF.has(env.INDEX_ENABLED?.trim().toLowerCase() ?? '');
}
