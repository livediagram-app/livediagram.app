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

  // docs/specs/007-editor/pages-mode.md "One mode": Illustrate mode became Pages mode.
  it("carries the Illustrate tour's seen-guard and tracks to the Pages names", () => {
    expect(
      upgradeLegacyPreferences({ illustrateTourSeen: true, illustrateTourKinds: ['slide'] }),
    ).toEqual({ pagesTourSeen: true, pagesTourKinds: ['slide'] });
    expect(upgradeLegacyPreferences({ illustrateTourSeen: true, pagesTourSeen: false })).toEqual({
      pagesTourSeen: false,
    });
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
    const place = { saveLocation: 'livedocuments', placement: 'unsorted', placeName: 'My Work' };
    expect(upgradeLegacyPreferences({ skipLocationStep: place, theme: 'dark' })).toEqual({
      theme: 'dark',
    });
    expect(upgradeLegacyPreferences({ skipLocationStep: null })).toEqual({});
  });

  // docs/specs/007-editor/power-user-mode.md "What happens to stored preferences": the mode's keys go, and
  // everything its preset wrote stays as it is.
  it('drops the retired Power user mode keys and keeps what its preset set', () => {
    expect(
      upgradeLegacyPreferences({
        powerUserMode: true,
        powerUserBaseline: { alignmentGuides: { before: {}, applied: { alignmentGuides: true } } },
        minimalChrome: true,
        powerUserOfferShown: true,
        alignmentGuides: true,
        autoRebindArrows: false,
        elementToursSeen: true,
        pagesTourSeen: true,
      }),
    ).toEqual({
      alignmentGuides: true,
      autoRebindArrows: false,
      elementToursSeen: true,
      pagesTourSeen: true,
      pagesTourKinds: ['slide', 'infographic', 'article', 'flashcard'],
    });
  });

  it('keeps the Pages tour seen for someone who had the mode on, adding to the kinds already answered', () => {
    expect(
      upgradeLegacyPreferences({
        powerUserMode: true,
        pagesTourSeen: true,
        pagesTourKinds: ['article'],
      }).pagesTourKinds,
    ).toEqual(['article', 'slide', 'infographic', 'flashcard']);
    // The Illustrate names, carried over first, count too.
    expect(
      upgradeLegacyPreferences<Record<string, unknown>>({
        powerUserMode: true,
        illustrateTourSeen: true,
      }).pagesTourKinds,
    ).toEqual(['slide', 'infographic', 'article', 'flashcard']);
  });

  it('leaves the Pages tour kinds alone when the mode was off or the tour was offered again', () => {
    expect(upgradeLegacyPreferences({ powerUserMode: false, pagesTourSeen: true })).toEqual({
      pagesTourSeen: true,
    });
    expect(upgradeLegacyPreferences({ powerUserMode: true, pagesTourSeen: false })).toEqual({
      pagesTourSeen: false,
    });
    expect(upgradeLegacyPreferences({ minimalChrome: false, theme: 'light' })).toEqual({
      theme: 'light',
    });
  });

  it('returns the same object when there is nothing to upgrade', () => {
    const prefs = { notifyDocumentJoin: false };
    expect(upgradeLegacyPreferences(prefs)).toBe(prefs);
  });
});
