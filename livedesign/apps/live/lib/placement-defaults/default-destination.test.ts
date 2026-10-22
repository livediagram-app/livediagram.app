import { describe, expect, it } from 'vitest';
import type { PlacementDefaultKey } from '@livedesign/api-schema';
import {
  buildDefaultFolderIndex,
  destinationOf,
  folderDefaultKeys,
  representativeIntent,
  resolveDefaultFor,
  workingDefault,
} from './default-destination';

// Where a person's new documents go, read on the client
// (docs/specs/013-workspace/default-folders.md "Surfaces", "Precedence", "Dangling defaults").

const index = buildDefaultFolderIndex(
  [
    { id: 'workshops', name: 'Workshops', parentId: null },
    { id: 'retros', name: 'Retros', parentId: 'workshops' },
  ],
  { 'team-a': [{ id: 'sprints', name: 'Sprints', parentId: null }] },
  [{ id: 'team-a', name: 'Design team' }],
);

const defaults = (entries: [PlacementDefaultKey, string][]) => new Map(entries);

const PAGES = { mode: 'pages', tabKind: 'diagram' } as const;

describe('workingDefault', () => {
  it('answers a personal or listed team folder', () => {
    expect(workingDefault('mode:pages', defaults([['mode:pages', 'workshops']]), index)?.name).toBe(
      'Workshops',
    );
    expect(workingDefault('mode:pages', defaults([['mode:pages', 'sprints']]), index)?.teamId).toBe(
      'team-a',
    );
  });

  it('answers null for no default or a folder it cannot see', () => {
    expect(workingDefault('mode:pages', defaults([]), index)).toBeNull();
    expect(workingDefault('mode:pages', defaults([['mode:pages', 'gone']]), index)).toBeNull();
  });
});

describe('resolveDefaultFor', () => {
  it('resolves the mode', () => {
    expect(resolveDefaultFor(PAGES, defaults([['mode:pages', 'retros']]), index)).toMatchObject({
      resolved: { key: 'mode:pages', folder: { id: 'retros' } },
      skipped: [],
    });
  });

  it('skips a default it cannot see and says so', () => {
    expect(resolveDefaultFor(PAGES, defaults([['mode:pages', 'gone']]), index)).toEqual({
      resolved: null,
      skipped: ['mode:pages'],
    });
  });

  it('resolves nothing with no defaults', () => {
    expect(resolveDefaultFor(PAGES, defaults([]), index)).toEqual({
      resolved: null,
      skipped: [],
    });
  });
});

describe('representativeIntent', () => {
  it('reads the entry as its mode', () => {
    expect(representativeIntent('mode:pages')).toEqual(PAGES);
  });
});

describe('destinationOf', () => {
  it('is the root without a default', () => {
    expect(destinationOf('mode:pages', defaults([]), index)).toEqual({ kind: 'root' });
  });

  it('is the folder, with its team, when it works', () => {
    expect(destinationOf('mode:pages', defaults([['mode:pages', 'sprints']]), index)).toMatchObject(
      {
        kind: 'folder',
        folder: { id: 'sprints' },
        teamName: 'Design team',
      },
    );
  });

  it('is dangling when deleted, its documents going to My Documents instead', () => {
    const d = defaults([['mode:pages', 'gone']]);
    expect(destinationOf('mode:pages', d, index, () => ({ name: 'Decks', teamId: null }))).toEqual({
      kind: 'dangling',
      folderId: 'gone',
      name: 'Decks',
      reason: 'deleted',
      fallback: null,
    });
    expect(destinationOf('mode:pages', d, index)).toMatchObject({
      kind: 'dangling',
      name: null,
      fallback: null,
    });
  });

  it('is unavailable when its team is not among the reader’s', () => {
    const d = defaults([['mode:pages', 'old-team-folder']]);
    expect(
      destinationOf('mode:pages', d, index, () => ({ name: 'Plans', teamId: 'team-left' })),
    ).toMatchObject({ kind: 'dangling', reason: 'unavailable', name: 'Plans' });
  });
});

describe('folderDefaultKeys', () => {
  it('lists the keys a folder holds', () => {
    const d = defaults([['mode:pages', 'workshops']]);
    expect(folderDefaultKeys('workshops', d)).toEqual(['mode:pages']);
    expect(folderDefaultKeys('nothing', d)).toEqual([]);
  });
});
