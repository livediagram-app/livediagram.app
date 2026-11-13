// The settings catalogue surfaced by the global SearchPanel (docs/specs/007-editor/user-preferences.md), built from
// this editor's one catalogue (@liveworkspace/workbench/lib/editor-search/settings-search-items).
import { buildSettingsSearchItems } from '@liveworkspace/workbench/lib/editor-search/settings-search-items';
import {
  SETTINGS_CATEGORIES,
  settingsCategoryPath,
} from '@/components/dialogs/settings/settings-catalogue';

/** The built settings catalogue passed to the SearchPanel. Static, built once. */
export const SETTINGS_SEARCH_ITEMS = buildSettingsSearchItems(
  SETTINGS_CATEGORIES,
  settingsCategoryPath,
);
