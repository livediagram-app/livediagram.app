import { describe, expect, it } from 'vitest';
import { defaultSaveLocationFor, isOfflineLocation } from './save-locations';

// docs/specs/006-document/save-locations.md: nobody is asked where a new document is stored; it is livedocuments, and exactly one id is the browser-only store (docs/specs/006-document/offline-mode.md), so a
// future location can't silently create offline.
describe('save locations', () => {
  // "The default".
  it('starts everyone on livedocuments, a guest included', () => {
    expect(defaultSaveLocationFor()).toBe('livedocuments');
  });

  it('routes only This Browser to the offline store', () => {
    expect(isOfflineLocation('browser')).toBe(true);
    expect(isOfflineLocation('livedocuments')).toBe(false);
  });
});
