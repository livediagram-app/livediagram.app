import { describe, expect, it } from 'vitest';
import { SETTINGS_CATEGORIES } from './settings-catalogue';
import { rowSharedByAllApps } from './SettingsRowShell';

// The quiet "All apps" note (docs/specs/007-editor/user-preferences.md "Shared with every app").
describe('rowSharedByAllApps', () => {
  const rowKeys = SETTINGS_CATEGORIES.flatMap((c) => c.rows.map((r) => r.key));

  it('marks the rows whose setting every app shares, and only those', () => {
    expect(rowSharedByAllApps('reduceMotion', true)).toBe(true);
    expect(rowSharedByAllApps('uiScale-panels', true)).toBe(true);
    expect(rowSharedByAllApps('uiScale-cornerButtons', true)).toBe(true);
    expect(rowSharedByAllApps('showMinimap', true)).toBe(false);
    expect(rowSharedByAllApps('notifyDocumentJoin', true)).toBe(false);
  });

  it('says nothing where preferences stay in this browser (no sign-in)', () => {
    expect(rowSharedByAllApps('reduceMotion', false)).toBe(false);
  });

  it('marks the shared rows this editor offers', () => {
    const shared = rowKeys.filter((key) => rowSharedByAllApps(key, true));
    expect(shared).toEqual(
      expect.arrayContaining([
        'reduceMotion',
        'telemetryEnabled',
        'notificationsEnabled',
        'panelOpacity',
        'uiScale-panels',
      ]),
    );
  });
});
