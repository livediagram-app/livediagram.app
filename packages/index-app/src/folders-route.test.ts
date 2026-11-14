import { IndexError, type IndexClient } from '@liveworkspace/index-client';
import { describe, expect, it, vi } from 'vitest';
import { createFoldersRoute } from './folders-route';

const folder = {
  id: 'f1',
  ownerId: 'user_a',
  teamId: null,
  parentId: null,
  name: 'Screens',
  createdAt: 1,
  updatedAt: 1,
};

type Ctx = {
  request: Request;
  segments: string[];
  owner: string | null;
  client: IndexClient | null;
};

const route = createFoldersRoute<Ctx, { id: string }>({
  json: (body, init) => Response.json(body, init),
  notFound: () => Response.json({ error: 'not_found' }, { status: 404 }),
  requireOwner: (ctx) => ctx.owner ?? Response.json({ error: 'unauthorized' }, { status: 401 }),
  clientFor: (ctx) => ctx.client ?? Response.json({ error: 'index_unavailable' }, { status: 503 }),
  folderOf: (f) => ({ id: f.id }),
});

const ctx = (over: Partial<Ctx> & { method?: string; body?: unknown } = {}): Ctx => {
  const { method = 'GET', body, ...rest } = over;
  return {
    request: new Request('https://app.test/api/folders', {
      method,
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
    segments: ['api', 'folders'],
    owner: 'user_a',
    client: null,
    ...rest,
  };
};

describe('createFoldersRoute (/api/folders)', () => {
  it('answers 404 for a deeper path or another method', async () => {
    expect((await route(ctx({ segments: ['api', 'folders', 'x'] }))).status).toBe(404);
    expect((await route(ctx({ method: 'DELETE' }))).status).toBe(404);
  });

  it("answers the product's 401 and 503", async () => {
    expect((await route(ctx({ owner: null }))).status).toBe(401);
    expect((await route(ctx())).status).toBe(503);
  });

  it("lists the caller's personal folders in the product's shape", async () => {
    const listFolders = vi.fn(async () => ({ folders: [folder], nextCursor: null }));
    const res = await route(ctx({ client: { listFolders } as unknown as IndexClient }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ folders: [{ id: 'f1' }] });
    expect(listFolders).toHaveBeenCalledWith(expect.objectContaining({ team: 'personal' }));
  });

  it("answers the index's refusal of a list", async () => {
    const listFolders = vi.fn(async () => {
      throw new IndexError(403, 'forbidden');
    });
    const res = await route(ctx({ client: { listFolders } as unknown as IndexClient }));
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'forbidden' });
  });

  it('makes a folder and answers it with 201', async () => {
    const createFolder = vi.fn(async () => ({ folder }));
    const res = await route(
      ctx({
        method: 'POST',
        body: { name: 'Screens' },
        client: { createFolder } as unknown as IndexClient,
      }),
    );
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ folder: { id: 'f1' } });
  });

  it('answers a bad body with its refusal', async () => {
    const res = await route(
      ctx({ method: 'POST', body: { id: null }, client: {} as unknown as IndexClient }),
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'invalid_body' });
  });
});
