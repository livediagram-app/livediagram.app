import { describe, expect, it } from 'vitest';
import type { Folder } from '@livediagram/api-schema';
import { folderPreviewTiles, type FolderPreviewContents } from './folder-preview-tiles';
import type { PaneDiagram } from './views';

function diagram(id: string): PaneDiagram {
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

function contents(diagramIds: string[], folderIds: string[] = []): FolderPreviewContents {
  return { diagrams: diagramIds.map(diagram), folders: folderIds.map(folder) };
}

describe('folderPreviewTiles', () => {
  it('previews nothing for an empty folder (the card falls back to its glyph)', () => {
    expect(folderPreviewTiles(contents([]))).toEqual({ tiles: [], hidden: 0 });
  });

  it('keeps the incoming diagram order, up to four', () => {
    const { tiles, hidden } = folderPreviewTiles(contents(['a', 'b', 'c', 'd']));
    expect(hidden).toBe(0);
    expect(tiles.map((t) => (t.kind === 'diagram' ? t.diagram.id : t.folder.id))).toEqual([
      'a',
      'b',
      'c',
      'd',
    ]);
  });

  it('puts diagrams before subfolders', () => {
    const { tiles } = folderPreviewTiles(contents(['a', 'b'], ['sub1', 'sub2']));
    expect(tiles.map((t) => t.kind)).toEqual(['diagram', 'diagram', 'folder', 'folder']);
  });

  it('previews subfolders when the folder holds no diagrams', () => {
    const { tiles, hidden } = folderPreviewTiles(contents([], ['sub1']));
    expect(hidden).toBe(0);
    expect(tiles).toEqual([{ kind: 'folder', folder: folder('sub1') }]);
  });

  it('gives up the fourth slot to a +N counter when there is more inside', () => {
    const { tiles, hidden } = folderPreviewTiles(contents(['a', 'b', 'c', 'd', 'e']));
    expect(tiles).toHaveLength(3);
    expect(hidden).toBe(2);
  });

  it('counts hidden subfolders as well as hidden diagrams', () => {
    const { tiles, hidden } = folderPreviewTiles(contents(['a', 'b', 'c'], ['sub1', 'sub2']));
    expect(tiles.map((t) => t.kind)).toEqual(['diagram', 'diagram', 'diagram']);
    expect(hidden).toBe(2);
  });
});
