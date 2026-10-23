import { describe, expect, it } from 'vitest';
import { defaultSaveLocationFor, isOfflineLocation } from './save-locations';

// docs/specs/006-project/save-locations.md: nobody is asked where a new project is stored; it is liveplanner, and exactly one id is the browser-only store (docs/specs/006-project/offline-mode.md), so a
// future location can't silently create offline.
describe('save locations', () => {
  // "The default".
  it('starts everyone on liveplanner, a guest included', () => {
    expect(defaultSaveLocationFor()).toBe('liveplanner');
  });

  it('routes only This Browser to the offline store', () => {
    expect(isOfflineLocation('browser')).toBe(true);
    expect(isOfflineLocation('liveplanner')).toBe(false);
  });
});
