import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Env } from '../types';

// Characterisation tests for handleFolders' authorisation surface
// (spec/15). The owner-scoped folder tree must reject: an unauthenticated
// caller (400), a create/reparent that points at another owner's folder
// (404 — no existence leak across owners), and a mutation of a folder the
// caller doesn't own (403). Pins the mapping ahead of the requireOwner /
// noContent extraction.

const { db } = vi.hoisted(() => ({
  db: {
    createFolder: vi.fn(),
    deleteFolder: vi.fn(),
    folderMoveWouldCycle: vi.fn(),
    getFolder: vi.fn(),
    listFoldersByOwner: vi.fn(),
    updateFolder: vi.fn(),
  },
}));
vi.mock('../db', () => db);

import type { RouteContext } from './context';
import { handleFolders } from './folders';

function makeCtx(
  method: string,
  path: string,
  opts: { owner?: string | null; body?: unknown } = {},
): RouteContext {
  const url = new URL(`https://api.test${path}`);
  const segments = url.pathname.replace(/^\//, '').split('/');
  const owner = opts.owner === undefined ? 'owner-1' : opts.owner;
  const request = new Request(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });
  return {
    request,
    env: {} as Env,
    url,
    segments,
    clerkUserId: null,
    verifiedUserId: null,
    clerkEmail: null,
    resolveOwner: () => owner,
  };
}

beforeEach(() => {
  for (const fn of Object.values(db)) fn.mockReset();
});

describe('handleFolders auth', () => {
  it('400 when no owner resolves', async () => {
    const res = await handleFolders(makeCtx('GET', '/api/folders', { owner: null }));
    expect(res.status).toBe(400);
  });

  it('200 lists the owner-scoped folders', async () => {
    db.listFoldersByOwner.mockResolvedValue([{ id: 'f1' }]);
    const res = await handleFolders(makeCtx('GET', '/api/folders'));
    expect(res.status).toBe(200);
    expect(db.listFoldersByOwner).toHaveBeenCalledWith({}, 'owner-1');
  });

  it('400 on create missing id/name', async () => {
    const res = await handleFolders(makeCtx('POST', '/api/folders', { body: { name: '' } }));
    expect(res.status).toBe(400);
  });

  it('404 when the create parent belongs to another owner', async () => {
    db.getFolder.mockResolvedValue({ id: 'p1', ownerId: 'someone-else' });
    const res = await handleFolders(
      makeCtx('POST', '/api/folders', { body: { id: 'f2', name: 'Sub', parentId: 'p1' } }),
    );
    expect(res.status).toBe(404);
    expect(db.createFolder).not.toHaveBeenCalled();
  });

  it('201 on a valid create', async () => {
    db.createFolder.mockResolvedValue({ id: 'f2', name: 'Sub' });
    const res = await handleFolders(
      makeCtx('POST', '/api/folders', { body: { id: 'f2', name: 'Sub' } }),
    );
    expect(res.status).toBe(201);
  });

  it('404 when updating a folder that does not exist', async () => {
    db.getFolder.mockResolvedValue(null);
    const res = await handleFolders(makeCtx('PUT', '/api/folders/f9', { body: { name: 'x' } }));
    expect(res.status).toBe(404);
  });

  it('403 when updating a folder owned by someone else', async () => {
    db.getFolder.mockResolvedValue({ id: 'f1', ownerId: 'someone-else' });
    const res = await handleFolders(makeCtx('PUT', '/api/folders/f1', { body: { name: 'x' } }));
    expect(res.status).toBe(403);
    expect(db.updateFolder).not.toHaveBeenCalled();
  });

  it('204 when the owner deletes their folder', async () => {
    db.getFolder.mockResolvedValue({ id: 'f1', ownerId: 'owner-1' });
    const res = await handleFolders(makeCtx('DELETE', '/api/folders/f1'));
    expect(res.status).toBe(204);
    expect(db.deleteFolder).toHaveBeenCalledWith({}, 'f1');
  });
});
