import { describe, expect, it } from 'vitest';
import { folderPathSegments, mirrorPathFor, outlinePathOf, type FolderNode } from './mirror-paths';

// Paths (docs/specs/027-repositories/blueprints/repository-link.md "Paths", RL7, CLI27, CLI85).

const folders = new Map(
  [
    { id: 'root-folder', name: 'Minigames', parentId: null },
    { id: 'screens-01', name: 'Screens & Menus', parentId: 'root-folder' },
    { id: 'deep-0001', name: '***', parentId: 'screens-01' },
    { id: 'elsewhere', name: 'Elsewhere', parentId: null },
  ].map((f) => [f.id, f]),
);

describe('folderPathSegments', () => {
  it('slugs the folders below the covered folder down to the document’s', () => {
    expect(folderPathSegments('deep-0001', 'root-folder', folders)).toEqual([
      'screens-menus',
      'deep-000',
    ]);
    expect(folderPathSegments('screens-01', 'root-folder', folders)).toEqual(['screens-menus']);
  });

  it('is empty in the covered folder itself, outside it, or without one', () => {
    expect(folderPathSegments('root-folder', 'root-folder', folders)).toEqual([]);
    expect(folderPathSegments('elsewhere', 'root-folder', folders)).toEqual([]);
    expect(folderPathSegments(null, 'root-folder', folders)).toEqual([]);
    expect(folderPathSegments('screens-01', null, folders)).toEqual([]);
    expect(folderPathSegments('gone', 'root-folder', folders)).toEqual([]);
  });
});

describe('mirrorPathFor', () => {
  const doc = { id: 'abcdef12-3456', name: 'Home screen' };

  it('names the file by its slug under its folder path', () => {
    expect(mirrorPathFor(doc, ['screens'], new Set())).toBe('screens/home-screen.livediagram.json');
    expect(mirrorPathFor(doc, [], new Set())).toBe('home-screen.livediagram.json');
  });

  it('steps aside for a path another document holds: its short id, then its whole id', () => {
    const taken = new Set(['home-screen.livediagram.json']);
    expect(mirrorPathFor(doc, [], taken)).toBe('home-screen-abcdef12.livediagram.json');
    taken.add('home-screen-abcdef12.livediagram.json');
    expect(mirrorPathFor(doc, [], taken)).toBe('home-screen-abcdef12-3456.livediagram.json');
    taken.add('home-screen-abcdef12-3456.livediagram.json');
    expect(mirrorPathFor(doc, [], taken)).toBe('home-screen-abcdef12-3456.livediagram.json');
  });
});

describe('a stored id that is not a plain id', () => {
  it('never becomes a path out of the mirror directory', () => {
    const hostile = { id: '../../../.ssh/x', name: '!!!' };
    const taken = new Set<string>();
    for (let i = 0; i < 3; i++) {
      const path = mirrorPathFor(hostile, [], taken);
      expect(path).not.toContain('/');
      expect(path.startsWith('..')).toBe(false);
      taken.add(path);
    }
    const deep = new Map<string, FolderNode>([
      ['a/../..', { id: 'a/../..', name: '###', parentId: 'root-folder' }],
      ['root-folder', { id: 'root-folder', name: 'Root', parentId: null }],
    ]);
    const [segment] = folderPathSegments('a/../..', 'root-folder', deep);
    expect(segment).toMatch(/^[a-z0-9_-]+$/i);
  });

  it('answers a folder listing that loops as not below the covered folder', () => {
    const loop = new Map([
      ['f1', { id: 'f1', name: 'One', parentId: 'f2' }],
      ['f2', { id: 'f2', name: 'Two', parentId: 'f1' }],
    ]);
    expect(folderPathSegments('f1', 'root-folder', loop)).toEqual([]);
  });
});

describe('outlinePathOf', () => {
  it('sits beside the mirror file as <slug>.md', () => {
    expect(outlinePathOf('screens/home-screen.livediagram.json')).toBe('screens/home-screen.md');
  });
});
