'use client';

// For tests: one category of this editor's catalogue in the shared pane, bound as the dialog binds it.
import { createSettingsTestPane } from '@liveworkspace/workbench/components/dialogs/settings/test-pane';
import type { UserPreferences } from '@/lib/user-preferences';
import type { SettingsCategorySpec } from './settings-catalogue';
import { SETTINGS_KIT } from './settings-kit';
import { settingsModel } from './settings-model';

export const SettingsCategoryPane = createSettingsTestPane<SettingsCategorySpec, UserPreferences>({
  settingsModel,
  kit: SETTINGS_KIT,
});
