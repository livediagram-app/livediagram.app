import { render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Folder } from '@liveworkspace/index-client';
import { createFakeIndex, makeItem } from '../test/fakeClient';
import { folderCountLabel } from '../panel/ExplorerPanel';
import { Explorer } from './Explorer';
import { folderTiles } from './FolderMosaic';

const folder = (id: string, parentId: string | null = null): Folder => ({
  id,
  name: id,
  parentId,
  teamId: null,
  ownerId: 'user_me',
  createdAt: 1,
  updatedAt: 1,
});

describe('folderTiles', () => {
  const items = [1, 2, 3, 4].map((i) => makeItem(i));
  it('puts items first and fills with subfolders, four at most', () => {
    const { tiles, hidden } = folderTiles({ items: items.slice(0, 2), itemCount: 2 }, [
      folder('a'),
      folder('b'),
    ]);
    expect(tiles.map((t) => t.kind)).toEqual(['item', 'item', 'folder', 'folder']);
    expect(hidden).toBe(0);
  });
  it('turns the last slot into +N when more is inside than fits, counting beyond the items sent', () => {
    const { tiles, hidden } = folderTiles({ items, itemCount: 9 }, [folder('a')]);
    expect(tiles).toHaveLength(3);
    expect(hidden).toBe(7);
  });
  it('is empty for an empty folder', () => {
    expect(folderTiles({ items: [], itemCount: 0 }, [])).toEqual({ tiles: [], hidden: 0 });
  });
});

describe('folderCountLabel', () => {
  const words = { lowerOne: 'plan', lowerMany: 'plans' };
  it('reads as the panel always did', () => {
    expect(folderCountLabel(2, 5, words)).toBe('2 folders · 5 plans');
    expect(folderCountLabel(1, 1, words)).toBe('1 folder · 1 plan');
    expect(folderCountLabel(0, 0, words)).toBe('0 plans');
    expect(folderCountLabel(0, undefined, words)).toBe('Folder');
    expect(folderCountLabel(0, 1000, words)).toBe('1000+ plans');
  });
});

describe('folder cards on the Explorer page', () => {
  beforeEach(() => localStorage.removeItem('liveworkspace:explorer-view-mode'));

  it('show what is inside every folder from one request, with thumbnails drawn by the host', async () => {
    const folders = [folder('f1'), folder('f2'), folder('f3'), folder('sub', 'f1')];
    const items = [
      ...[1, 2, 3, 4, 5].map((i) => makeItem(i, { folderId: 'f1' })),
      makeItem(6, { folderId: 'f2' }),
    ];
    const index = createFakeIndex({ items, folders });
    const renderThumbnail = vi.fn((item: { id: string }) => <i data-thumb={item.id} />);
    render(
      <Explorer
        app="liveplanner"
        client={index.client}
        view={{ kind: 'all' }}
        onNavigate={vi.fn()}
        itemHref={(i) => `/p/${i.id}`}
        onCreate={vi.fn()}
        renderThumbnail={renderThumbnail}
      />,
    );
    await waitFor(() => expect(document.querySelectorAll('[data-folder-mosaic]')).toHaveLength(2));
    expect(index.count('folderPreviews')).toBe(1);
    expect(index.calls.find((c) => c.method === 'folderPreviews')!.args[1]).toEqual({
      app: 'liveplanner',
    });
    const f1 = document.querySelector('[data-folder-card="f1"]')!;
    // Five items and a subfolder: three tiles and +3.
    expect(f1.querySelectorAll('[data-thumb]')).toHaveLength(3);
    expect(f1.textContent).toContain('+3');
    expect(f1.textContent).toContain('6');
    expect(document.querySelector('[data-folder-card="f3"] [data-folder-empty]')).toBeTruthy();
  });
});

describe('rows and cards', () => {
  beforeEach(() => localStorage.setItem('liveworkspace:explorer-view-mode', 'list'));

  it("box the host's snapshot on a row, and fall back to the kind's icon when it draws none", async () => {
    const items = [makeItem(1), makeItem(2, { app: 'livediagram', kind: 'canvas' })];
    const index = createFakeIndex({ items });
    render(
      <Explorer
        app="liveplanner"
        client={index.client}
        view={{ kind: 'all' }}
        filter="all"
        onNavigate={vi.fn()}
        itemHref={(i) => `/p/${i.id}`}
        onCreate={vi.fn()}
        renderThumbnail={(item, size) =>
          item.app === 'liveplanner' ? <i data-thumb={`${item.id}:${size}`} /> : null
        }
      />,
    );
    await waitFor(() => expect(document.querySelector('[data-thumb="item-1:row"]')).toBeTruthy());
    expect(document.querySelector('[data-item-row="item-2"] [data-thumb]')).toBeNull();
    expect(document.querySelector('[data-item-row="item-2"] svg')).toBeTruthy();
  });
});
