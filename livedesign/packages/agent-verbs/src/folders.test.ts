import { describe, expect, it } from 'vitest';
import type { Folder } from '@livedesign/api-schema';
import { VerbRefusal } from './define';
import type { Libraries } from './find-designs';
import { folderChoices, matchFolders, resolveFolderRef } from './folders';

// The person's folders as paths (blueprint CLI86): personal first, then each team by name, depth first.

const folder = (id: string, name: string, parentId: string | null = null): Folder => ({
  id,
  name,
  parentId,
  teamId: null,
  ownerId: 'u',
  createdAt: 1,
  updatedAt: 1,
});

const libraries: Libraries = {
  personal: {
    designs: [],
    folders: [
      folder('f-screens', 'Screens', 'f-games'),
      folder('f-games', 'Minigames'),
      folder('f-art', 'Art'),
    ],
  },
  teams: [
    { id: 't2', name: 'Zed', designs: [], folders: [folder('f-z', 'Zone')] },
    { id: 't1', name: 'Platform', designs: [], folders: [folder('f-arch', 'Architecture')] },
  ],
};
const choices = folderChoices(libraries);

describe('folderChoices', () => {
  it('lists personal folders depth first by name, then each team’s, teams by name', () => {
    expect(choices).toEqual([
      { id: 'f-art', path: 'Art', library: 'personal', teamId: null },
      { id: 'f-games', path: 'Minigames', library: 'personal', teamId: null },
      { id: 'f-screens', path: 'Minigames/Screens', library: 'personal', teamId: null },
      { id: 'f-arch', path: 'Architecture', library: 'Platform', teamId: 't1' },
      { id: 'f-z', path: 'Zone', library: 'Zed', teamId: 't2' },
    ]);
  });

  it('keeps siblings of one name both, in the order the library gave them', () => {
    const twins: Libraries = {
      personal: {
        designs: [],
        folders: [
          folder('c', 'Alpha'),
          folder('z', 'Zeta'),
          folder('b', 'Same'),
          folder('a', 'Same'),
        ],
      },
      teams: [],
    };
    expect(folderChoices(twins).map((c) => c.id)).toEqual(['c', 'b', 'a', 'z']);
  });
});

describe('matchFolders and resolveFolderRef', () => {
  it('names a folder by its id, an id prefix or its own name ignoring case', () => {
    expect(matchFolders(choices, 'f-arch').map((c) => c.id)).toEqual(['f-arch']);
    expect(matchFolders(choices, 'f-sc').map((c) => c.id)).toEqual(['f-screens']);
    expect(matchFolders(choices, 'screens').map((c) => c.id)).toEqual(['f-screens']);
    expect(resolveFolderRef(choices, 'minigames', '--folder').id).toBe('f-games');
  });

  it('refuses none with the nearest, and several with them all, as not found', () => {
    const refusal = (ref: string) => {
      try {
        resolveFolderRef(choices, ref, '--folder');
      } catch (err) {
        if (err instanceof VerbRefusal) return err;
      }
      throw new Error('expected a refusal');
    };

    expect(refusal('mini')).toMatchObject({
      status: 404,
      code: 'not_found',
      message: 'no folder matches "mini"; the nearest:',
    });
    expect(refusal('mini').lines).toHaveLength(2);
    expect(refusal('f-ar').code).toBe('ambiguous');
    expect(refusal('f-ar').hint).toMatch(/^--folder f-ar/);
  });
});
