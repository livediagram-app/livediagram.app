import { describe, it, expect } from 'vitest';
import { indexFolders, folderBreadcrumb, folderDescendants } from './folder-tree';
import type { Folder } from '@livediagram/api-schema';

const f = (id: string, name: string, parentId: string | null = null): Folder => ({
  id,
  name,
  parentId,
  ownerId: 'o1',
  teamId: null,
  createdAt: 0,
  updatedAt: 0,
});

// root ── a ── a1
//     └── b
const TREE = [f('a', 'Alpha'), f('b', 'Bravo'), f('a1', 'Alpha one', 'a')];

describe('indexFolders', () => {
  it('indexes by id and by parent, and picks out the roots', () => {
    const { folderById, childrenByParent, rootFolders } = indexFolders(TREE);
    expect(folderById.get('a1')?.name).toBe('Alpha one');
    expect(childrenByParent.get('a')?.map((x) => x.id)).toEqual(['a1']);
    expect(rootFolders.map((x) => x.id)).toEqual(['a', 'b']);
  });

  it('sorts siblings by name whatever order the API returned', () => {
    const { rootFolders } = indexFolders([f('z', 'Zulu'), f('m', 'Mike'), f('a', 'Alpha')]);
    expect(rootFolders.map((x) => x.name)).toEqual(['Alpha', 'Mike', 'Zulu']);
  });

  it('handles an empty list', () => {
    const { rootFolders, folderById } = indexFolders([]);
    expect(rootFolders).toEqual([]);
    expect(folderById.size).toBe(0);
  });
});

describe('folderBreadcrumb', () => {
  const { folderById } = indexFolders(TREE);

  it('walks root to leaf', () => {
    expect(folderBreadcrumb(folderById, 'a1').map((x) => x.id)).toEqual(['a', 'a1']);
  });

  it('returns [] for a virtual node with no folder id', () => {
    expect(folderBreadcrumb(folderById, null)).toEqual([]);
  });

  it('stops where a dangling parent breaks the chain', () => {
    // Happens mid-refresh, between an optimistic delete and the server
    // response: the child still points at a parent that is already gone.
    const orphan = indexFolders([f('kid', 'Kid', 'deleted-parent')]);
    expect(folderBreadcrumb(orphan.folderById, 'kid').map((x) => x.id)).toEqual(['kid']);
  });

  it('terminates on a cycle rather than hanging the render', () => {
    const cyclic = indexFolders([f('x', 'X', 'y'), f('y', 'Y', 'x')]);
    expect(folderBreadcrumb(cyclic.folderById, 'x').map((x) => x.id)).toEqual(['y', 'x']);
  });
});

describe('folderDescendants', () => {
  const { childrenByParent } = indexFolders(TREE);

  it('includes the root itself, since moving a folder into itself is the same mistake', () => {
    expect([...folderDescendants(childrenByParent, 'b')]).toEqual(['b']);
  });

  it('collects the whole subtree', () => {
    const deep = indexFolders([
      f('r', 'R'),
      f('c1', 'C1', 'r'),
      f('c2', 'C2', 'r'),
      f('g1', 'G1', 'c1'),
    ]);
    expect([...folderDescendants(deep.childrenByParent, 'r')].sort()).toEqual([
      'c1',
      'c2',
      'g1',
      'r',
    ]);
  });

  it('terminates on a cycle', () => {
    const cyclic = indexFolders([f('x', 'X', 'y'), f('y', 'Y', 'x')]);
    expect([...folderDescendants(cyclic.childrenByParent, 'x')].sort()).toEqual(['x', 'y']);
  });
});
