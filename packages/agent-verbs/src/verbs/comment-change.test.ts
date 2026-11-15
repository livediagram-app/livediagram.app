import { describe, expect, it } from 'vitest';
import type { DocumentCommentThread } from '@liveworkspace/api-schema/comment-threads';
import { createAddressing } from '../addressing';
import { VerbRefusal } from '../define';
import { createFind, type FileSummary } from '../find';
import type { FolderNode } from '../folders';
import { contextOf, DOC_A, fakeApi, TEST_PRODUCT } from '../testing/product';
import { createCommentChangeVerbs } from './comment-change';

// `comment edit` and `comment delete` (docs/specs/015-api/cli.md "Commands"), over the test product: the token's
// own comments, by element ref and comment id or prefix (Work Tracker 920).

const { listAllFiles } = createFind<FileSummary & { ownerId?: string }, FolderNode, 'sketches'>(
  TEST_PRODUCT,
);
const { resolveFile } = createAddressing({ product: TEST_PRODUCT, listAllFiles });
const { commentEdit, commentDelete } = createCommentChangeVerbs({
  product: TEST_PRODUCT,
  arg: 'doc',
  resolveFile,
});

const BASE = `/sketches/${DOC_A}`;
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
    comments: [comment('c1aaaaaa'), comment('c2bbbbbb', { ai: true })],
  },
];

type Sent = { method: string; path: string; body: unknown };

function api() {
  const sent: Sent[] = [];
  const write = async (request: Request) => {
    const path = new URL(request.url).pathname.replace(/^\/api/, '');
    const text = await request.text();
    sent.push({ method: request.method, path, body: text ? JSON.parse(text) : undefined });
    return new Response(null, { status: 204 });
  };
  const client = fakeApi({
    [BASE]: { sketch: { id: DOC_A, name: 'Shop', tabs: [{ id: 't1', name: 'Main' }] } },
    [`${BASE}/comments?status=all`]: { threads: THREADS },
    [`${BASE}/tabs/t1/comments/c2bbbbbb`]: write,
  });
  return { client, sent };
}

describe('comment edit', () => {
  it('replaces the text of the agent’s own comment, named by a prefix', async () => {
    const { client, sent } = api();
    const out = await commentEdit.run!(contextOf(client), {
      doc: DOC_A,
      ref: 'pay',
      comment: 'c2bb',
      text: 'Done',
    });
    expect(out).toEqual({ id: 'c2bbbbbb', text: '~ comment c2bbbbbb on pay' });
    expect(sent).toEqual([
      { method: 'PUT', path: `${BASE}/tabs/t1/comments/c2bbbbbb`, body: { text: 'Done' } },
    ]);
    expect(commentEdit.text!(out)).toEqual(['~ comment c2bbbbbb on pay']);
    expect(commentEdit.quiet!(out)).toEqual(['c2bbbbbb']);
  });

  it('refuses a person’s comment before any call, 403 in words', async () => {
    const { client, sent } = api();
    const refused = await commentEdit.run!(contextOf(client), {
      doc: DOC_A,
      tab: 't1',
      ref: 'pay',
      comment: 'c1aaaaaa',
      text: 'x',
    }).catch((e: unknown) => e);
    expect(refused).toBeInstanceOf(VerbRefusal);
    expect(refused).toMatchObject({ status: 403, code: 'not_ai_comment' });
    expect((refused as VerbRefusal).hint).toContain('acme comment ls');
    expect(sent).toEqual([]);
  });
});

describe('comment delete', () => {
  it('deletes the agent’s own comment on the tab named', async () => {
    const { client, sent } = api();
    const out = await commentDelete.run!(contextOf(client), {
      doc: DOC_A,
      tab: 'Main',
      ref: 'pay',
      comment: 'c2bbbbbb',
    });
    expect(out).toEqual({ id: 'c2bbbbbb', text: '- comment c2bbbbbb from pay' });
    expect(sent).toEqual([
      { method: 'DELETE', path: `${BASE}/tabs/t1/comments/c2bbbbbb`, body: undefined },
    ]);
    expect(commentDelete.text!(out)).toEqual(['- comment c2bbbbbb from pay']);
    expect(commentDelete.quiet!(out)).toEqual(['c2bbbbbb']);
  });

  it('answers a missing thread or comment 404, and the api’s own refusal 409', async () => {
    const { client } = api();
    const run = (ref: string, c: string) =>
      commentDelete.run!(contextOf(client), { doc: DOC_A, ref, comment: c }).catch((e) => e);
    expect(await run('ship', 'c2bb')).toMatchObject({ status: 404, code: 'no_thread' });
    expect(await run('pay', 'zzzz')).toMatchObject({ status: 404, code: 'comment_unknown' });
    const busy = fakeApi({
      [BASE]: { sketch: { id: DOC_A, name: 'Shop', tabs: [{ id: 't1', name: 'Main' }] } },
      [`${BASE}/comments?status=all`]: { threads: THREADS },
      [`${BASE}/tabs/t1/comments/c2bbbbbb`]: () =>
        Response.json({ error: 'tab_busy' }, { status: 409 }),
    });
    const refused = await commentDelete.run!(contextOf(busy), {
      doc: DOC_A,
      ref: 'pay',
      comment: 'c2bbbbbb',
    }).catch((e: unknown) => e);
    expect(refused).toMatchObject({ status: 409, code: 'tab_busy' });
  });

  it('lets any other api failure through as it came', async () => {
    const broken = fakeApi({
      [BASE]: { sketch: { id: DOC_A, name: 'Shop', tabs: [{ id: 't1', name: 'Main' }] } },
      [`${BASE}/comments?status=all`]: { threads: THREADS },
      [`${BASE}/tabs/t1/comments/c2bbbbbb`]: () => new Response('down', { status: 500 }),
    });
    const failed = await commentDelete.run!(contextOf(broken), {
      doc: DOC_A,
      ref: 'pay',
      comment: 'c2bbbbbb',
    }).catch((e: unknown) => e);
    expect(failed).not.toBeInstanceOf(VerbRefusal);
    expect(failed).toMatchObject({ status: 500 });
  });
});
