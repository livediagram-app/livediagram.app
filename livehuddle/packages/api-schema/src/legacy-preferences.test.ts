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

  // docs/specs/007-editor/editor-modes.md "Naming in the interface": Facilitate mode became Workshop mode.
  it("carries the Facilitate tour's seen-guard to the Workshop name", () => {
    expect(upgradeLegacyPreferences({ facilitateTourSeen: true, theme: 'dark' })).toEqual({
      workshopTourSeen: true,
      theme: 'dark',
    });
    expect(upgradeLegacyPreferences({ facilitateTourSeen: true, workshopTourSeen: false })).toEqual(
      {
        workshopTourSeen: false,
      },
    );
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
        tourSeen: true,
        elementToursSeen: true,
      }),
    ).toEqual({
      alignmentGuides: true,
      autoRebindArrows: false,
      tourSeen: true,
      elementToursSeen: true,
    });
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
    const place = { saveLocation: 'livehuddle', placement: 'unsorted', placeName: 'My Work' };
    expect(upgradeLegacyPreferences({ skipLocationStep: place, theme: 'dark' })).toEqual({
      theme: 'dark',
    });
    expect(upgradeLegacyPreferences({ skipLocationStep: null })).toEqual({});
  });

  // The in-editor AI assistant is gone, and its two switches with it.
  it('drops the retired AI assistant switches', () => {
    expect(
      upgradeLegacyPreferences({
        aiAssistanceEnabled: true,
        aiSuggestedPrompts: false,
        theme: 'dark',
      }),
    ).toEqual({ theme: 'dark' });
  });

  it('returns the same object when there is nothing to upgrade', () => {
    const prefs = { notifyDocumentJoin: false };
    expect(upgradeLegacyPreferences(prefs)).toBe(prefs);
  });
});
