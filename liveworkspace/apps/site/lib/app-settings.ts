// The Settings panel's reach into the account's settings from this site (liveworkspace/docs/site.md "Settings"):
// `/api/account/settings…` with the session on liveworkspace.app, or through an app's router with the page's token
// on that app's address (accountApi). The panel itself, its catalogues and what it reads are the shared package's
// (@liveworkspace/settings-ui); this is the site's one store of what it has read, kept for the page's lifetime.
import {
  createSettingsStore,
  isSettingsAppId,
  loadAppCatalogue,
  type SettingsAppId,
} from '@liveworkspace/settings-ui';
import type { AppCatalogue } from '@liveworkspace/settings/catalogue';
import { APP_SITES } from '@liveworkspace/sites';
import { accountApi } from './account-api';

export type AppId = SettingsAppId;

export const settingsStore = createSettingsStore(accountApi);

export function isAppId(value: unknown): value is AppId {
  return isSettingsAppId(value);
}

// The app a `?app=` deep link names: its site id or its name (`livediagram.app` or `livediagram`).
export function appFromParam(value: string | null): AppId | null {
  if (!value) return null;
  const site = APP_SITES.find((s) => s.id === value || s.name === value.toLowerCase());
  return site && isAppId(site.id) ? site.id : null;
}

export function loadCatalogue(app: AppId): Promise<AppCatalogue> {
  return loadAppCatalogue(app);
}
