import { ALL_SETTING_KEYS } from '@liveworkspace/settings';
import { describe, expect, it } from 'vitest';
import { rowSharedAcrossApps, settingKeyOf } from './settings-all-apps';
import { SETTINGS_CATEGORIES } from './settings-catalogue';

// A setting every liveworkspace app shares says so, quietly (liveworkspace/docs/accounts.md
// "Settings"; docs/specs/007-editor/user-preferences.md "Where they are kept"). The shared view
// draws the "All apps" note (@liveworkspace/settings-ui); this is which rows get it.

const rows = SETTINGS_CATEGORIES.flatMap((c) => c.rows);

describe('rowSharedAcrossApps', () => {
  it('marks a shared setting', () => {
    expect(rowSharedAcrossApps('reduceMotion')).toBe(true);
  });

  it('leaves a setting livedesign keeps for itself unmarked', () => {
    expect(rowSharedAcrossApps('logoGuides')).toBe(false);
    expect(rowSharedAcrossApps('notifyDesignJoin')).toBe(false);
  });

  it('marks a setting two or more apps have (liveworkspace/docs/accounts.md "Common settings")', () => {
    expect(rowSharedAcrossApps('showMinimap')).toBe(true);
    expect(rowSharedAcrossApps('presentation-loop')).toBe(true);
    expect(settingKeyOf('presentationAutoAdvance')).toBe('presentation');
  });

  it('marks a UI scale part by the preference it writes', () => {
    expect(settingKeyOf('uiScale-cornerButtons')).toBe('uiScaleCornerButtons');
    expect(settingKeyOf('uiScale-panels')).toBe('uiScalePanels');
    expect(rowSharedAcrossApps('uiScale-toolbar')).toBe(true);
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
