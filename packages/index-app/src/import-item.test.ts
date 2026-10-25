import { afterEach, describe, expect, it, vi } from 'vitest';
import type { IndexClient } from '@liveworkspace/index-client';
import { importItemAs, type ImportSteps } from './import-item';

afterEach(() => vi.restoreAllMocks());

const INPUT = { owner: 'user_ada', folderId: 'F1', name: 'Logo', file: 'FILE' };

function index() {
  const createItem = vi.fn(async () => ({}) as Awaited<ReturnType<IndexClient['createItem']>>);
  const deleteItem = vi.fn(async () => {});
  return { client: { createItem, deleteItem } as unknown as IndexClient, createItem, deleteItem };
}

const steps = (over: Partial<ImportSteps<string>> = {}): ImportSteps<string> => ({
  read: (file) => ({ ok: true, content: `content of ${file}` }),
  title: (name) => name.toUpperCase(),
  write: vi.fn(async () => {}),
  ...over,
});

describe('importItemAs', () => {
  it('makes the index item as the owner’s, then writes the content under its id', async () => {
    const { client, createItem } = index();
    const s = steps();
    const result = await importItemAs(client, 'livedesign', INPUT, s, () => 'NEW');
    expect(result).toEqual({ status: 'ok', id: 'NEW' });
    expect(createItem).toHaveBeenCalledWith({
      id: 'NEW',
      app: 'livedesign',
      title: 'LOGO',
      folderId: 'F1',
      source: 'import',
    });
    expect(s.write).toHaveBeenCalledWith('NEW', 'content of FILE', 'LOGO');
  });

  it('answers a file it refuses without touching the index', async () => {
    const { client, createItem } = index();
    for (const failure of ['invalid_file', 'too_large'] as const) {
      const s = steps({ read: () => ({ ok: false, failure }) });
      expect(await importItemAs(client, 'livedesign', INPUT, s)).toEqual({ status: failure });
      expect(s.write).not.toHaveBeenCalled();
    }
    expect(createItem).not.toHaveBeenCalled();
  });

  it('takes the item away again when the write fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { client, deleteItem } = index();
    const s = steps({
      write: async () => {
        throw new Error('room down');
      },
    });
    await expect(importItemAs(client, 'livedesign', INPUT, s, () => 'NEW')).rejects.toThrow(
      'room down',
    );
    expect(deleteItem).toHaveBeenCalledWith('NEW', { permanent: true, reason: 'empty' });
  });

  it('throws without an index, and writes nothing when the index refuses', async () => {
    await expect(importItemAs(null, 'livedesign', INPUT, steps())).rejects.toThrow();
    const { client, createItem } = index();
    createItem.mockRejectedValueOnce(new Error('folder_not_found'));
    const s = steps();
    await expect(importItemAs(client, 'livedesign', INPUT, s)).rejects.toThrow();
    expect(s.write).not.toHaveBeenCalled();
  });
});
