// Each app's own settings, shown in a dialog on the settings page (liveworkspace/docs/site.md "Your
// account"): the app's scope in the accounts database, read and written through
// /api/account/settings/:app, and the app's catalogue of them (@liveworkspace/settings/catalogues),
// loaded only when its dialog first opens. Both are kept for the page's lifetime, so opening a
// dialog again costs nothing.
import { joinSettings, type SettingsBlob } from '@liveworkspace/settings';
import {
  readToggleValue,
  type AppCatalogue,
  type CatalogueCategory,
  type CatalogueRow,
} from '@liveworkspace/settings/catalogue';
import { APP_SITES, type SiteId } from '@liveworkspace/sites';
import { accountApi, type ApiResult } from './account-api';

export type AppId = Exclude<SiteId, 'liveworkspace.app'>;

// Each app's catalogue, as its own chunk.
const CATALOGUES: Record<AppId, () => Promise<{ CATALOGUE: AppCatalogue }>> = {
  'livediagram.app': () => import('@liveworkspace/settings/catalogues/livediagram'),
  'liveplanner.app': () => import('@liveworkspace/settings/catalogues/liveplanner'),
  'livedocuments.app': () => import('@liveworkspace/settings/catalogues/livedocuments'),
  'livedesign.app': () => import('@liveworkspace/settings/catalogues/livedesign'),
};

export function isAppId(value: unknown): value is AppId {
  return typeof value === 'string' && Object.hasOwn(CATALOGUES, value);
}

// The app a `?app=` deep link names: its site id or its name (`livediagram.app` or `livediagram`).
export function appFromParam(value: string | null): AppId | null {
  if (!value) return null;
  const site = APP_SITES.find((s) => s.id === value || s.name === value.toLowerCase());
  return site && isAppId(site.id) ? site.id : null;
}

export function loadCatalogue(app: AppId): Promise<AppCatalogue> {
  return CATALOGUES[app]().then((module) => module.CATALOGUE);
}

// Both scopes for one app, as the dialog holds them.
export interface AppScopes {
  all: SettingsBlob;
  app: SettingsBlob;
}

const scopes = new Map<AppId, AppScopes>();
const reads = new Map<AppId, Promise<ApiResult<AppScopes>>>();

// The app's settings: from the page's copy when it has one, else one read (shared by callers that
// ask at once). A failed read isn't kept, so opening the dialog again tries again.
export function loadAppScopes(app: AppId): Promise<ApiResult<AppScopes>> {
  const known = scopes.get(app);
  if (known) return Promise.resolve({ ok: true, data: known });
  let read = reads.get(app);
  if (!read) {
    read = accountApi<AppScopes>(`/settings/${app}`).then((result) => {
      reads.delete(app);
      if (result.ok) scopes.set(app, { all: result.data.all, app: result.data.app });
      return result;
    });
    reads.set(app, read);
  }
  return read;
}

// The page's copy, after a change shown here or an answer from the server.
export function rememberAppScopes(app: AppId, value: AppScopes): void {
  scopes.set(app, value);
}

// Test seam.
export function __forgetAppScopes(): void {
  scopes.clear();
  reads.clear();
}

// One patch of the app's own scope: just the keys named.
export function patchAppScope(app: AppId, patch: SettingsBlob): Promise<ApiResult<AppScopes>> {
  return accountApi<AppScopes>(`/settings/${app}`, 'PATCH', { app: patch });
}

// The rows to show now: a power user's only with Power User Mode on, and a nested row only while its
// switch is on, as the app's own Settings does.
export function visibleRows(category: CatalogueCategory, value: AppScopes): CatalogueRow[] {
  const joined = joinSettings(value.all, value.app);
  return category.rows.filter(
    (row) =>
      (!row.powerUser || joined.powerUserMode === true) &&
      (!row.when || readToggleValue(joined, row.when)),
  );
}

// A row's group within its category: consecutive rows sharing a section, as the app draws them.
export function sectionRuns(rows: CatalogueRow[]): { section?: string; rows: CatalogueRow[] }[] {
  const runs: { section?: string; rows: CatalogueRow[] }[] = [];
  for (const row of rows) {
    const last = runs.at(-1);
    if (last && last.section === row.section) last.rows.push(row);
    else runs.push({ section: row.section, rows: [row] });
  }
  return runs;
}
