// The All view's Common group (liveworkspace/docs/site.md "Settings"): every editor setting two or more apps have,
// once (@liveworkspace/settings/common), as the Settings view's model. A row reads `all`, else the copy an app kept
// from before the setting was shared (the app the panel was opened for first), and writes `all` through that app's
// row, so the change is counted as that app's. In an editor, the rows the editor has are its own rows, bound to its
// live preferences, so a change there is synced and counted as on its own side.
import { COMMON_SETTING_KEYS, type SettingsBlob } from '@liveworkspace/settings';
import type { CatalogueBinding, StoredValue } from '@liveworkspace/settings/catalogue';
import { rowBindings, type CommonCatalogue } from '@liveworkspace/settings/common';
import { catalogueModel, type AppScopes } from './catalogue-model';
import { groupCategories } from './groups';
import type { SettingsCategory, SettingsRow } from './model';
import type { PanelScopes } from './saver';
import type { SettingsAppId } from './store';

export const COMMON_GROUP = 'common';

/** The scopes Common reads: `all`, and in place of one app's scope, each common setting's old copy from the first
 *  app in `order` that kept one. `from` names that app, per key. */
export function commonScopes(
  all: SettingsBlob,
  apps: PanelScopes['apps'],
  order: readonly SettingsAppId[],
): { scopes: AppScopes; from: Map<string, SettingsAppId> } {
  const legacy: SettingsBlob = {};
  const from = new Map<string, SettingsAppId>();
  for (const key of COMMON_SETTING_KEYS) {
    if (Object.hasOwn(all, key)) continue;
    const app = order.find((id) => Object.hasOwn(apps[id] ?? {}, key));
    if (!app) continue;
    legacy[key] = apps[app]![key];
    from.set(key, app);
  }
  return { scopes: { all, app: legacy }, from };
}

export function commonModel({
  common,
  all,
  apps,
  order,
  own,
  change,
  structure = false,
}: {
  common: CommonCatalogue;
  all: SettingsBlob;
  apps: PanelScopes['apps'];
  // The apps whose old copies count, the app the panel was opened for first.
  order: readonly SettingsAppId[];
  // The editor's own Settings and preferences, where the panel is an editor's.
  own?: { categories: readonly SettingsCategory[]; prefs: SettingsBlob };
  change: (app: SettingsAppId, binding: CatalogueBinding, stored: StoredValue) => void;
  // Every category under its own name, an empty one kept (catalogueModel's `structure`), for All's merge.
  structure?: boolean;
}): SettingsCategory[] {
  const ownRows = new Map<string, SettingsRow>(
    (own?.categories ?? []).flatMap((category) => category.rows.map((row) => [row.key, row])),
  );
  const rows = common.catalogue.categories.flatMap((category) => category.rows);
  // Which apps have each stored key, and which keys the editor's own rows hold.
  const keyApps = new Map<string, readonly string[]>();
  const ownKeys = new Set<string>();
  for (const row of rows) {
    for (const binding of rowBindings(row)) {
      keyApps.set(binding.key, common.apps.get(row.id) ?? []);
      if (ownRows.has(row.id)) ownKeys.add(binding.key);
    }
  }

  // The editor's own values win for the settings it has: its rows show them.
  let readAll = all;
  if (own && ownKeys.size > 0) {
    readAll = { ...all };
    for (const key of ownKeys) {
      if (Object.hasOwn(own.prefs, key)) readAll[key] = own.prefs[key];
      else delete readAll[key];
    }
  }
  const { scopes, from } = commonScopes(readAll, apps, order);
  for (const key of ownKeys) delete scopes.app[key];

  const writer = (key: string): SettingsAppId | undefined =>
    from.get(key) ?? order.find((app) => keyApps.get(key)?.includes(app));
  const categories = catalogueModel(
    common.catalogue,
    scopes,
    (binding, stored) => {
      const app = writer(binding.key);
      if (app) change(app, binding, stored);
    },
    { structure },
  ).map((category) => ({
    ...category,
    // The heading says every row here is shared, so no row repeats "All apps".
    rows: category.rows.map((row) => ({ ...(ownRows.get(row.key) ?? row), allApps: false })),
  }));
  return groupCategories(COMMON_GROUP, categories, { keepEmpty: structure });
}

/** Every Common row's id: what each app's own group leaves out. */
export function commonRowIds(common: CommonCatalogue): ReadonlySet<string> {
  return new Set(
    common.catalogue.categories.flatMap((category) => category.rows.map((row) => row.id)),
  );
}
