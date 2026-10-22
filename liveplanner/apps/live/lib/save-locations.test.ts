import { describe, expect, it } from 'vitest';
import { defaultSaveLocationFor, isOfflineLocation } from './save-locations';

// docs/specs/006-document/save-locations.md: nobody is asked where a new document is stored; the default for who is
// creating decides, and exactly one id is the browser-only store (docs/specs/006-document/offline-mode.md), so a
// future location can't silently create offline.
describe('save locations', () => {
  // "The default depends on who is creating".
  it('starts a guest on This Browser when sign-in is enabled', () => {
    expect(defaultSaveLocationFor({ signedIn: false, signInEnabled: true })).toBe('browser');
  });

  it('starts a signed-in person on liveplanner', () => {
    expect(defaultSaveLocationFor({ signedIn: true, signInEnabled: true })).toBe('liveplanner');
  });

  it('starts everyone on liveplanner on a deployment without sign-in', () => {
    expect(defaultSaveLocationFor({ signedIn: false, signInEnabled: false })).toBe('liveplanner');
  });

  it('routes only This Browser to the offline store', () => {
    expect(isOfflineLocation('browser')).toBe(true);
    expect(isOfflineLocation('liveplanner')).toBe(false);
  });
});
