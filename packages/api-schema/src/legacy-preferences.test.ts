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

  it('returns the same object when there is nothing to upgrade', () => {
    const prefs = { notifyDocumentJoin: false };
    expect(upgradeLegacyPreferences(prefs)).toBe(prefs);
  });
});
