// This editor's side of the shared Settings panel (docs/specs/007-editor/user-preferences.md "This app or All"): the
// workbench's one host (its app id, its logos, the bearer request and the Account section's panels), bound to liveplanner.
import { createSettingsPanelHost } from '@liveworkspace/workbench/components/dialogs/settings/settings-panel-host';

export const {
  SETTINGS_APP,
  cloudSyncHost,
  settingsRequest,
  ACCOUNT_SETTINGS,
  renderSettingsLogo,
} = createSettingsPanelHost('liveplanner');
