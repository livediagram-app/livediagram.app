import { describe, expect, it } from 'vitest';
import type { Folder } from '@livedesign/api-schema';
import { folderPreviewTiles, type FolderPreviewContents } from './folder-preview-tiles';
import type { PaneDesign } from './views';

function liveDoc(id: string): PaneDesign {
  return { id, name: id, folderId: 'f', savedAt: 1, shareCode: null, ownerId: 'me' };
}

function folder(id: string): Folder {
  return {
    id,
    ownerId: 'me',
    parentId: 'f',
    teamId: null,
    name: id,
    createdAt: 0,
    updatedAt: 0,
  };
}

function contents(designIds: string[], folderIds: string[] = []): FolderPreviewContents {
  return { designs: designIds.map(liveDoc), folders: folderIds.map(folder) };
}

describe('folderPreviewTiles', () => {
  it('previews nothing for an empty folder (the card shows the empty state art)', () => {
    expect(folderPreviewTiles(contents([]))).toEqual({ tiles: [], hidden: 0 });
  });

  it('keeps the incoming design order, up to four', () => {
    const { tiles, hidden } = folderPreviewTiles(contents(['a', 'b', 'c', 'd']));
    expect(hidden).toBe(0);
    expect(tiles.map((t) => (t.kind === 'design' ? t.design.id : t.folder.id))).toEqual([
      'a',
      'b',
      'c',
      'd',
    ]);
  });

  it('puts designs before subfolders', () => {
    const { tiles } = folderPreviewTiles(contents(['a', 'b'], ['sub1', 'sub2']));
    expect(tiles.map((t) => t.kind)).toEqual(['design', 'design', 'folder', 'folder']);
  });

  it('previews subfolders when the folder holds no designs', () => {
    const { tiles, hidden } = folderPreviewTiles(contents([], ['sub1']));
    expect(hidden).toBe(0);
    expect(tiles).toEqual([{ kind: 'folder', folder: folder('sub1') }]);
  });

  it('gives up the fourth slot to a +N counter when there is more inside', () => {
    const { tiles, hidden } = folderPreviewTiles(contents(['a', 'b', 'c', 'd', 'e']));
    expect(tiles).toHaveLength(3);
    expect(hidden).toBe(2);
  });

  it('counts hidden subfolders as well as hidden designs', () => {
    const { tiles, hidden } = folderPreviewTiles(contents(['a', 'b', 'c'], ['sub1', 'sub2']));
    expect(tiles.map((t) => t.kind)).toEqual(['design', 'design', 'design']);
    expect(hidden).toBe(2);
  });
});
