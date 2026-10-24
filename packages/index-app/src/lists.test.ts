import { IndexError, type IndexClient } from '@liveworkspace/index-client';
import { describe, expect, it, vi } from 'vitest';
import { createFolderFor, createFolderInputOf } from './lists';

const post = (body: unknown) =>
  new Request('https://app.test/api/folders', {
    method: 'POST',
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });

const folder = {
  id: 'f1',
  ownerId: 'user_a',
  teamId: null,
  parentId: null,
  name: 'Screens',
  createdAt: 1,
  updatedAt: 1,
};

describe('createFolderFor (POST /api/folders)', () => {
  it('passes the folder to the index as the caller and answers it', async () => {
    const createFolder = vi.fn(async () => ({ folder }));
    const client = { createFolder } as unknown as IndexClient;
    const res = await createFolderFor(
      client,
      post({ id: 'f1', name: 'Screens', parentId: 'p1', teamId: 't1', extra: true }),
    );
    expect(res).toEqual({ folder });
    expect(createFolder).toHaveBeenCalledWith({
      id: 'f1',
      name: 'Screens',
      parentId: 'p1',
      teamId: 't1',
    });
  });

  it('refuses a malformed body before the index, and answers the index refusal as is', async () => {
    const createFolder = vi.fn(async () => {
      throw new IndexError(404, 'folder_not_found');
    });
    const client = { createFolder } as unknown as IndexClient;
    expect(await createFolderFor(client, post('{'))).toEqual({
      status: 400,
      error: 'invalid_json',
    });
    expect(await createFolderFor(client, post({ name: 3 }))).toEqual({
      status: 400,
      error: 'invalid_body',
    });
    expect(createFolder).not.toHaveBeenCalled();
    expect(await createFolderFor(client, post({ name: 'A', parentId: 'gone' }))).toEqual({
      status: 404,
      error: 'folder_not_found',
    });
  });
});

describe('createFolderInputOf', () => {
  it('keeps only the fields the index takes', () => {
    expect(createFolderInputOf({ name: 'A' })).toEqual({ name: 'A' });
    expect(createFolderInputOf({ name: 'A', parentId: null })).toEqual({
      name: 'A',
      parentId: null,
    });
    expect(createFolderInputOf({ name: 'A', id: null })).toBeNull();
    expect(createFolderInputOf([])).toBeNull();
    expect(createFolderInputOf(null)).toBeNull();
  });
});
