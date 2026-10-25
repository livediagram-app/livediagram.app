import { isAllSetting, settingKeyOfRow } from '@liveworkspace/settings';

// Whether a Settings row's value is one every liveworkspace app shares (ALL_SETTING_KEYS), so the
// row says "All apps" and nobody is surprised when the change turns up in another app.
export function rowSharedAcrossApps(rowKey: string): boolean {
  return isAllSetting(settingKeyOf(rowKey));
}

// The preference a row stands for. A row's key is its preference's, except a UI scale part's
// (`uiScale-panels`, which writes `uiScalePanels`) and a Presenting option's (`presentation-loop`, a
// field of `presentation`).
export function settingKeyOf(rowKey: string): string {
  return settingKeyOfRow(rowKey);
}
