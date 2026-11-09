import { describe, expect, it, vi } from 'vitest';
import type { IndexClient, Item } from '@liveworkspace/index-client';
import { archiveDoorOf, throughArchiveDoor, unarchiveToOf } from './archive-doors';

const item = { id: 'd1', title: 'Road map' } as unknown as Item;

describe('archiveDoorOf', () => {
  it('is the archive or unarchive door, posted', () => {
    expect(archiveDoorOf(['api', 'documents', 'd1', 'archive'], 'POST')).toBe('archive');
    expect(archiveDoorOf(['api', 'projects', 'p1', 'unarchive'], 'POST')).toBe('unarchive');
  });

  it('is no door for another method, path or a missing id', () => {
    expect(archiveDoorOf(['api', 'documents', 'd1', 'archive'], 'GET')).toBeNull();
    expect(archiveDoorOf(['api', 'documents', 'd1', 'copy'], 'POST')).toBeNull();
    expect(archiveDoorOf(['api', 'documents', 'd1'], 'POST')).toBeNull();
    expect(archiveDoorOf(['api', 'documents', '', 'archive'], 'POST')).toBeNull();
    expect(archiveDoorOf(['api', 'documents', 'd1', 'archive', 'x'], 'POST')).toBeNull();
  });
});

describe('unarchiveToOf', () => {
  it('is the top of My Work when the body names nowhere', () => {
    expect(unarchiveToOf({})).toEqual({ folderId: null, teamId: null });
    expect(unarchiveToOf({ folderId: null, other: 1 })).toEqual({ folderId: null, teamId: null });
  });

  it('takes a folder, a team or both', () => {
    expect(unarchiveToOf({ folderId: 'f1' })).toEqual({ folderId: 'f1', teamId: null });
    expect(unarchiveToOf({ teamId: 't1', folderId: 'f2' })).toEqual({
      folderId: 'f2',
      teamId: 't1',
    });
  });

  it('refuses a place that is not an id', () => {
    for (const body of [{ folderId: '' }, { teamId: 3 }, { folderId: ['f1'] }])
      expect(unarchiveToOf(body), JSON.stringify(body)).toBeNull();
  });
});

describe('throughArchiveDoor', () => {
  it('archives at the index as the caller', async () => {
    const archiveItem = vi.fn(async () => ({ item }));
    const client = { archiveItem } as unknown as IndexClient;
    expect(await throughArchiveDoor(client, 'archive', 'd1', { folderId: 'ignored' })).toBe(item);
    expect(archiveItem).toHaveBeenCalledWith('d1');
  });

  it('moves out with the PATCH that names where it goes, My Work by default', async () => {
    const updateItem = vi.fn(async () => ({ item }));
    const client = { updateItem } as unknown as IndexClient;
    expect(await throughArchiveDoor(client, 'unarchive', 'd1', {})).toBe(item);
    expect(updateItem).toHaveBeenCalledWith('d1', { folderId: null, teamId: null });
    await throughArchiveDoor(client, 'unarchive', 'd1', { teamId: 't1' });
    expect(updateItem).toHaveBeenLastCalledWith('d1', { folderId: null, teamId: 't1' });
  });

  it('answers a body that is no destination without calling the index', async () => {
    const updateItem = vi.fn();
    const client = { updateItem } as unknown as IndexClient;
    expect(await throughArchiveDoor(client, 'unarchive', 'd1', { folderId: 7 })).toEqual({
      error: 'invalid_body',
    });
    expect(updateItem).not.toHaveBeenCalled();
  });

  it('lets the index refusal through', async () => {
    const refused = new Error('not_owner');
    const client = { archiveItem: vi.fn().mockRejectedValue(refused) } as unknown as IndexClient;
    await expect(throughArchiveDoor(client, 'archive', 'd1', {})).rejects.toBe(refused);
  });
});
