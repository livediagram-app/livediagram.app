import { makeTestRouteContext } from './test-route-context';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Characterisation tests for handleFolders' authorisation surface
// (docs/specs/013-workspace/folders.md). The owner-scoped folder tree must reject: an unauthenticated
// caller (400), a create/reparent that points at another owner's folder
// (404 — no existence leak across owners), and a mutation of a folder the
// caller doesn't own (403). Pins the mapping ahead of the requireOwner /
// noContent extraction.

const { db } = vi.hoisted(() => ({
  db: {
    createFolder: vi.fn(),
    deleteFolder: vi.fn(),
    getFolder: vi.fn(),
    listFoldersByOwner: vi.fn(),
    moveFolder: vi.fn(),
    renameFolder: vi.fn(),
  },
}));
vi.mock('../db', () => db);

// The Timeline side of a delete (docs/specs/013-workspace/timeline.md §3.5): the cascade and the
// tombstone, both off the response path.
const { timeline } = vi.hoisted(() => ({
  timeline: {
    markTimelineEventsDeletedBySource: vi.fn(),
    recordFolderCreated: vi.fn(),
    recordFolderDeleted: vi.fn(),
  },
}));
vi.mock('../db/timeline', () => ({
  markTimelineEventsDeletedBySource: timeline.markTimelineEventsDeletedBySource,
}));
vi.mock('../timeline', () => ({
  recordFolderCreated: timeline.recordFolderCreated,
  recordFolderDeleted: timeline.recordFolderDeleted,
}));

import type { RouteContext } from './context';
import { handleFolders } from './folders';

// Guest-shaped context: resolveOwner yields 'owner-1' unless overridden.
const makeCtx = (
  method: string,
  path: string,
  opts: { owner?: string | null; body?: unknown } = {},
): RouteContext =>
  makeTestRouteContext(method, path, {
    body: opts.body,
    owner: opts.owner === undefined ? 'owner-1' : opts.owner,
  });

beforeEach(() => {
  for (const fn of Object.values(db)) fn.mockReset();
  for (const fn of Object.values(timeline)) fn.mockReset();
  timeline.markTimelineEventsDeletedBySource.mockResolvedValue(undefined);
  timeline.recordFolderDeleted.mockResolvedValue(undefined);
  db.deleteFolder.mockResolvedValue({ parentId: null });
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
    expect(db.renameFolder).not.toHaveBeenCalled();
  });

  it('204 when the owner deletes their folder', async () => {
    db.getFolder.mockResolvedValue({ id: 'f1', ownerId: 'owner-1' });
    db.deleteFolder.mockResolvedValue({ parentId: null });
    const res = await handleFolders(makeCtx('DELETE', '/api/folders/f1'));
    expect(res.status).toBe(204);
    expect(db.deleteFolder).toHaveBeenCalledWith({}, 'f1');
  });

  it('logs where a deleted folder’s contents moved', async () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    db.getFolder.mockResolvedValue({ id: 'f1', ownerId: 'owner-1', teamId: null });
    db.deleteFolder
      .mockResolvedValueOnce({ parentId: 'p1' })
      .mockResolvedValueOnce({ parentId: null });
    await handleFolders(makeCtx('DELETE', '/api/folders/f1'));
    await handleFolders(makeCtx('DELETE', '/api/folders/f1'));
    expect(info).toHaveBeenCalledWith('folders: deleted scope=personal moved_up=parent');
    expect(info).toHaveBeenCalledWith('folders: deleted scope=personal moved_up=root');
    info.mockRestore();
  });

  // Deleting a folder used to leave its "Folder Created" card on the feed
  // beside the "Folder Deleted" one, where a document delete had always
  // swept its history first. Same cascade, same order: the earlier cards
  // go, and the tombstone is written AFTER so it isn't swept with them.
  it('sweeps the folders earlier timeline cards before writing its tombstone', async () => {
    db.getFolder.mockResolvedValue({ id: 'f1', name: 'Q3', ownerId: 'owner-1' });
    const background: Promise<unknown>[] = [];
    const ctx = makeTestRouteContext('DELETE', '/api/folders/f1', {
      owner: 'owner-1',
      waitUntil: (p) => background.push(p),
    });
    const res = await handleFolders(ctx);
    expect(res.status).toBe(204);
    await Promise.all(background);
    expect(timeline.markTimelineEventsDeletedBySource).toHaveBeenCalledWith({}, 'account', 'f1');
    expect(timeline.recordFolderDeleted).toHaveBeenCalledWith(
      {},
      { id: 'f1', name: 'Q3' },
      'owner-1',
    );
    const sweep = timeline.markTimelineEventsDeletedBySource.mock.invocationCallOrder[0]!;
    const tombstone = timeline.recordFolderDeleted.mock.invocationCallOrder[0]!;
    expect(sweep).toBeLessThan(tombstone);
  });
});

// Untyped bodies (docs/specs/013-workspace/folders.md "API"): a null or numeric name used to reach the
// NOT NULL column (a 500) or be stored as a number. Each is a 400 before any write.
describe('handleFolders body validation', () => {
  it.each([null, 42, {}, ''])('400 on a create whose name is %j', async (name) => {
    const res = await handleFolders(makeCtx('POST', '/api/folders', { body: { id: 'f2', name } }));
    expect(res.status).toBe(400);
    expect(db.createFolder).not.toHaveBeenCalled();
  });

  it('400 on a create whose id is not a string', async () => {
    const res = await handleFolders(
      makeCtx('POST', '/api/folders', { body: { id: 7, name: 'x' } }),
    );
    expect(res.status).toBe(400);
  });

  it.each([null, 42, ''])('400 on a rename to %j', async (name) => {
    db.getFolder.mockResolvedValue({ id: 'f1', ownerId: 'owner-1', teamId: null });
    const res = await handleFolders(makeCtx('PUT', '/api/folders/f1', { body: { name } }));
    expect(res.status).toBe(400);
    expect(db.renameFolder).not.toHaveBeenCalled();
  });

  it('400 on a numeric parentId, before the rename lands', async () => {
    db.getFolder.mockResolvedValue({ id: 'f1', ownerId: 'owner-1', teamId: null });
    const res = await handleFolders(
      makeCtx('PUT', '/api/folders/f1', { body: { name: 'ok', parentId: 3 } }),
    );
    expect(res.status).toBe(400);
    expect(db.renameFolder).not.toHaveBeenCalled();
    expect(db.moveFolder).not.toHaveBeenCalled();
  });
});

describe('handleFolders move', () => {
  const mine = (id: string) => ({ id, ownerId: 'owner-1', teamId: null });

  it('409 when the atomic move refuses (a cycle), with no rename', async () => {
    db.getFolder.mockImplementation(async (_env: unknown, id: string) => mine(id));
    db.moveFolder.mockResolvedValue(false);
    const res = await handleFolders(
      makeCtx('PUT', '/api/folders/a', { body: { name: 'A', parentId: 'b' } }),
    );
    expect(res.status).toBe(409);
    expect(db.moveFolder).toHaveBeenCalledWith({}, 'a', 'b');
    expect(db.renameFolder).not.toHaveBeenCalled();
  });

  it('200 when the move lands, root included', async () => {
    db.getFolder.mockImplementation(async (_env: unknown, id: string) => mine(id));
    db.moveFolder.mockResolvedValue(true);
    const res = await handleFolders(makeCtx('PUT', '/api/folders/a', { body: { parentId: null } }));
    expect(res.status).toBe(200);
    expect(db.moveFolder).toHaveBeenCalledWith({}, 'a', null);
  });
});
