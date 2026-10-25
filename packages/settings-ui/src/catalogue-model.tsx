// One app's settings as plain data (its derived catalogue, @liveworkspace/settings/catalogues/<app>, and its stored
// scopes) as the Settings view's model, so the Settings panel draws another app's settings exactly as that app's
// own Settings does (liveworkspace/docs/site.md "Settings"). Values are read from both scopes together; a change
// hands the row's binding and the value to store to `change`, which saves it.
import { isAllSetting, joinSettings, type SettingsBlob } from '@liveworkspace/settings';
import {
  readChoiceValue,
  readSliderValue,
  readToggleValue,
  type AppCatalogue,
  type CatalogueBinding,
  type CatalogueCategory,
  type CatalogueRow,
  type CatalogueSlider,
  type StoredValue,
} from '@liveworkspace/settings/catalogue';
import { rowBindings } from '@liveworkspace/settings/common';
import { SettingsCategoryTile, type SettingsTileId } from './glyphs';
import type { SettingsCategory, SettingsRow } from './model';

export type CatalogueChange = (binding: CatalogueBinding, stored: StoredValue) => void;

// Both scopes for one app: the `all` every app shares, and the app's own.
export interface AppScopes {
  all: SettingsBlob;
  app: SettingsBlob;
}

const TILES = new Set<string>([
  'account',
  'folder',
  'editor',
  'appearance',
  'keyboard',
  'panels',
  'accessibility',
  'tours',
  'privacy',
] satisfies SettingsTileId[]);

// The rows to show now: a power user's only with Power User Mode on, and a nested row only while its switch is
// on, as the app's own Settings does.
export function visibleCatalogueRows(
  category: CatalogueCategory,
  value: AppScopes,
): CatalogueRow[] {
  const joined = joinSettings(value.all, value.app);
  return category.rows.filter(
    (row) =>
      (!row.powerUser || joined.powerUserMode === true) &&
      (!row.when || readToggleValue(joined, row.when)),
  );
}

// The app's label for a slider's value, as its own slider shows it.
const sliderLabel = (row: CatalogueSlider) => (value: number) =>
  row.labels[Math.round((value - row.min) / row.step)] ?? String(value);

function modelRow(
  row: CatalogueRow,
  joined: Record<string, unknown>,
  shown: ReadonlySet<string>,
  change: CatalogueChange,
): SettingsRow {
  const text = {
    key: row.id,
    label: row.label,
    description: row.description,
    ...(row.keywords ? { keywords: row.keywords } : {}),
    ...(row.section ? { section: row.section } : {}),
    // Nested under its switch while that is shown (a nested row shows only while it is on).
    ...(row.parent && shown.has(row.parent) ? { parent: row.parent } : {}),
    // A common setting, kept in `all`: changed here, it changes in every app that has it.
    ...(rowBindings(row).every((binding) => isAllSetting(binding.key)) ? { allApps: true } : {}),
  };
  switch (row.kind) {
    case 'toggle':
      return {
        ...text,
        kind: 'toggle',
        value: readToggleValue(joined, row),
        onChange: (next) => change(row, next ? row.on : row.off),
      };
    case 'choice':
      return {
        ...text,
        kind: 'choice',
        options: row.options.map(({ id, label }) => ({ id, label })),
        value: readChoiceValue(joined, row),
        onChange: (next) => {
          const option = row.options.find((o) => o.id === next);
          if (option) change(row, option.value);
        },
      };
    case 'slider':
      return {
        ...text,
        kind: 'slider',
        min: row.min,
        max: row.max,
        step: row.step,
        format: sliderLabel(row),
        value: readSliderValue(joined, row),
        onCommit: (next) => change(row, next),
      };
    case 'toggleGroup':
      return {
        ...text,
        kind: 'toggleGroup',
        toggles: row.toggles.map((toggle) => ({
          key: toggle.id,
          label: toggle.label,
          value: readToggleValue(joined, toggle),
          onChange: (next: boolean) => change(toggle, next ? toggle.on : toggle.off),
        })),
      };
  }
}

/** A path's name, short enough for the rail ("Panels › Collaborate" was cut off): its group alone when it is the
 *  only category shown from that group ("Panels"), else its own name ("Map", beside "Layers"). Account's are
 *  always by their own name ("Notifications"). */
export function shortLabel(label: string, groups: ReadonlyMap<string, number>): string {
  const parts = label.split(' › ');
  if (parts.length < 2) return label;
  const group = parts[0]!;
  const own = parts.at(-1)!;
  return group === 'Account' || (groups.get(group) ?? 0) > 1 ? own : group;
}

/** The app's categories with the rows showing now (a power user's only in Power User Mode, a nested row only while
 *  its switch is on), none left empty. A sub-category whose parent shows nothing sits at the top level, under a
 *  short name (shortLabel). */
export function catalogueModel(
  catalogue: AppCatalogue,
  value: AppScopes,
  change: CatalogueChange,
): SettingsCategory[] {
  const joined = joinSettings(value.all, value.app);
  const shownCategories = catalogue.categories
    .map((category) => ({ category, rows: visibleCatalogueRows(category, value) }))
    .filter(({ rows }) => rows.length > 0);
  const ids = new Set(shownCategories.map(({ category }) => category.id));
  const byId = new Map(catalogue.categories.map((c) => [c.id, c]));
  // Each category's full path: a sub-category shown without its parent is named under it.
  const path = (category: CatalogueCategory) =>
    category.parent !== undefined && !ids.has(category.parent)
      ? `${byId.get(category.parent)?.label ?? category.parent} › ${category.label}`
      : category.label;
  // How many categories shown here share each path's group ("Panels" in "Panels › Map").
  const groups = new Map<string, number>();
  for (const { category } of shownCategories) {
    const [group, rest] = path(category).split(' › ');
    if (rest && group) groups.set(group, (groups.get(group) ?? 0) + 1);
  }
  return shownCategories.map(({ category, rows }) => {
    const shownRows = new Set(rows.map((row) => row.id));
    const parent = category.parent;
    const nested = parent !== undefined && ids.has(parent);
    // Drawn at the top level for want of its parent, it takes the parent's tile.
    const tile =
      category.tile ?? (parent !== undefined && !nested ? byId.get(parent)?.tile : undefined);
    return {
      id: category.id,
      label: shortLabel(path(category), groups),
      ...(nested ? { parent } : {}),
      ...(tile && TILES.has(tile)
        ? { icon: <SettingsCategoryTile id={tile as SettingsTileId} /> }
        : {}),
      ...(category.sectionNotes
        ? {
            sectionNotes: Object.fromEntries(
              Object.entries(category.sectionNotes).map(([section, note]) => [section, { note }]),
            ),
          }
        : {}),
      ...(category.collapsedSections ? { collapsedSections: category.collapsedSections } : {}),
      rows: rows.map((row) => modelRow(row, joined, shownRows, change)),
    };
  });
}
