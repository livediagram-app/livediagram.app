import { describe, expect, it } from 'vitest';
import { upgradeLegacyPreferences } from './legacy-preferences';

describe('upgradeLegacyPreferences', () => {
  it('carries an opt-out stored under the old key to the new one', () => {
    expect(upgradeLegacyPreferences({ notifyDiagramJoin: false, theme: 'dark' })).toEqual({
      notifyProjectJoin: false,
      theme: 'dark',
    });
  });

  it('lets the new key win when both are present', () => {
    expect(
      upgradeLegacyPreferences({ notifyDiagramJoin: false, notifyProjectJoin: true }),
    ).toEqual({
      notifyProjectJoin: true,
    });
  });

  it("drops Pages mode's tour, guide and Contents keys under every name", () => {
    expect(
      upgradeLegacyPreferences({
        illustrateTourSeen: true,
        illustrateTourKinds: ['slide'],
        pagesTourSeen: true,
        pagesTourKinds: ['slide'],
        logoGuides: false,
        logoGuidesHidden: ['grid'],
        logoGuideStrength: 'faint',
        contentsPlacement: 'button',
        theme: 'dark',
      }),
    ).toEqual({ theme: 'dark' });
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

  // docs/specs/007-editor/user-preferences.md "Retired keys": the New Project wizard has no Location step to skip.
  it('drops the retired skip-the-Location-step place, set or cleared', () => {
    const place = { saveLocation: 'liveplanner', placement: 'unsorted', placeName: 'My projects' };
    expect(upgradeLegacyPreferences({ skipLocationStep: place, theme: 'dark' })).toEqual({
      theme: 'dark',
    });
    expect(upgradeLegacyPreferences({ skipLocationStep: null })).toEqual({});
  });

  it('returns the same object when there is nothing to upgrade', () => {
    const prefs = { notifyProjectJoin: false };
    expect(upgradeLegacyPreferences(prefs)).toBe(prefs);
  });
});
