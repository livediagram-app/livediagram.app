import { makeTestRouteContext } from './test-route-context';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Route surface for per-person document tags (docs/specs/013-workspace/tags.md "API"): the owner gate, the body
// rules, each refusal's status and token, and every write scoped to the resolved owner.

const { db } = vi.hoisted(() => ({
  db: {
    listTags: vi.fn(),
    createTag: vi.fn(),
    updateTag: vi.fn(),
    deleteTag: vi.fn(),
    addDocumentTag: vi.fn(),
    removeDocumentTag: vi.fn(),
  },
}));
vi.mock('../db', () => db);

import { handleTags } from './tags';

const call = (method: string, path: string, opts: { owner?: string | null; body?: unknown } = {}) =>
  handleTags(
    makeTestRouteContext(method, path, {
      owner: opts.owner === undefined ? 'owner-1' : opts.owner,
      body: opts.body,
    }),
  );

const TAG = { id: 't1', name: 'Design', colour: 'blue', createdAt: 1 };

beforeEach(() => {
  for (const fn of Object.values(db)) fn.mockReset();
});

describe('handleTags', () => {
  it('400 with no owner: a tag has to belong to someone', async () => {
    const res = await call('GET', '/api/tags', { owner: null });
    expect(res.status).toBe(400);
    expect(db.listTags).not.toHaveBeenCalled();
  });

  it('lists the owner tags and links', async () => {
    db.listTags.mockResolvedValue({ tags: [TAG], links: [{ tagId: 't1', documentId: 'd1' }] });
    const res = await call('GET', '/api/tags');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ tags: [TAG], links: [{ tagId: 't1', documentId: 'd1' }] });
    expect(db.listTags).toHaveBeenCalledWith({}, 'owner-1');
  });

  it('creates with a cleaned name and a lower-case colour', async () => {
    db.createTag.mockResolvedValue({ ok: true, value: TAG });
    const res = await call('POST', '/api/tags', {
      body: { id: 't1', name: '  Design   work ', colour: '#AABBCC' },
    });
    expect(res.status).toBe(201);
    expect(db.createTag).toHaveBeenCalledWith({}, 'owner-1', {
      id: 't1',
      name: 'Design work',
      colour: '#aabbcc',
    });
  });

  it.each([
    ['no id', { name: 'A', colour: 'blue' }],
    ['a bad id', { id: 'a/b', name: 'A', colour: 'blue' }],
    ['no name', { id: 't1', colour: 'blue' }],
    ['a long name', { id: 't1', name: 'x'.repeat(33), colour: 'blue' }],
    ['an unknown colour', { id: 't1', name: 'A', colour: 'chartreuse' }],
  ])('400 invalid_tag for %s', async (_label, body) => {
    const res = await call('POST', '/api/tags', { body });
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: 'invalid_tag' });
    expect(db.createTag).not.toHaveBeenCalled();
  });

  it.each([
    ['name-taken', 'tag_name_taken'],
    ['limit', 'tag_limit'],
  ])('409 %s', async (reason, error) => {
    db.createTag.mockResolvedValue({ ok: false, reason });
    const res = await call('POST', '/api/tags', {
      body: { id: 't1', name: 'Design', colour: 'blue' },
    });
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error });
  });

  it('updates only the fields sent', async () => {
    db.updateTag.mockResolvedValue({ ok: true, value: TAG });
    const res = await call('PUT', '/api/tags/t1', { body: { colour: 'green' } });
    expect(res.status).toBe(200);
    expect(db.updateTag).toHaveBeenCalledWith({}, 'owner-1', 't1', { colour: 'green' });
  });

  it("404s an update of someone else's tag", async () => {
    db.updateTag.mockResolvedValue({ ok: false, reason: 'not-found' });
    expect((await call('PUT', '/api/tags/t1', { body: { name: 'X' } })).status).toBe(404);
  });

  it('deletes, 404 when it was not theirs', async () => {
    db.deleteTag.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    expect((await call('DELETE', '/api/tags/t1')).status).toBe(204);
    expect((await call('DELETE', '/api/tags/t1')).status).toBe(404);
    expect(db.deleteTag).toHaveBeenCalledWith({}, 'owner-1', 't1');
  });

  it('puts a tag on and takes it off a document for THIS owner', async () => {
    db.addDocumentTag.mockResolvedValue(true);
    db.removeDocumentTag.mockResolvedValue(true);
    expect((await call('PUT', '/api/tags/t1/documents/d1')).status).toBe(204);
    expect((await call('DELETE', '/api/tags/t1/documents/d1')).status).toBe(204);
    expect(db.addDocumentTag).toHaveBeenCalledWith({}, 'owner-1', 't1', 'd1');
    expect(db.removeDocumentTag).toHaveBeenCalledWith({}, 'owner-1', 't1', 'd1');
  });

  it('404s a link the db refuses', async () => {
    db.addDocumentTag.mockResolvedValue(false);
    expect((await call('PUT', '/api/tags/t1/documents/gone')).status).toBe(404);
  });

  it('404s unknown shapes and methods', async () => {
    expect((await call('PATCH', '/api/tags')).status).toBe(404);
    expect((await call('GET', '/api/tags/t1')).status).toBe(404);
    expect((await call('GET', '/api/tags/a%2Fb')).status).toBe(404);
    expect((await call('PUT', '/api/tags/t1/other/d1')).status).toBe(404);
    expect((await call('POST', '/api/tags/t1/documents/d1')).status).toBe(404);
  });
});
