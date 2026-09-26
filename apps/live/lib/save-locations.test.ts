import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SAVE_LOCATION,
  SAVE_LOCATIONS,
  isOfflineLocation,
  saveLocationLabel,
  type SaveLocationId,
} from './save-locations';

// The catalogue drives the Save location tiles (docs/specs/006-diagram/save-locations.md) and the create
// branch in /new. Pin the invariants a new entry must keep: the default is
// the first tile, ids are unique, and exactly one id is the browser-only
// store (docs/specs/006-diagram/offline-mode.md), so a future location can't silently create offline.
describe('save locations', () => {
  it('opens on livediagram, the first tile', () => {
    expect(DEFAULT_SAVE_LOCATION).toBe('livediagram');
    expect(SAVE_LOCATIONS[0]?.id).toBe(DEFAULT_SAVE_LOCATION);
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
    expect(isOfflineLocation(DEFAULT_SAVE_LOCATION)).toBe(false);
  });
});
