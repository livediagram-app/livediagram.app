import { describe, expect, it } from 'vitest';
import { upgradeLegacyPreferences } from './legacy-preferences';

describe('upgradeLegacyPreferences', () => {
  it('returns the same blob when no retired key is present', () => {
    const prefs = { theme: 'dark', reduceMotion: true };
    expect(upgradeLegacyPreferences(prefs)).toBe(prefs);
  });

  // docs/specs/007-editor/power-user-mode.md "What happens to stored preferences": the mode's keys go, and
  // everything its preset wrote stays as it is.
  it('drops the retired Power user mode keys and keeps what its preset set', () => {
    expect(
      upgradeLegacyPreferences({
        powerUserMode: true,
        powerUserBaseline: { reduceMotion: { before: {}, applied: { reduceMotion: true } } },
        minimalChrome: true,
        powerUserOfferShown: true,
        reduceMotion: true,
        notifyTips: false,
        formTourSeen: true,
        planTourSeen: true,
      }),
    ).toEqual({
      reduceMotion: true,
      notifyTips: false,
      formTourSeen: true,
      planTourSeen: true,
      planTourTracks: ['boards', 'sheets', 'dashboards'],
    });
  });

  it('keeps the Plan tour seen for someone who had the mode on, adding to the tracks already answered', () => {
    expect(
      upgradeLegacyPreferences({
        powerUserMode: true,
        planTourSeen: true,
        planTourTracks: ['sheets'],
      }).planTourTracks,
    ).toEqual(['sheets', 'boards', 'dashboards']);
  });

  it('leaves the Plan tour tracks alone when the mode was off or the tour was offered again', () => {
    expect(upgradeLegacyPreferences({ powerUserMode: false, planTourSeen: true })).toEqual({
      planTourSeen: true,
    });
    expect(upgradeLegacyPreferences({ powerUserMode: true, planTourSeen: false })).toEqual({
      planTourSeen: false,
    });
    expect(upgradeLegacyPreferences({ minimalChrome: false, theme: 'light' })).toEqual({
      theme: 'light',
    });
  });
});
