// The settings catalogue surfaced by the global SearchPanel (docs/specs/007-editor/user-preferences.md).
//
// Every preference lives in the Settings dialog, which makes the dialog the place to LOOK, but only once you have
// thought to open it. Feeding the same rows into the app-wide search closes that gap: "dark mode" typed into the
// canvas search finds Theme, and picking it opens Settings on the row.
//
// Built from the editor's one catalogue (its components/dialogs/settings/settings-catalogue), so a setting cannot be
// searchable-but-absent or present-but-unsearchable. Matching runs over the same description + keyword synonyms the
// in-dialog search uses.
import type { SettingSearchItem } from './types';

type SettingsRow = {
  key: string;
  label: string;
  description: string;
  section?: string;
  keywords?: string;
};

export function buildSettingsSearchItems<
  Category extends { id: string; rows: readonly SettingsRow[] },
>(
  categories: readonly Category[],
  categoryPath: (category: Category) => string,
): SettingSearchItem[] {
  return categories.flatMap((category) =>
    category.rows.map((row) => ({
      id: `setting:${category.id}/${row.key}`,
      title: row.label,
      // The category path and section names are part of the haystack for the same reason they are in the dialog's
      // own search: "panels" should find the layer rows without appearing in any of their labels.
      keywords: `${categoryPath(category)} ${row.section ?? ''} ${row.description} ${row.keywords ?? ''}`,
      categoryId: category.id,
      // A sub-category reads as its path ("in Account › Notifications"), the way the dialog's sidebar nests it.
      categoryLabel: categoryPath(category),
      rowKey: row.key,
    })),
  );
}
