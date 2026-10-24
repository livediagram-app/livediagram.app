'use client';

import {
  bindRow,
  isBindableRow,
  SettingsChoiceRowView,
  SettingsToggleRowView,
  type SettingsCategory,
  type SettingsRow,
  type SettingsTrack,
} from '@liveworkspace/settings-ui';
import type { TelemetryCategory } from '@livedesign/api-schema';
import type { AppearanceSetting } from '@livedesign/ui';
import { SHORTCUT_SECTIONS } from '@/components/dialogs/shortcut-sections';
import { useAppearance } from '@/hooks/ui/useAppearance';
import { useShortcutsEnabled } from '@/hooks/ui/useShortcutsEnabled';
import { track } from '@/lib/telemetry';
import type { UserPreferences } from '@/lib/user-preferences';
import { presetSummaryLines } from './power-user-preset-rows';
import { rowSharedAcrossApps } from './settings-all-apps';
import type {
  SettingsAppearanceRowSpec,
  SettingsCategorySpec,
  SettingsRowSpec,
  SettingsShortcutsRowSpec,
} from './settings-catalogue';
import { settingsCategoryIcon } from './settings-icons';
import { SettingsDeleteAccountRow, SettingsIdentityRow } from './SettingsAccountRows';
import { SettingsDefaultFoldersRow } from './SettingsDefaultFoldersRow';
import { SettingsTokensRow } from './SettingsTokensRow';
import { SettingsTrashRow } from './SettingsTrashRow';

// This editor's Settings catalogue (settings-catalogue.ts, rows that read and write themselves over
// UserPreferences) as the shared Settings view's model (@liveworkspace/settings-ui;
// docs/specs/007-editor/user-preferences.md "One Settings view for every app"). The kinds every app
// shares are bound by the package; the rest are this editor's own rows, drawn here.

// Fired before the write, so an opt-out event still reaches the wire ahead of the preference that
// gates it (docs/specs/017-telemetry/telemetry.md).
const trackSetting: SettingsTrack = (category, action, type) =>
  track(category as TelemetryCategory, action, type);

export function settingsModel(
  categories: readonly SettingsCategorySpec[],
  settings: UserPreferences,
  onChange: (next: UserPreferences) => void,
  // Row keys the dialog offers right now, across every category: the preset readout's "Change"
  // goes only to those.
  offered: ReadonlySet<string> = new Set(categories.flatMap((c) => c.rows.map((r) => r.key))),
): SettingsCategory[] {
  const ctx = { settings, onChange, track: trackSetting };
  const modelRow = (row: SettingsRowSpec): SettingsRow => {
    if (isBindableRow(row)) return bindRow(row, ctx, rowSharedAcrossApps(row.key));
    switch (row.kind) {
      case 'presetSummary':
        return { ...row, kind: 'presetSummary', lines: presetSummaryLines(settings, offered) };
      case 'shortcutList':
        return { ...row, kind: 'shortcutList', sections: SHORTCUT_SECTIONS };
      case 'appearance':
        return { ...row, kind: 'custom', render: () => <AppearanceRow row={row} /> };
      case 'shortcuts':
        return { ...row, kind: 'custom', render: () => <ShortcutsRow row={row} /> };
      case 'tokens':
        return { ...row, kind: 'custom', render: () => <SettingsTokensRow row={row} /> };
      case 'identity':
        return { ...row, kind: 'custom', render: () => <SettingsIdentityRow row={row} /> };
      case 'deleteAccount':
        return { ...row, kind: 'custom', render: () => <SettingsDeleteAccountRow row={row} /> };
      case 'trash':
        return { ...row, kind: 'custom', render: () => <SettingsTrashRow row={row} /> };
      case 'defaultFolders':
        return { ...row, kind: 'custom', render: () => <SettingsDefaultFoldersRow row={row} /> };
    }
  };
  return categories.map((category) => ({
    id: category.id,
    label: category.label,
    icon: settingsCategoryIcon(category.id),
    ...(category.parent ? { parent: category.parent } : {}),
    ...(category.sectionNotes ? { sectionNotes: category.sectionNotes } : {}),
    ...(category.collapsedSections ? { collapsedSections: category.collapsedSections } : {}),
    rows: category.rows.map(modelRow),
  }));
}

const APPEARANCE_OPTIONS = [
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
  { id: 'system', label: 'System' },
];

// Appearance is the one row backed by its own device-local store rather than
// UserPreferences (docs/specs/007-editor/editor-app.md: a pre-hydration script applies it before first
// paint, so it cannot wait on a synced fetch). useAppearance emits the
// telemetry for the change itself, which is why nothing is tracked here.
function AppearanceRow({ row }: { row: SettingsAppearanceRowSpec }) {
  const { setting, set } = useAppearance();
  return (
    <SettingsChoiceRowView
      row={row}
      options={APPEARANCE_OPTIONS}
      value={setting}
      onChange={(next) => set(next as AppearanceSetting)}
    />
  );
}

// The keyboard-shortcuts master switch. Like appearance, it is backed by its
// own per-device localStorage store rather than UserPreferences (docs/specs/007-editor/editor-app.md),
// so it reads and writes here instead of through the catalogue. The hook
// emits its own telemetry on set, which is why nothing is tracked here.
function ShortcutsRow({ row }: { row: SettingsShortcutsRowSpec }) {
  const { enabled, setEnabled } = useShortcutsEnabled();
  return <SettingsToggleRowView row={row} checked={enabled} onChange={setEnabled} />;
}
