import { describe, expect, it } from 'vitest';
import { ApiError } from '@liveworkspace/api-client';
import type { DocumentCommentThread } from '@liveworkspace/api-schema/comment-threads';
import { fakeApi, TEST_PRODUCT } from '../testing/product';
import { createThreadRun, listedThread, threadStopText, type ThreadChange } from './thread-run';

// docs/specs/015-api/mcp-server.md "Comment threads": list_threads and change_threads over a canvas product's
// comment endpoints, threads named by their element's ref.

const { listThreads, applyThreadChanges } = createThreadRun(TEST_PRODUCT);
const ID = 's1';
const BASE = `/sketches/${ID}`;

const comment = (id: string, extra: Partial<DocumentCommentThread['comments'][number]> = {}) => ({
  id,
  text: `text ${id}`,
  createdAt: Date.UTC(2026, 10, 1),
  authorName: 'Ana',
  authorColor: '#000',
  ...extra,
});

const THREADS: DocumentCommentThread[] = [
  {
    tabId: 't1',
    tabName: 'Main',
    elementId: 'pay-step',
    ref: 'pay',
    label: 'Pay',
    resolved: false,
    comments: [
      comment('c1aaaa'),
      comment('c2bbbb', { ai: true, editedAt: 3 }),
      comment('c2bbcc', { ai: true }),
    ],
  },
  {
    tabId: 't2',
    tabName: 'Detail',
    elementId: 'pay-detail',
    ref: 'pay',
    label: null,
    resolved: true,
    comments: [
      comment('c3', {
        reactions: [{ emoji: '👍', name: 'Thumbs Up', count: 1, by: ['Bea'] }],
      }),
    ],
  },
];

const TABS = [
  { id: 't1', name: 'Main' },
  { id: 't2', name: 'Detail' },
];

type Sent = { method: string; path: string; body: unknown };

// The api as the comment endpoints answer, recording each write.
function api(over: Record<string, unknown> = {}) {
  const sent: Sent[] = [];
  const write = async (request: Request) => {
    const path = new URL(request.url).pathname.replace(/^\/api/, '');
    const text = await request.text();
    sent.push({ method: request.method, path, body: text ? JSON.parse(text) : undefined });
    return new Response(null, { status: 204 });
  };
  const client = fakeApi({
    [`${BASE}/comments?status=all`]: { threads: THREADS },
    [`${BASE}/comments?status=open`]: { threads: THREADS.filter((t) => !t.resolved) },
    [BASE]: { sketch: { tabs: TABS } },
    [`${BASE}/tabs/t1`]: { tab: { elements: [{ id: 'pay-step' }, { id: 'ship-step' }] } },
    [`${BASE}/tabs/t1/comments`]: write,
    [`${BASE}/tabs/t1/comments/c2bbcc/reply`]: write,
    [`${BASE}/tabs/t1/comments/c2bbcc/resolve`]: write,
    [`${BASE}/tabs/t2/comments/c3/reopen`]: write,
    [`${BASE}/tabs/t1/comments/c2bbbb`]: write,
    [`${BASE}/tabs/t1/comments/c2bbcc`]: write,
    ...over,
  });
  return Object.assign(client, { sent });
}

const noRefusal = () => null;

describe('listedThread', () => {
  it('names each comment’s author and time, and marks an agent’s, an edited one and its reactions', () => {
    const [first, second] = THREADS.map(listedThread);
    expect(first).toMatchObject({ tabId: 't1', ref: 'pay', label: 'Pay', state: 'open' });
    expect(first!.comments[0]).toEqual({
      id: 'c1aaaa',
      author: 'Ana',
      at: '2026-11-01T00:00:00.000Z',
      text: 'text c1aaaa',
    });
    expect(first!.comments[1]).toMatchObject({ ai: true, edited: true });
    expect(second!.state).toBe('resolved');
    expect(second!.comments[0]!.reactions).toEqual([
      { emoji: '👍', name: 'Thumbs Up', count: 1, by: ['Bea'] },
    ]);
  });
});

describe('listThreads', () => {
  it('lists the status asked for on every tab, or one tab by id or name', async () => {
    const a = api();
    expect((await listThreads(a, ID, 'open')).map((t) => t.tabId)).toEqual(['t1']);
    expect((await listThreads(a, ID, 'all', 'detail')).map((t) => t.tabId)).toEqual(['t2']);
    expect((await listThreads(a, ID, 'all', 't1')).map((t) => t.tabId)).toEqual(['t1']);
  });

  it('refuses a tab the file lacks, naming its tabs, and reads an empty answer as no threads', async () => {
    await expect(listThreads(api(), ID, 'all', 'Nope')).rejects.toThrow(
      'No tab "Nope". The tabs: t1 "Main"; t2 "Detail".',
    );
    const empty = api({ [`${BASE}/comments?status=all`]: {}, [BASE]: {} });
    expect(await listThreads(empty, ID, 'all')).toEqual([]);
    await expect(listThreads(empty, ID, 'all', 'Main')).rejects.toThrow('No tab "Main"');
  });
});

describe('applyThreadChanges', () => {
  it('starts, replies, resolves, reopens, edits and deletes, each by its element’s ref', async () => {
    const a = api();
    const changes: ThreadChange[] = [
      { op: 'start', ref: 'ship', text: 'Is this tracked?' },
      { op: 'reply', ref: 'pay', tabId: 'Main', text: 'Done' },
      { op: 'resolve', ref: 'pay-step' },
      { op: 'reopen', ref: 'pay', tabId: 't2' },
      { op: 'edit', ref: 'pay', tabId: 't1', comment: 'c2bbbb', text: 'Done, tested' },
      { op: 'delete', ref: 'pay-s', comment: 'c2bbbb' },
    ];
    const out = await applyThreadChanges(a, ID, changes, noRefusal);
    expect(out).toEqual({
      applied: [
        '+ comment on ship',
        '+ reply on pay',
        '~ thread pay resolved',
        '~ thread pay open',
        '~ comment c2bbbb on pay',
        '- comment c2bbbb from pay',
      ],
    });
    expect(a.sent).toEqual([
      {
        method: 'POST',
        path: `${BASE}/tabs/t1/comments`,
        body: { elementId: 'ship-step', text: 'Is this tracked?' },
      },
      { method: 'POST', path: `${BASE}/tabs/t1/comments/c2bbcc/reply`, body: { text: 'Done' } },
      { method: 'POST', path: `${BASE}/tabs/t1/comments/c2bbcc/resolve`, body: undefined },
      { method: 'POST', path: `${BASE}/tabs/t2/comments/c3/reopen`, body: undefined },
      { method: 'PUT', path: `${BASE}/tabs/t1/comments/c2bbbb`, body: { text: 'Done, tested' } },
      { method: 'DELETE', path: `${BASE}/tabs/t1/comments/c2bbbb`, body: undefined },
    ]);
  });

  const stopped = async (change: ThreadChange, over: Record<string, unknown> = {}) =>
    (await applyThreadChanges(api(over), ID, [change], noRefusal)).refusal;

  it('refuses in words a ref on several tabs, a ref with no thread, and an element it cannot find', async () => {
    expect(await stopped({ op: 'resolve', ref: 'pay' })).toEqual({
      code: 'ref_ambiguous',
      message: 'pay names more than one thread: pay on "Main"; pay on "Detail". Give its tabId.',
    });
    expect(await stopped({ op: 'resolve', ref: 'ship' })).toMatchObject({
      code: 'no_thread',
      message: expect.stringContaining('Threads: pay on "Main"; pay on "Detail"'),
    });
    expect(
      await stopped(
        { op: 'resolve', ref: 'ship' },
        { [`${BASE}/comments?status=all`]: { threads: [] } },
      ),
    ).toMatchObject({ message: expect.stringContaining('Threads: none') });
    expect(await stopped({ op: 'start', ref: 'zzzz', text: 'x' })).toMatchObject({
      code: 'ref_not_found',
      message: 'No element zzzz on tab "Main".',
    });
    expect(await stopped({ op: 'start', ref: 'pay-stex', text: 'x' })).toMatchObject({
      code: 'ref_not_found',
      message: expect.stringContaining('Nearest:'),
    });
    expect(await stopped({ op: 'start', ref: '', text: 'x' })).toMatchObject({
      code: 'ref_not_found',
    });
    expect(
      await stopped(
        { op: 'start', ref: 'pay', text: 'x' },
        { [`${BASE}/tabs/t1`]: { tab: { elements: [{ id: 'pay-a' }, { id: 'pay-b' }] } } },
      ),
    ).toEqual({
      code: 'ref_ambiguous',
      message: 'pay names 2 elements on tab "Main": give more of it.',
    });
    expect(
      await stopped({ op: 'start', ref: 'x', text: 'x' }, { [BASE]: { sketch: { tabs: [] } } }),
    ).toEqual({
      code: 'no_tabs',
      message: 'That sketch has no tabs.',
    });
  });

  it('changes only an agent’s comment, named by its id or a long enough prefix', async () => {
    const own = (comment: string) => stopped({ op: 'delete', ref: 'pay', tabId: 't1', comment });
    expect(await own('c1aaaa')).toEqual({
      code: 'not_ai_comment',
      message:
        'Comment c1aaaa by Ana was written by a person: an agent edits and deletes only its own comments (those marked ai).',
    });
    expect(await own('c2bb')).toMatchObject({
      code: 'comment_ambiguous',
      message: expect.stringContaining('"c2bb" names more than one comment on pay'),
    });
    expect(await own('c2b')).toMatchObject({ code: 'comment_unknown' });
    expect(await own('c2bbc')).toBeUndefined();
  });

  it('words the comment endpoints’ own refusals, hands the rest to the product, and throws what no one words', async () => {
    const refusing = (status: number, body: unknown) => () => Response.json(body, { status });
    const reply: ThreadChange = { op: 'reply', ref: 'pay', tabId: 't1', text: 'x' };
    const at = `${BASE}/tabs/t1/comments/c2bbcc/reply`;
    expect(await stopped(reply, { [at]: refusing(409, { error: 'thread_full' }) })).toEqual({
      code: 'thread_full',
      message:
        'The api refused it: that thread holds the most comments it can (500). Comment on another element.',
    });
    const viewer = api({ [at]: refusing(403, { error: 'forbidden' }) });
    const worded = await applyThreadChanges(viewer, ID, [reply], (err) =>
      err instanceof ApiError ? { code: 'forbidden', message: 'view only' } : null,
    );
    expect(worded.refusal).toEqual({ code: 'forbidden', message: 'view only' });
    const bare = api({ [at]: refusing(403, 'nope') });
    await expect(applyThreadChanges(bare, ID, [reply], noRefusal)).rejects.toBeInstanceOf(ApiError);
  });

  it('stops at the first refusal, keeping what was applied before it', async () => {
    const out = await applyThreadChanges(
      api(),
      ID,
      [
        { op: 'resolve', ref: 'pay', tabId: 't1' },
        { op: 'resolve', ref: 'nope' },
        { op: 'reopen', ref: 'pay', tabId: 't1' },
      ],
      noRefusal,
    );
    expect(out.applied).toEqual(['~ thread pay resolved']);
    expect(out.refusal?.code).toBe('no_thread');
  });
});

describe('threadStopText', () => {
  it('says what was applied, then why it stopped', () => {
    expect(threadStopText([], { message: 'No thread on x.' })).toBe('No thread on x.');
    expect(threadStopText(['+ reply on a'], { message: 'No thread on x.' })).toBe(
      'Applied before it stopped:\n+ reply on a\nThen: No thread on x.',
    );
  });
});
