import { describe, expect, it } from 'vitest';
import { folderPathSegments, mirrorPathFor, outlinePathOf } from './mirror-paths';

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

describe('outlinePathOf', () => {
  it('sits beside the mirror file as <slug>.md', () => {
    expect(outlinePathOf('screens/home-screen.livediagram.json')).toBe('screens/home-screen.md');
  });
});
