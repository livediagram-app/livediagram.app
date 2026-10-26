import { describe, expect, it } from 'vitest';
import { SETTINGS_CATEGORIES } from './settings-catalogue';
import { rowSharedByAllApps } from './settings-model';

// The quiet "All apps" note (docs/specs/007-editor/user-preferences.md "Shared with every app").
describe('rowSharedByAllApps', () => {
  const rowKeys = SETTINGS_CATEGORIES.flatMap((c) => c.rows.map((r) => r.key));

  it('marks the rows whose setting every app shares, and only those', () => {
    expect(rowSharedByAllApps('reduceMotion')).toBe(true);
    expect(rowSharedByAllApps('uiScale-panels')).toBe(true);
    expect(rowSharedByAllApps('uiScale-cornerButtons')).toBe(true);
    // A setting two or more apps have is one shared setting (liveworkspace/docs/specs/003-accounts/accounts.md "Common settings").
    expect(rowSharedByAllApps('showMinimap')).toBe(true);
    expect(rowSharedByAllApps('presentation-loop')).toBe(true);
    expect(rowSharedByAllApps('presentationAutoAdvance')).toBe(true);
    // livediagram's own.
    expect(rowSharedByAllApps('notifyDocumentJoin')).toBe(false);
    expect(rowSharedByAllApps('whiteboardDockPosition')).toBe(false);
  });

  it('marks the shared rows this editor offers', () => {
    const shared = rowKeys.filter((key) => rowSharedByAllApps(key));
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
