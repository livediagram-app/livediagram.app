import { describe, expect, it } from 'vitest';
import { upgradeLegacyPreferences } from './legacy-preferences';

describe('upgradeLegacyPreferences', () => {
  it('returns the same blob when no retired key is present', () => {
    const prefs = { theme: 'dark', alignmentGuides: true };
    expect(upgradeLegacyPreferences(prefs)).toBe(prefs);
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
      pagesTourKinds: ['wireframe', 'logo', 'photo'],
    });
  });

  it('keeps the Pages tour seen for someone who had the mode on, adding to the kinds already answered', () => {
    expect(
      upgradeLegacyPreferences({
        powerUserMode: true,
        pagesTourSeen: true,
        pagesTourKinds: ['logo'],
      }).pagesTourKinds,
    ).toEqual(['logo', 'wireframe', 'photo']);
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
});
