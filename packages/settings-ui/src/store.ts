// Reading and writing the account's settings for the Settings panel (liveworkspace/docs/specs/003-accounts/accounts.md "Settings",
// "Who calls what"), over the accounts API wherever the panel is opened: liveworkspace.app's own `/api/account`
// with its session, or an app's address's `/api/workspace/account` with the app's access token (the bearer the
// app's Explorer already uses). The host hands over how to send a request; this keeps what has been read for the
// page's lifetime, so opening the panel again, or switching back to All, costs nothing.
import type { SettingsBlob } from '@liveworkspace/settings';
import type { AppCatalogue } from '@liveworkspace/settings/catalogue';
import type { AppScopes } from './catalogue-model';

import type { SettingsApiResult, SettingsRequest } from './request';

export type { SettingsApiResult, SettingsRequest } from './request';

// The apps whose settings the panel shows, as the accounts API names their scopes (`APP_SITES` ids).
export type SettingsAppId =
  'livediagram.app' | 'liveplanner.app' | 'livedocuments.app' | 'livedesign.app';

// Each app's catalogue, as its own chunk: fetched only when that app's settings are first shown here.
const CATALOGUES: Record<SettingsAppId, () => Promise<{ CATALOGUE: AppCatalogue }>> = {
  'livediagram.app': () => import('@liveworkspace/settings/catalogues/livediagram'),
  'liveplanner.app': () => import('@liveworkspace/settings/catalogues/liveplanner'),
  'livedocuments.app': () => import('@liveworkspace/settings/catalogues/livedocuments'),
  'livedesign.app': () => import('@liveworkspace/settings/catalogues/livedesign'),
};

export const SETTINGS_APP_IDS = Object.keys(CATALOGUES) as SettingsAppId[];

export function isSettingsAppId(value: unknown): value is SettingsAppId {
  return typeof value === 'string' && Object.hasOwn(CATALOGUES, value);
}

export function loadAppCatalogue(app: SettingsAppId): Promise<AppCatalogue> {
  return CATALOGUES[app]().then((module) => module.CATALOGUE);
}

export interface SettingsStore {
  request: SettingsRequest;
  /** Both scopes for one app: the page's copy when it has one, else one read (shared by callers that ask at once).
   *  A failed read isn't kept, so asking again tries again. */
  loadApp: (app: SettingsAppId) => Promise<SettingsApiResult<AppScopes>>;
  /** The page's copy, after a change shown in the panel or an answer from the server. */
  remember: (app: SettingsAppId, value: AppScopes) => void;
  /** The page's copy of the `all` scope after it changed, into every app's copy. */
  rememberShared: (all: SettingsBlob) => void;
  patchApp: (app: SettingsAppId, patch: SettingsBlob) => Promise<SettingsApiResult<AppScopes>>;
  patchShared: (patch: SettingsBlob) => Promise<SettingsApiResult<{ all: SettingsBlob }>>;
  /** Test seam. */
  forget: () => void;
}

export function createSettingsStore(request: SettingsRequest): SettingsStore {
  const scopes = new Map<SettingsAppId, AppScopes>();
  const reads = new Map<SettingsAppId, Promise<SettingsApiResult<AppScopes>>>();
  return {
    request,
    loadApp(app) {
      const known = scopes.get(app);
      if (known) return Promise.resolve({ ok: true, data: known });
      let read = reads.get(app);
      if (!read) {
        read = request<AppScopes>(`/settings/${app}`).then((result) => {
          reads.delete(app);
          if (result.ok) scopes.set(app, { all: result.data.all, app: result.data.app });
          return result;
        });
        reads.set(app, read);
      }
      return read;
    },
    remember(app, value) {
      scopes.set(app, value);
    },
    rememberShared(all) {
      for (const [app, value] of scopes) scopes.set(app, { ...value, all });
    },
    patchApp: (app, patch) => request<AppScopes>(`/settings/${app}`, 'PATCH', { app: patch }),
    patchShared: (patch) => request<{ all: SettingsBlob }>('/settings', 'PATCH', { all: patch }),
    forget() {
      scopes.clear();
      reads.clear();
    },
  };
}

const stores = new WeakMap<SettingsRequest, SettingsStore>();

/** The store for a host's request (one per request, kept for the page's lifetime), or the host's own store. */
export function storeFor(source: SettingsStore | SettingsRequest): SettingsStore {
  if (typeof source !== 'function') return source;
  let store = stores.get(source);
  if (!store) {
    store = createSettingsStore(source);
    stores.set(source, store);
  }
  return store;
}

const MESSAGES: Record<string, string> = {
  invalid_name: 'That name can’t be used. Use up to 120 letters, numbers and punctuation.',
  invalid_color: 'That colour can’t be used. Pick one of the swatches.',
  unknown_owner: 'Your account couldn’t be found. Sign in again to carry on.',
  signed_out: 'You’ve been signed out. Sign in again to carry on.',
  offline: 'Couldn’t reach your account. Check your connection and try again.',
  settings_too_large: 'Your settings are full. Reset some, then try again.',
  rate_limited: 'Too many changes just now. Wait a minute and try again.',
  storage_unavailable:
    'This browser isn’t letting settings be saved. Allow this site to store data, then try again.',
};

/** What the panel says when a read or write of the account's settings is refused. */
export function settingsApiErrorMessage(error: string): string {
  return MESSAGES[error] ?? 'Something went wrong. Please try again.';
}
