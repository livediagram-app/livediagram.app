import { beforeEach, describe, expect, it, vi } from 'vitest';

// docs/specs/013-workspace/default-folders.md "Skipping the Location step": the preference's
// parse, its place's name, the context and fallback rules, and its writes.

const { track, write } = vi.hoisted(() => ({ track: vi.fn(), write: vi.fn() }));
vi.mock('./telemetry', () => ({ track }));
vi.mock('./user-preferences', () => ({
  readUserPreferences: () => ({ reduceMotion: true }),
  writeUserPreferences: write,
}));

import {
  placeNameOf,
  readSkipLocationStep,
  resolveSkipLocation,
  saveSkipLocationStep,
  skipLocationStepFor,
  skipPlacementSent,
  turnOffSkipLocationStep,
  type SkipLocationStep,
} from './skip-location-step';

const lists = {
  folders: [{ id: 'w', name: 'Workshops' }],
  teams: [{ id: 't', name: 'Design team' }],
  teamFolders: { t: [{ id: 's', name: 'Sprints' }] },
};
const saved: SkipLocationStep = {
  saveLocation: 'livediagram',
  placement: 'folder:w',
  placeName: 'Workshops',
};

beforeEach(() => {
  track.mockClear();
  write.mockClear();
});

describe('readSkipLocationStep', () => {
  it('is off when missing, null or malformed', () => {
    expect(readSkipLocationStep({})).toBeNull();
    expect(readSkipLocationStep({ skipLocationStep: null })).toBeNull();
    expect(readSkipLocationStep(undefined)).toBeNull();
    const junk = [
      'folder:w',
      { ...saved, saveLocation: 'drive' },
      { ...saved, placement: 'folder:' },
      { ...saved, placement: 'somewhere' },
      { ...saved, placeName: '  ' },
      { saveLocation: 'livediagram', placement: 'unsorted' },
    ];
    for (const value of junk)
      expect(readSkipLocationStep({ skipLocationStep: value as never })).toBeNull();
  });

  it('reads a stored place, Local Browser always at its root', () => {
    expect(readSkipLocationStep({ skipLocationStep: saved })).toEqual(saved);
    expect(
      readSkipLocationStep({
        skipLocationStep: { saveLocation: 'browser', placement: 'folder:w', placeName: 'x' },
      }),
    ).toEqual({ saveLocation: 'browser', placement: 'unsorted', placeName: 'x' });
  });
});

describe('placeNameOf', () => {
  it('names each kind of place as the reader sees it', () => {
    expect(placeNameOf('browser', 'folder:w', lists)).toBe('Local Browser');
    expect(placeNameOf('livediagram', 'unsorted', lists)).toBe('My documents');
    expect(placeNameOf('livediagram', 'folder:w', lists)).toBe('Workshops');
    expect(placeNameOf('livediagram', 'team:t', lists)).toBe('Design team');
    expect(placeNameOf('livediagram', 'team:t:folder:s', lists)).toBe('Sprints · Design team');
  });

  it('is null for a place the lists do not hold', () => {
    expect(placeNameOf('livediagram', 'folder:gone', lists)).toBeNull();
    expect(placeNameOf('livediagram', 'team:left', lists)).toBeNull();
    expect(placeNameOf('livediagram', 'team:t:folder:gone', lists)).toBeNull();
  });
});

describe('skipLocationStepFor and skipPlacementSent', () => {
  it('stores Local Browser at its root, by its label', () => {
    expect(skipLocationStepFor('browser', 'folder:w', 'Workshops')).toEqual({
      saveLocation: 'browser',
      placement: 'unsorted',
      placeName: 'Local Browser',
    });
  });

  it('sends the root explicitly', () => {
    expect(skipPlacementSent({ ...saved, placement: 'unsorted' })).toEqual({
      teamId: null,
      folderId: null,
    });
    expect(skipPlacementSent({ ...saved, placement: 'team:t:folder:s' })).toEqual({
      teamId: 't',
      folderId: 's',
    });
  });
});

describe('resolveSkipLocation', () => {
  const resolve = (over: Partial<Parameters<typeof resolveSkipLocation>[0]> = {}) =>
    resolveSkipLocation({ pref: saved, context: undefined, lists, ready: true, ...over });

  it('is the two-step wizard when off', () => {
    expect(resolve({ pref: null })).toEqual({ place: null, unavailable: null });
  });

  it('is the saved place while it exists', () => {
    expect(resolve()).toEqual({ place: saved, unavailable: null });
  });

  it('lets a /new context win for placement, in livediagram', () => {
    expect(resolve({ context: 'team:t:folder:s' }).place).toEqual({
      saveLocation: 'livediagram',
      placement: 'team:t:folder:s',
      placeName: 'Sprints · Design team',
    });
    expect(
      resolve({ pref: { ...saved, saveLocation: 'browser' }, context: 'folder:w' }).place,
    ).toMatchObject({ saveLocation: 'livediagram', placement: 'folder:w' });
    expect(resolve({ context: 'folder:unknown' }).place?.placeName).toBe('this folder');
  });

  it('falls back to the Location step once the lists show the place has gone', () => {
    expect(resolve({ pref: { ...saved, placement: 'folder:gone' } })).toEqual({
      place: null,
      unavailable: 'personal',
    });
    expect(resolve({ pref: { ...saved, placement: 'team:left:folder:s' } })).toEqual({
      place: null,
      unavailable: 'team',
    });
  });

  it('keeps the saved place until the lists have loaded', () => {
    const gone = { ...saved, placement: 'folder:gone' };
    expect(resolve({ pref: gone, ready: false }).place).toEqual(gone);
  });

  it('never checks Local Browser or the root against the lists', () => {
    const empty = { folders: [], teams: [], teamFolders: {} };
    const browser: SkipLocationStep = {
      saveLocation: 'browser',
      placement: 'unsorted',
      placeName: 'Local Browser',
    };
    expect(resolve({ pref: browser, lists: empty }).place).toEqual(browser);
    const root = { ...saved, placement: 'unsorted', placeName: 'My documents' };
    expect(resolve({ pref: root, lists: empty }).place).toEqual(root);
  });
});

describe('writes', () => {
  it('saves over the other preferences, telemetry first', () => {
    saveSkipLocationStep(saved, 'owner');
    expect(track).toHaveBeenCalledWith('UI', 'Toggled', 'SkipLocationStepOn');
    expect(write).toHaveBeenCalledWith({ reduceMotion: true, skipLocationStep: saved }, 'owner');
    expect(track.mock.invocationCallOrder[0]!).toBeLessThan(write.mock.invocationCallOrder[0]!);
  });

  it('turns off with an explicit null', () => {
    expect(turnOffSkipLocationStep({ skipLocationStep: saved })).toEqual({
      skipLocationStep: null,
    });
    expect(track).toHaveBeenCalledWith('UI', 'Toggled', 'SkipLocationStepOff');
  });
});
