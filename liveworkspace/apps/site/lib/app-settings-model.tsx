// One app's own settings (its derived catalogue and its stored scopes) as the shared Settings view's
// model (@liveworkspace/settings-ui), so the "Your apps" dialog draws them exactly as the app's own
// Settings does (liveworkspace/docs/site.md "Your account"). Values are read from both scopes
// together; a change hands the row's binding and the value to store to `change`, which saves it.
import { joinSettings } from '@liveworkspace/settings';
import {
  readChoiceValue,
  readSliderValue,
  readToggleValue,
  type AppCatalogue,
  type CatalogueBinding,
  type CatalogueRow,
  type CatalogueSlider,
  type StoredValue,
} from '@liveworkspace/settings/catalogue';
import {
  SettingsCategoryTile,
  type SettingsCategory,
  type SettingsRow,
  type SettingsTileId,
} from '@liveworkspace/settings-ui';
import { visibleRows, type AppScopes } from './app-settings';

export type AppSettingChange = (binding: CatalogueBinding, stored: StoredValue) => void;

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

// The app's label for a slider's value, as its own slider shows it.
const sliderLabel = (row: CatalogueSlider) => (value: number) =>
  row.labels[Math.round((value - row.min) / row.step)] ?? String(value);

function modelRow(
  row: CatalogueRow,
  joined: Record<string, unknown>,
  shown: ReadonlySet<string>,
  change: AppSettingChange,
): SettingsRow {
  const text = {
    key: row.id,
    label: row.label,
    description: row.description,
    ...(row.keywords ? { keywords: row.keywords } : {}),
    ...(row.section ? { section: row.section } : {}),
    // Nested under its switch while that is shown (a nested row shows only while it is on).
    ...(row.parent && shown.has(row.parent) ? { parent: row.parent } : {}),
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

/** The app's categories with the rows showing now (a power user's only in Power User Mode, a nested
 *  row only while its switch is on), none left empty. A sub-category whose parent shows nothing is
 *  named by its path at the top level instead. */
export function appSettingsModel(
  catalogue: AppCatalogue,
  value: AppScopes,
  change: AppSettingChange,
): SettingsCategory[] {
  const joined = joinSettings(value.all, value.app);
  const shownCategories = catalogue.categories
    .map((category) => ({ category, rows: visibleRows(category, value) }))
    .filter(({ rows }) => rows.length > 0);
  const ids = new Set(shownCategories.map(({ category }) => category.id));
  const byId = new Map(catalogue.categories.map((c) => [c.id, c]));
  return shownCategories.map(({ category, rows }) => {
    const shownRows = new Set(rows.map((row) => row.id));
    const parent = category.parent;
    const nested = parent !== undefined && ids.has(parent);
    // Drawn at the top level for want of its parent, it takes the parent's tile.
    const tile =
      category.tile ?? (parent !== undefined && !nested ? byId.get(parent)?.tile : undefined);
    return {
      id: category.id,
      label:
        parent !== undefined && !nested
          ? `${byId.get(parent)?.label ?? parent} › ${category.label}`
          : category.label,
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
