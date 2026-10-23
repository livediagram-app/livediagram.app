// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { ALL_SETTING_KEYS } from '@liveworkspace/settings';
import { afterEach, describe, expect, it } from 'vitest';
import { SETTINGS_CATEGORIES } from './settings-catalogue';
import { settingKeyOf, SettingsRowShell } from './SettingsRowShell';

// A setting every liveworkspace app shares says so, quietly (liveworkspace/docs/accounts.md
// "Settings"; docs/specs/007-editor/user-preferences.md "Where they are kept").

afterEach(cleanup);

const rows = SETTINGS_CATEGORIES.flatMap((c) => c.rows);

describe('SettingsRowShell "All apps" note', () => {
  it('marks a shared setting, in the description the control is described by', () => {
    render(
      <SettingsRowShell
        row={{ key: 'reduceMotion', label: 'Reduce Motion', description: 'Less movement.' }}
      />,
    );
    const note = screen.getByText('All apps');
    expect(note.closest('#reduceMotion-description')).not.toBeNull();
  });

  it('leaves a setting livedesign keeps for itself unmarked', () => {
    render(
      <SettingsRowShell row={{ key: 'showMinimap', label: 'Minimap', description: 'A map.' }} />,
    );
    expect(screen.queryByText('All apps')).toBeNull();
  });

  it('marks a UI scale part by the preference it writes', () => {
    expect(settingKeyOf('uiScale-cornerButtons')).toBe('uiScaleCornerButtons');
    expect(settingKeyOf('uiScale-panels')).toBe('uiScalePanels');
    render(
      <SettingsRowShell row={{ key: 'uiScale-toolbar', label: 'Toolbar', description: 'Size.' }} />,
    );
    expect(screen.getByText('All apps')).toBeTruthy();
  });

  it('finds a row for every shared key the dialog shows', () => {
    const shown = new Set(rows.map((r) => settingKeyOf(r.key)));
    const marked = ALL_SETTING_KEYS.filter((k) => shown.has(k));
    // The ones livedesign has a row for; the rest live in other apps or have no row.
    expect(marked).toEqual(
      expect.arrayContaining(['reduceMotion', 'telemetryEnabled', 'uiScale', 'uiScalePanels']),
    );
  });
});
