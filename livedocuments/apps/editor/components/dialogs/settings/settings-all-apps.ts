import { isAllSetting, isAllSettingRow } from '@liveworkspace/settings';
import { UI_SCALE_PARTS } from '@liveworkspace/workbench/lib/ui-scale';
import { preferencesKeptLocally } from '@/lib/preferences-sync';

// Whether a Settings row's value is one every liveworkspace app shares (ALL_SETTING_KEYS), so the
// row says "All apps" and nobody is surprised when the change turns up in another app. A row's key
// is its preference key, except a UI Scale part's row (`uiScale-panels` keeps `uiScalePanels`).
const PART_KEYS = new Map<string, string>(UI_SCALE_PARTS.map((p) => [`uiScale-${p.id}`, p.key]));

export function rowSharedAcrossApps(rowKey: string): boolean {
  // Where the api keeps no preferences (no liveworkspace accounts, as in local dev), they stay in this
  // browser and are shared with nothing.
  if (preferencesKeptLocally()) return false;
  const part = PART_KEYS.get(rowKey);
  return part ? isAllSetting(part) : isAllSettingRow(rowKey);
}
