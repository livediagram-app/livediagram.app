import { describe, expect, it } from 'vitest';
import { upgradeLegacyPreferences } from './legacy-preferences';

describe('upgradeLegacyPreferences', () => {
  it('carries an opt-out stored under the old key to the new one', () => {
    expect(upgradeLegacyPreferences({ notifyDiagramJoin: false, theme: 'dark' })).toEqual({
      notifyDocumentJoin: false,
      theme: 'dark',
    });
  });

  it('lets the new key win when both are present', () => {
    expect(
      upgradeLegacyPreferences({ notifyDiagramJoin: false, notifyDocumentJoin: true }),
    ).toEqual({
      notifyDocumentJoin: true,
    });
  });

  // docs/specs/007-editor/editor-modes.md "Naming in the interface": Illustrate mode became Pages mode.
  it("carries the Illustrate tour's seen-guard and tracks to the Pages names", () => {
    expect(
      upgradeLegacyPreferences({ illustrateTourSeen: true, illustrateTourKinds: ['slide'] }),
    ).toEqual({ pagesTourSeen: true, pagesTourKinds: ['slide'] });
    expect(upgradeLegacyPreferences({ illustrateTourSeen: true, pagesTourSeen: false })).toEqual({
      pagesTourSeen: false,
    });
  });

  it('drops the retired tour guards and presenter settings', () => {
    expect(
      upgradeLegacyPreferences({
        facilitateTourSeen: true,
        workshopTourSeen: true,
        avatarTourSeen: true,
        presentation: { loop: true },
        theme: 'dark',
      }),
    ).toEqual({ theme: 'dark' });
  });

  it('drops the retired mode switches under every name', () => {
    expect(
      upgradeLegacyPreferences({
        illustrateModeEnabled: true,
        infographicModeEnabled: true,
        theme: 'dark',
      }),
    ).toEqual({ theme: 'dark' });
  });

  it('drops the retired Activity panel keys', () => {
    expect(
      upgradeLegacyPreferences({
        activityPanelEnabled: false,
        activityRevertHoverPreview: false,
        theme: 'dark',
      }),
    ).toEqual({ theme: 'dark' });
  });

  // docs/specs/007-editor/user-preferences.md "Retired keys": the New Document wizard has no Location step to skip.
  it('drops the retired skip-the-Location-step place, set or cleared', () => {
    const place = { saveLocation: 'liveplanner', placement: 'unsorted', placeName: 'My documents' };
    expect(upgradeLegacyPreferences({ skipLocationStep: place, theme: 'dark' })).toEqual({
      theme: 'dark',
    });
    expect(upgradeLegacyPreferences({ skipLocationStep: null })).toEqual({});
  });

  it('returns the same object when there is nothing to upgrade', () => {
    const prefs = { notifyDocumentJoin: false };
    expect(upgradeLegacyPreferences(prefs)).toBe(prefs);
  });
});
