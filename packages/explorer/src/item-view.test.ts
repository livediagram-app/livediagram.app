import { describe, expect, it, vi } from 'vitest';
import { resolveItemView, viewOfItem, viewOfLocalItem } from './item-view';
import type { ThisBrowserItem } from './this-browser';

const ME = { id: 'me', teamIds: ['marketing'] };
const item = (over: Partial<Parameters<typeof viewOfItem>[0]> = {}) => ({
  ownerId: 'me',
  teamId: null,
  folderId: null,
  trashedAt: null,
  archivedAt: null,
  ...over,
});
const local = (id: string, folderId?: string): ThisBrowserItem =>
  ({
    id,
    title: 'Local',
    createdAt: 1,
    updatedAt: 1,
    lastOpenedAt: 1,
    ...(folderId ? { folderId } : {}),
  }) as ThisBrowserItem;

describe('viewOfItem', () => {
  it('opens a My Work item in no folder on My Work', () => {
    expect(viewOfItem(item(), ME)).toEqual({ kind: 'all' });
  });

  it('opens a My Work item in a folder on that folder', () => {
    expect(viewOfItem(item({ folderId: 'f1' }), ME)).toEqual({ kind: 'folder', id: 'f1' });
  });

  it("opens a team item on its team's library at its folder", () => {
    expect(viewOfItem(item({ teamId: 'marketing', folderId: 'f2' }), ME)).toEqual({
      kind: 'team',
      id: 'marketing',
      folderId: 'f2',
    });
  });

  it("opens a team item in no folder on the team's root, whoever made it", () => {
    expect(viewOfItem(item({ ownerId: 'someone', teamId: 'marketing' }), ME)).toEqual({
      kind: 'team',
      id: 'marketing',
    });
  });

  it('opens an item shared with the person on Shared With Me', () => {
    expect(viewOfItem(item({ ownerId: 'someone', folderId: 'theirs' }), ME)).toEqual({
      kind: 'shared',
    });
  });

  it("opens a team item reached through a link, in a team they aren't in, on Shared With Me", () => {
    expect(viewOfItem(item({ ownerId: 'someone', teamId: 'other', folderId: 'x' }), ME)).toEqual({
      kind: 'shared',
    });
  });

  it('opens a trashed item on the Trash and an archived one on Archived', () => {
    expect(viewOfItem(item({ folderId: 'f1', trashedAt: 5 }), ME)).toEqual({ kind: 'trash' });
    expect(viewOfItem(item({ folderId: 'f1', archivedAt: 5 }), ME)).toEqual({ kind: 'archived' });
  });

  it('reads an item from an index that sends no archivedAt as not archived', () => {
    const { archivedAt: _gone, ...old } = item({ folderId: 'f1' });
    expect(viewOfItem(old, ME)).toEqual({ kind: 'folder', id: 'f1' });
  });
});

describe('viewOfLocalItem', () => {
  it('opens This Browser at the local folder, or its root', () => {
    expect(viewOfLocalItem({ folderId: 'lf' })).toEqual({ kind: 'offline', folder: 'lf' });
    expect(viewOfLocalItem({})).toEqual({ kind: 'offline' });
  });
});

describe('resolveItemView', () => {
  it("answers a This Browser item from this browser's list, asking the index nothing", async () => {
    const getItem = vi.fn();
    await expect(
      resolveItemView('l1', { client: { getItem }, viewer: ME, local: [local('l1', 'lf')] }),
    ).resolves.toEqual({ kind: 'offline', folder: 'lf' });
    expect(getItem).not.toHaveBeenCalled();
  });

  it('answers any other item from the index, once', async () => {
    const getItem = vi.fn().mockResolvedValue({ item: item({ folderId: 'f1' }) });
    await expect(
      resolveItemView('d1', { client: { getItem }, viewer: ME, local: [local('l1')] }),
    ).resolves.toEqual({ kind: 'folder', id: 'f1' });
    expect(getItem).toHaveBeenCalledTimes(1);
    expect(getItem).toHaveBeenCalledWith('d1');
  });

  it("answers null for an item the index can't answer", async () => {
    const getItem = vi.fn().mockRejectedValue(new Error('404'));
    await expect(
      resolveItemView('gone', { client: { getItem }, viewer: ME, local: [] }),
    ).resolves.toBeNull();
  });
});
