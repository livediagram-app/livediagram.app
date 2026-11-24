import { describe, expect, it } from 'vitest';
import {
  mergePreferences,
  preferencesPatch,
  rebasePreferences,
  samePreference,
} from './preferences-merge';

const merge = (
  local: Record<string, unknown>,
  server: Record<string, unknown>,
  base: Record<string, unknown> | null,
  { unsynced = false } = {},
) => mergePreferences({ local, server, base, unsynced });

describe('samePreference', () => {
  it('compares whole values', () => {
    expect(samePreference(1, 1)).toBe(true);
    expect(samePreference({ a: [1] }, { a: [1] })).toBe(true);
    expect(samePreference({ a: [1] }, { a: [2] })).toBe(false);
    expect(samePreference(undefined, false)).toBe(false);
  });
});

describe('mergePreferences with a last copy agreed', () => {
  it('drops a key the server removed that this device never changed', () => {
    const base = { callSpace: 'room-1', reduceMotion: true };
    expect(merge({ ...base }, { reduceMotion: true }, base)).toEqual({ reduceMotion: true });
  });

  it('drops it even while the device holds an unsaved change to another key', () => {
    const base = { callSpace: 'room-1', mapSize: 'short' };
    expect(
      merge({ callSpace: 'room-1', mapSize: 'tall' }, { mapSize: 'short' }, base, {
        unsynced: true,
      }),
    ).toEqual({ mapSize: 'tall' });
  });

  it('takes a value the server changed over an unchanged local one', () => {
    const base = { mapSize: 'short' };
    expect(merge({ mapSize: 'short' }, { mapSize: 'tall' }, base)).toEqual({ mapSize: 'tall' });
  });

  it('adds a key the server gained', () => {
    expect(merge({}, { tourSeen: true }, {})).toEqual({ tourSeen: true });
  });

  it('keeps a key only this device changed, a removal included', () => {
    const base = { mapSize: 'short', homeBanner: false };
    expect(merge({ mapSize: 'tall' }, { mapSize: 'short', homeBanner: false }, base)).toEqual({
      mapSize: 'tall',
    });
  });

  it('keeps a key only this device added', () => {
    expect(merge({ quickAddOnHover: true }, {}, {})).toEqual({ quickAddOnHover: true });
  });

  it('gives a key both changed to the device while its change is unsaved', () => {
    const base = { mapSize: 'short' };
    expect(merge({ mapSize: 'tall' }, { mapSize: 'medium' }, base, { unsynced: true })).toEqual({
      mapSize: 'tall',
    });
  });

  it('gives a key both changed to the server once nothing is unsaved', () => {
    const base = { mapSize: 'short' };
    expect(merge({ mapSize: 'tall' }, { mapSize: 'medium' }, base)).toEqual({ mapSize: 'medium' });
  });

  it('keeps a removal this device made unsaved over a server change to the same key', () => {
    const base = { mapSize: 'short' };
    expect(merge({}, { mapSize: 'medium' }, base, { unsynced: true })).toEqual({});
  });

  it('compares objects whole', () => {
    const base = { presentation: { speed: 1 } };
    expect(merge({ presentation: { speed: 1 } }, { presentation: { speed: 2 } }, base)).toEqual({
      presentation: { speed: 2 },
    });
  });
});

describe('mergePreferences without a last copy agreed', () => {
  it('lets an unsaved device copy win whole', () => {
    expect(merge({ a: 1 }, { a: 2, b: 3 }, null, { unsynced: true })).toEqual({ a: 1, b: 3 });
  });

  it('drops nothing, the server winning where both hold a key', () => {
    expect(merge({ a: 1, c: 4 }, { a: 2, b: 3 }, null)).toEqual({ a: 2, b: 3, c: 4 });
  });
});

describe('preferencesPatch', () => {
  it('sends every key with no base, and no deletions', () => {
    expect(preferencesPatch(null, { a: 1, b: undefined })).toEqual({ a: 1 });
  });

  it('sends what changed, whole, and null for what went', () => {
    expect(
      preferencesPatch(
        { a: 1, b: { x: 1 }, gone: true },
        { a: 1, b: { x: 2 }, c: 3, d: undefined },
      ),
    ).toEqual({ b: { x: 2 }, c: 3, gone: null });
  });

  it('is empty when nothing changed', () => {
    expect(preferencesPatch({ a: [1] }, { a: [1] })).toEqual({});
  });
});

describe('rebasePreferences', () => {
  it('applies only the keys the change touched over the latest copy', () => {
    const latest = { a: 1, other: 'tab' };
    expect(
      rebasePreferences<Record<string, unknown>>(
        latest,
        { a: 1, b: 2, same: 1 },
        { a: 5, same: 1 },
      ),
    ).toEqual({ a: 5, other: 'tab' });
  });
});
