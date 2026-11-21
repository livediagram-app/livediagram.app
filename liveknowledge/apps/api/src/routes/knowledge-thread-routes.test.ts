import { afterEach, describe, expect, it, vi } from 'vitest';
import { knowledgeKit, type Kit, type Who } from './knowledge-test-kit';

// docs/specs/030-knowledgebase/page-comments.md: who reads and writes a page's threads, each change, and the room op
// it sends.
vi.mock('../index-service', async (original) => {
  const tests = await import('../test-sqlite-d1');
  return {
    ...(await original<typeof import('../index-service')>()),
    requestGrant: tests.testRequestGrant,
    indexFor: tests.testIndexFor,
  };
});
const relayed = vi.hoisted(() => vi.fn(async () => 1));
vi.mock('../room-client', async (original) => ({
  ...(await original<typeof import('../room-client')>()),
  relayPages: relayed,
}));

afterEach(() => {
  vi.clearAllMocks();
});

type Comment = {
  id: string;
  text: string;
  by: string;
  ai?: true;
  editedAt?: number;
  authorId?: string;
};
type Thread = { id: string; resolved: boolean; resolvedBy?: string; comments: Comment[] };
const PATH = '/api/documents/kb/pages/deploys/threads';
const change = (kit: Kit, who: Who, body: object) => kit.call(who, 'POST', PATH, body);
const threadOf = async (res: Response) => (await res.json<{ thread: Thread }>()).thread;
const list = async (kit: Kit, who: Who = 'viewer') =>
  (await (await kit.call(who, 'GET', PATH)).json<{ threads: Thread[] }>()).threads;

describe('pages/:tab/threads', () => {
  it('starts a thread, replies, resolves and reopens, and tells the room each time', async () => {
    const kit = await knowledgeKit();
    const started = await change(kit, 'editor', { op: 'start', text: '  Is this still true? ' });
    expect(started.status).toBe(201);
    const thread = await threadOf(started);
    expect(thread.comments).toHaveLength(1);
    expect(thread.comments[0]).toMatchObject({ text: 'Is this still true?' });
    // No account id reaches the wire: the author is their collab key.
    expect(thread.comments[0]!.authorId).toBeUndefined();
    expect(thread.comments[0]!.by).toMatch(/^[0-9a-f]+$/);
    expect(relayed).toHaveBeenLastCalledWith(
      expect.anything(),
      'kb',
      [{ kind: 'page-thread', tabId: 'deploys', thread }],
      '[page-threads]',
    );
    const resolved = await threadOf(
      await change(kit, 'participant', { op: 'resolve', thread: thread.id }),
    );
    expect(resolved.resolved).toBe(true);
    const replied = await threadOf(
      await change(kit, 'participant', { op: 'reply', thread: thread.id, text: 'Yes, checked.' }),
    );
    // A reply reopens it.
    expect(replied.resolved).toBe(false);
    expect(replied.comments.map((c) => c.text)).toEqual(['Is this still true?', 'Yes, checked.']);
    await change(kit, 'editor', { op: 'resolve', thread: thread.id });
    expect(
      (await threadOf(await change(kit, 'editor', { op: 'reopen', thread: thread.id }))).resolved,
    ).toBe(false);
    // Every role reads them; a comment is no edit of the page, so its revision does not move.
    for (const who of ['viewer', 'link', 'participant'] as const)
      expect((await list(kit, who)).map((t) => t.comments.length)).toEqual([2]);
  });

  it('edits and deletes only your own comment; the last one going takes the thread', async () => {
    const kit = await knowledgeKit();
    const thread = await threadOf(await change(kit, 'editor', { op: 'start', text: 'First' }));
    const mine = thread.comments[0]!.id;
    const theirs = (
      await threadOf(
        await change(kit, 'participant', { op: 'reply', thread: thread.id, text: 'Second' }),
      )
    ).comments[1]!.id;
    const notOwn = await change(kit, 'editor', {
      op: 'edit',
      thread: thread.id,
      comment: theirs,
      text: 'x',
    });
    expect(notOwn.status).toBe(403);
    expect(
      (await change(kit, 'editor', { op: 'delete', thread: thread.id, comment: theirs })).status,
    ).toBe(403);
    const edited = await threadOf(
      await change(kit, 'editor', {
        op: 'edit',
        thread: thread.id,
        comment: mine,
        text: 'First, fixed',
      }),
    );
    expect(edited.comments[0]).toMatchObject({
      text: 'First, fixed',
      editedAt: expect.any(Number),
    });
    await change(kit, 'participant', { op: 'delete', thread: thread.id, comment: theirs });
    const gone = await change(kit, 'editor', { op: 'delete', thread: thread.id, comment: mine });
    expect(await gone.json()).toEqual({ removed: thread.id });
    expect(relayed).toHaveBeenLastCalledWith(
      expect.anything(),
      'kb',
      [{ kind: 'page-thread', tabId: 'deploys', threadId: thread.id, removed: true }],
      '[page-threads]',
    );
    expect(await list(kit)).toEqual([]);
  });

  it("lets an edit link's guest comment under the name they gave", async () => {
    const kit = await knowledgeKit();
    const res = await change(kit, 'edit-link', { op: 'start', text: 'From a guest', name: 'Sam' });
    expect(res.status).toBe(201);
    expect((await threadOf(res)).comments[0]).toMatchObject({ authorName: 'Sam (Guest)' });
  });

  it.each(['viewer', 'link', 'page-link', 'viewer-agent', 'agent-read-only', 'stranger'] as const)(
    'refuses %s every change',
    async (who) => {
      const kit = await knowledgeKit();
      const thread = await threadOf(await change(kit, 'editor', { op: 'start', text: 'Hello' }));
      for (const body of [
        { op: 'start', text: 'x' },
        { op: 'reply', thread: thread.id, text: 'x' },
        { op: 'resolve', thread: thread.id },
      ]) {
        const res = await change(kit, who, body);
        expect([401, 403, 404]).toContain(res.status);
      }
      expect((await list(kit)).map((t) => t.comments.length)).toEqual([1]);
    },
  );

  it("marks an agent's comment Generated by AI", async () => {
    const kit = await knowledgeKit();
    const thread = await threadOf(
      await change(kit, 'agent-stored', { op: 'start', text: 'A note' }),
    );
    expect(thread.comments[0]).toMatchObject({ ai: true });
  });

  it('refuses what is not a change, empty or long words, and unknown threads', async () => {
    const kit = await knowledgeKit();
    expect((await change(kit, 'editor', { op: 'start' })).status).toBe(400);
    expect((await change(kit, 'editor', { op: 'start', text: '   ' })).status).toBe(400);
    expect((await change(kit, 'editor', { op: 'start', text: 'x'.repeat(2001) })).status).toBe(400);
    expect((await change(kit, 'editor', { op: 'reply', thread: 'nope', text: 'x' })).status).toBe(
      404,
    );
    expect((await kit.call('editor', 'DELETE', PATH)).status).toBe(405);
  });

  it('goes with its page, and is in the data export', async () => {
    const kit = await knowledgeKit();
    await change(kit, 'editor', { op: 'start', text: 'Exported' });
    const { exportDocumentComments } = await import('../document-room/document-comments');
    const result = await exportDocumentComments(kit.db.env, 'kb');
    expect(result).toMatchObject({
      status: 'ok',
      threads: [
        { tabId: 'deploys', on: null, comments: [{ text: 'Exported', authorId: 'user_o' }] },
      ],
    });
    kit.db.sql.exec("DELETE FROM tabs WHERE id = 'deploys'");
    expect(kit.db.sql.prepare('SELECT COUNT(*) AS n FROM page_threads').get()).toEqual({ n: 0 });
  });
});
