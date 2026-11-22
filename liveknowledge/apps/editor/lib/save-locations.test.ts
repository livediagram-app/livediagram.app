import { describe, expect, it } from 'vitest';
import { defaultSaveLocationFor, isOfflineLocation } from './save-locations';

// docs/specs/006-document/save-locations.md: nobody is asked where a new document is stored; the default for who is
// creating decides, and exactly one id is the browser-only store (docs/specs/006-document/offline-mode.md), so a
// future location can't silently create offline.
describe('save locations', () => {
  // "The default depends on who is creating".
  it('starts a guest Offline', () => {
    expect(defaultSaveLocationFor({ signedIn: false })).toBe('browser');
  });

  it('starts a signed-in person on liveknowledge', () => {
    expect(defaultSaveLocationFor({ signedIn: true })).toBe('liveknowledge');
  });

  it('routes only Offline to the offline store', () => {
    expect(isOfflineLocation('browser')).toBe(true);
    expect(isOfflineLocation('liveknowledge')).toBe(false);
  });
});
