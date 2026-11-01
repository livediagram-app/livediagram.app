// The one Settings panel every liveworkspace app's Settings and liveworkspace.app open (SettingsPanel: this app's
// settings or All, each app's docs/specs/007-editor/user-preferences.md "This app or All"), and the Settings view it
// draws (SettingsView, "One Settings view for every app"; liveworkspace/docs/specs/010-site/site.md "Settings").
export * from './model';
export {
  bindRow,
  isBindableRow,
  type BindableRow,
  type BindContext,
  type SettingsTrack,
} from './bind';
export {
  SettingsUiKitProvider,
  useSettingsUiKit,
  type SettingsIllustrationProps,
  type SettingsUiKit,
} from './kit';
export { SettingsView, type SettingsFocus } from './SettingsView';
export { SettingsCategoryPane } from './SettingsCategoryPane';
export { SettingsRowShell, SETTINGS_ROW_BUTTON } from './SettingsRowShell';
export {
  SettingsGroup,
  SETTINGS_CARD,
  SETTINGS_CARD_SLOT,
  useInSettingsGroup,
} from './SettingsGroup';
export { AccordionSection } from './AccordionSection';
export { SettingsToggleRowView } from './rows/ToggleRow';
export { SettingsChoiceRowView } from './rows/ChoiceRow';
export {
  SettingsCategoryTile,
  SettingsSharedGlyph,
  SettingsSubcategoryGlyph,
  type SettingsSharedGlyphId,
  type SettingsTileId,
} from './glyphs';
export {
  firstMatchingCategory,
  searchSettings,
  type SearchableCategory,
  type SettingsSearchResult,
} from './settings-search';
export { SETTINGS_ROW_ATTRIBUTE } from './settings-scroll-anchor';
export { readSettingsView, writeSettingsView } from './settings-view-memory';
export { SettingsScopeSwitch, useSettingsScope, type SettingsScope } from './scope';
export {
  SettingsPanel,
  preloadSettingsPanel,
  settingsPanelApp,
  type SettingsPanelApp,
} from './SettingsPanel';
export type { AccountHost } from './CatalogueSettingsView';
export { accountCategories, type AccountSection } from './account-model';
export {
  ProfileHeaderCard,
  colourLabel,
  type AccountGuest,
  type AccountIdentity,
} from './profile/ProfileHeader';
export {
  NAME_SAVE_DELAY_MS,
  ProfileEditor,
  ProfileSection,
  SETTINGS_INPUT,
} from './profile/ProfileEditor';
export {
  requestProfileHost,
  type Profile,
  type ProfileHost,
  type ProfilePatch,
  type ProfileResult,
} from './profile/profile-host';
export { announceProfileSaved, onProfileSaved, type SavedProfile } from './profile/profile-events';
export { useSavedFlash } from './useSavedFlash';
export {
  deviceName,
  type AccountSecurity,
  type AccountSession,
  type AccountSignInMethods,
} from './profile/SecurityRows';
export { foldIntoAccount } from './fold-account';
export {
  CLOUD_SYNC_PROVIDERS,
  cloudSyncRows,
  createCloudSyncHost,
  useCloudSync,
  type CloudSync,
  type CloudSyncHost,
} from './cloud-sync/cloud-sync-host';
export { ownToggleSetter } from './own-toggle';
export {
  catalogueModel,
  shortLabel,
  visibleCatalogueRows,
  type AppScopes,
  type CatalogueChange,
} from './catalogue-model';
export { groupCategories, groupedId } from './groups';
export { bearerSettingsRequest } from './request';
export {
  createSettingsStore,
  storeFor,
  isSettingsAppId,
  loadAppCatalogue,
  SETTINGS_APP_IDS,
  settingsApiErrorMessage,
  type SettingsApiResult,
  type SettingsAppId,
  type SettingsRequest,
  type SettingsStore,
} from './store';
export { createScopesSaver, type PanelScopes, type ScopesSaver } from './saver';
export {
  createDeviceSettingsStore,
  splitDeviceSettings,
  type DeviceSettingsOptions,
} from './device-store';

export { SETTINGS_DIALOG_CLASS, SETTINGS_DIALOG_SIZE } from './frame';
