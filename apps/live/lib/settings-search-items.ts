// The settings catalogue surfaced by the global SearchPanel (docs/specs/007-editor/user-preferences.md).
//
// Every preference now lives in the Settings dialog, which makes the dialog
// the place to LOOK, but only once you have thought to open it. Feeding the
// same rows into the app-wide search closes that gap: "dark mode" typed into
// the canvas search finds Theme, and picking it opens Settings on the row.
//
// Built from the one catalogue, so a setting cannot be searchable-but-absent
// or present-but-unsearchable. Matching runs over the same description +
// keyword synonyms the in-dialog search uses.

import { SETTINGS_CATEGORIES } from '@/components/dialogs/settings/settings-catalogue';
import type { SettingSearchItem } from './search';

/** The built settings catalogue passed to the SearchPanel. Static, built once. */
export const SETTINGS_SEARCH_ITEMS: SettingSearchItem[] = SETTINGS_CATEGORIES.flatMap((category) =>
  category.rows.map((row) => ({
    id: `setting:${category.id}/${row.key}`,
    title: row.label,
    // The category and section names are part of the haystack for the same
    // reason they are in the dialog's own search: "layers" should find the
    // three layer rows without appearing in any of their labels.
    keywords: `${category.label} ${row.section ?? ''} ${row.description} ${row.keywords ?? ''}`,
    categoryId: category.id,
    categoryLabel: category.label,
    rowKey: row.key,
  })),
);
