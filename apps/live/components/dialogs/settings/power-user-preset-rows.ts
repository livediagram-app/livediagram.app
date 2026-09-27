import { POWER_USER_PRESET, isUntouched, type PowerUserPresetSetting } from '@/lib/power-user-mode';
import type { UserPreferences } from '@/lib/user-preferences';
import type { SettingsCategoryId } from './settings-icons';
import { SETTINGS_CATEGORIES, type SettingsRowSpec } from './settings-catalogue';

// The "Set By Power User Mode" readout, as data (docs/specs/007-editor/power-user-mode.md#in-settings):
// one line per preset setting, read through that setting's own Settings row
// so the value can never disagree with the row it points at.

export type PresetSummaryLine = {
  setting: PowerUserPresetSetting;
  rowKey: string;
  categoryId: SettingsCategoryId;
  categoryLabel: string;
  label: string;
  value: string;
  // Switching on recorded a baseline for it, so switching off can restore it.
  // False when another client turned the mode on without one (P7).
  restorable: boolean;
  // Changed since the mode switched on, so switching off keeps it.
  changed: boolean;
  // Its row is offered in this dialog right now, so "Change" can go to it.
  reachable: boolean;
};

// Minimal chrome is the mode's own setting, nested beside the readout.
const SUMMARISED = (Object.keys(POWER_USER_PRESET) as PowerUserPresetSetting[]).filter(
  (s) => s !== 'minimalChrome',
);

function findRow(key: string) {
  for (const category of SETTINGS_CATEGORIES) {
    const row = category.rows.find((r) => r.key === key);
    if (row) return { category, row };
  }
  throw new Error(`No settings row "${key}" for the power user preset`);
}

function formatValue(row: SettingsRowSpec, prefs: UserPreferences): string {
  if (row.kind === 'toggle') return row.read(prefs) ? 'On' : 'Off';
  if (row.kind === 'choice') {
    const id = row.read(prefs);
    return row.options.find((o) => o.id === id)?.label ?? id;
  }
  throw new Error(`Preset row "${row.key}" is neither a toggle nor a choice`);
}

export function presetSummaryLines(
  prefs: UserPreferences,
  offered: ReadonlySet<string>,
): PresetSummaryLine[] {
  return SUMMARISED.map((setting) => {
    const { category, row } = findRow(setting);
    const entry = prefs.powerUserBaseline?.[setting];
    return {
      setting,
      rowKey: row.key,
      categoryId: category.id,
      categoryLabel: category.label,
      label: row.label,
      value: formatValue(row, prefs),
      restorable: !!entry,
      changed: entry ? !isUntouched(prefs, entry) : false,
      reachable: offered.has(row.key),
    };
  });
}
