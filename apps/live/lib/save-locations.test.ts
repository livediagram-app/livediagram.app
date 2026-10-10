import { describe, expect, it } from 'vitest';
import {
  SAVE_LOCATIONS,
  defaultSaveLocationFor,
  isOfflineLocation,
  saveLocationLabel,
  type SaveLocationId,
} from './save-locations';

// The catalogue drives the Save location tiles (docs/specs/006-document/save-locations.md) and the create
// branch in /new. Pin the invariants a new entry must keep: livediagram is
// the first tile, ids are unique, and exactly one id is the browser-only
// store (docs/specs/006-document/offline-mode.md), so a future location can't silently create offline.
describe('save locations', () => {
  it('lists livediagram first', () => {
    expect(SAVE_LOCATIONS[0]?.id).toBe('livediagram');
  });

  // docs/specs/006-document/save-locations.md "The default depends on who is creating".
  it('starts a guest on Local Browser when sign-in is enabled', () => {
    expect(defaultSaveLocationFor({ signedIn: false, clerkEnabled: true })).toBe('browser');
  });

  it('starts a signed-in person on livediagram', () => {
    expect(defaultSaveLocationFor({ signedIn: true, clerkEnabled: true })).toBe('livediagram');
  });

  it('starts everyone on livediagram on a deployment without sign-in', () => {
    expect(defaultSaveLocationFor({ signedIn: false, clerkEnabled: false })).toBe('livediagram');
  });

  it('has a unique id and a label + caption per tile', () => {
    const ids = SAVE_LOCATIONS.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const loc of SAVE_LOCATIONS) {
      expect(loc.label.trim()).not.toBe('');
      expect(loc.description.trim()).not.toBe('');
    }
  });

  it('names the folder heading after the location', () => {
    expect(saveLocationLabel('livediagram')).toBe('livediagram');
    expect(saveLocationLabel('browser')).toBe('Local Browser');
  });

  it('routes only Local Browser to the offline store', () => {
    const offline = SAVE_LOCATIONS.filter((l) => isOfflineLocation(l.id)).map((l) => l.id);
    expect(offline).toEqual<SaveLocationId[]>(['browser']);
  });
});
