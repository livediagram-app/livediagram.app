import {
  IndexError,
  LIST_LIMIT_MAX,
  type IndexClient,
  type Item,
} from '@liveworkspace/index-client';
import { describe, expect, it, vi } from 'vitest';
import {
  createFolderFor,
  createFolderInputOf,
  listAllItems,
  listAskedOf,
  listItemsAsked,
} from './lists';

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

describe('listAskedOf (GET /api/<collection>)', () => {
  const asked = (query: string) => listAskedOf(new URLSearchParams(query));

  it('is the personal library, every page, unless asked otherwise', () => {
    expect(asked('')).toEqual({ team: 'personal' });
  });

  it('takes every library, a trimmed search and a page size', () => {
    expect(asked('team=all&q=+road+map+&limit=20')).toEqual({
      team: undefined,
      q: 'road map',
      limit: 20,
    });
    expect(asked('q=%20%20')).toEqual({ team: 'personal' });
    expect(asked(`limit=${LIST_LIMIT_MAX}`)).toEqual({ team: 'personal', limit: LIST_LIMIT_MAX });
  });

  it('takes the Archived alone with archived=1 or true, and the live list with 0 or false', () => {
    expect(asked('archived=1')).toEqual({ team: 'personal', archived: true });
    expect(asked('team=all&archived=true&q=plan&limit=5')).toEqual({
      team: undefined,
      q: 'plan',
      limit: 5,
      archived: true,
    });
    expect(asked('archived=0')).toEqual({ team: 'personal' });
    expect(asked('archived=false')).toEqual({ team: 'personal' });
  });

  it('refuses another team, or a page size that is not one the index takes', () => {
    for (const query of [
      'archived=yes',
      'archived=',
      'team=t1',
      'limit=0',
      'limit=-1',
      'limit=2.5',
      'limit=x',
      `limit=${LIST_LIMIT_MAX + 1}`,
    ])
      expect(asked(query), query).toEqual({ error: 'invalid_query' });
  });
});

describe('listItemsAsked', () => {
  const item = (id: string) => ({ id }) as unknown as Item;

  it('reads one page at the index with a page size, passing the search and the team', async () => {
    const listItems = vi.fn(async () => ({ items: [item('a')], nextCursor: 'more' }));
    const client = { listItems } as unknown as IndexClient;
    expect(
      await listItemsAsked(client, 'livediagram', { team: undefined, q: 'road', limit: 20 }),
    ).toEqual([item('a')]);
    expect(listItems).toHaveBeenCalledWith({ app: 'livediagram', q: 'road', limit: 20 });
  });

  it('reads the Archived view when asked for it', async () => {
    const listItems = vi.fn(async () => ({ items: [item('a')], nextCursor: null }));
    const client = { listItems } as unknown as IndexClient;
    await listItemsAsked(client, 'livediagram', { team: undefined, limit: 20, archived: true });
    expect(listItems).toHaveBeenCalledWith({ app: 'livediagram', view: 'archived', limit: 20 });
  });

  it('reads every page without one', async () => {
    const listItems = vi
      .fn()
      .mockResolvedValueOnce({ items: [item('a')], nextCursor: 'c1' })
      .mockResolvedValueOnce({ items: [item('b')], nextCursor: null });
    const client = { listItems } as unknown as IndexClient;
    expect(await listAllItems(client, 'livediagram', 'personal')).toEqual([item('a'), item('b')]);
    expect(listItems).toHaveBeenLastCalledWith({
      app: 'livediagram',
      team: 'personal',
      limit: LIST_LIMIT_MAX,
      cursor: 'c1',
    });
  });
});
