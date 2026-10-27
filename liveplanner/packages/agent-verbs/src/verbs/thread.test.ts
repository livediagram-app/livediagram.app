import { describe, expect, it } from 'vitest';
import type { Item } from '@liveplanner/items';
import type { CardThread } from '@liveplanner/project';
import { verbById } from '../catalogue';
import { contextOf, DOC_A, fakeApi, library, tabsOfA } from '../testing/fake-api';
import {
  threadDelete,
  threadEdit,
  threadLs,
  threadReopen,
  threadReply,
  threadResolve,
  threadStart,
} from './thread';

// The card thread verbs (docs/specs/015-api/cli.md "Commands", docs/specs/026-plan/plan-agents.md "Comment
// threads").
const by = { id: 'p', name: 'Priya', color: '#7c3aed' };
const CARD: Item = {
  id: 'card12',
  type: 'task',
  key: 12,
  rank: 'i',
  fields: { title: 'Basket' },
  rev: 1,
  createdAt: 0,
  updatedAt: 0,
  createdBy: by,
  updatedBy: by,
};
const THREAD: CardThread = {
  id: 'th-abcd1234abcd1234',
  title: 'Ada: Basket empties',
  resolved: false,
  comments: [
    {
      id: 'cm-person',
      text: 'It empties\non switch',
      createdAt: 0,
      authorName: 'Ada',
      authorColor: '#f97316',
    },
    {
      id: 'cm-agent',
      text: 'Keyed by restaurant',
      createdAt: 0,
      authorName: 'Priya',
      authorColor: '#7c3aed',
      ai: true,
      editedAt: 1,
    },
  ],
  createdAt: 0,
  createdBy: { name: 'Ada', color: '#f97316' },
  updatedAt: 0,
  home: DOC_A,
  cards: [{ projectId: DOC_A, itemId: 'card12', key: 12 }],
  rev: 1,
};

function ctxWith(threads: CardThread[] = [THREAD]) {
  const sent: string[] = [];
  const write = async (r: Request) => {
    sent.push(`${r.method} ${new URL(r.url).pathname.replace(/^\/api/, '')}`);
    return r.url.endsWith('/reopen')
      ? new Response(null, { status: 204 })
      : Response.json({ thread: THREAD, commentId: 'cm-new' });
  };
  const base = `/projects/${DOC_A}`;
  const api = fakeApi({
    ...library,
    ...tabsOfA,
    [`${base}/threads`]: { threads },
    [`${base}/items`]: { items: [CARD], rev: 1 },
    [`${base}/items/card12/threads`]: write,
    [`${base}/threads/${THREAD.id}/comments`]: write,
    [`${base}/threads/${THREAD.id}/comments/cm-agent`]: write,
    [`${base}/threads/${THREAD.id}/resolve`]: write,
    [`${base}/threads/${THREAD.id}/reopen`]: write,
  });
  return { ctx: contextOf(api), sent };
}

describe('thread ls', () => {
  it('prints each thread, then its comments indented, an agent’s marked', async () => {
    const { ctx } = ctxWith();
    const out = await threadLs.run!(ctx, threadLs.input.parse({ project: DOC_A }));
    const lines = threadLs.text!(out);
    expect(lines[0]).toMatch(/^th-abcd1234abcd1234\s+open\s+"Ada: Basket empties"\s+#12 Basket$/);
    expect(lines.slice(1)).toEqual([
      '  cm-person Ada: It empties on switch',
      '  cm-agent Priya [AI] (edited): Keyed by restaurant',
    ]);
    expect(threadLs.quiet!(out)).toEqual([THREAD.id]);
  });

  it('says when there are none, and names who resolved one', async () => {
    const none = await threadLs.run!(ctxWith([]).ctx, threadLs.input.parse({ project: DOC_A }));
    expect(threadLs.text!(none)).toEqual(['No threads.']);
    const resolved = { ...THREAD, resolved: true, resolvedBy: 'Bo' };
    const out = await threadLs.run!(
      ctxWith([resolved]).ctx,
      threadLs.input.parse({ project: DOC_A, status: 'resolved', item: '#12' }),
    );
    expect(threadLs.text!(out)[0]).toMatch(/resolved by Bo/);
  });

  it('refuses a card it cannot find', async () => {
    await expect(
      threadLs.run!(ctxWith().ctx, threadLs.input.parse({ project: DOC_A, item: '#9' })),
    ).rejects.toMatchObject({ code: 'item_unknown' });
  });
});

describe('the thread writes', () => {
  it('start, reply, resolve, reopen and edit, each one call', async () => {
    const { ctx, sent } = ctxWith();
    const base = `/projects/${DOC_A}`;
    const start = await threadStart.run!(ctx, { project: DOC_A, item: '#12', text: 'Hi' });
    expect(threadStart.text!(start)).toEqual([`+ thread ${THREAD.id} "${THREAD.title}" on #12`]);
    await threadReply.run!(ctx, { project: DOC_A, thread: 'ada: basket empties', text: 'Yes' });
    await threadResolve.run!(ctx, { project: DOC_A, thread: THREAD.id });
    const reopened = await threadReopen.run!(ctx, { project: DOC_A, thread: THREAD.id });
    expect(reopened.applied).toEqual([`~ thread "${THREAD.title}" open`]);
    await threadEdit.run!(ctx, {
      project: DOC_A,
      thread: THREAD.id,
      comment: 'cm-agent',
      text: 'Fixed',
    });
    expect(sent).toEqual([
      `POST ${base}/items/card12/threads`,
      `POST ${base}/threads/${THREAD.id}/comments`,
      `POST ${base}/threads/${THREAD.id}/resolve`,
      `POST ${base}/threads/${THREAD.id}/reopen`,
      `PUT ${base}/threads/${THREAD.id}/comments/cm-agent`,
    ]);
  });

  it('refuses to delete a person’s comment as a 403, with the way to list them', async () => {
    const { ctx, sent } = ctxWith();
    await expect(
      threadDelete.run!(ctx, { project: DOC_A, thread: THREAD.id, comment: 'cm-person' }),
    ).rejects.toMatchObject({
      status: 403,
      code: 'forbidden',
      hint: expect.stringMatching(/thread ls/),
    });
    expect(sent).toEqual([]);
  });

  it('refuses an unknown thread as a 400', async () => {
    await expect(
      threadResolve.run!(ctxWith().ctx, { project: DOC_A, thread: 'nothing' }),
    ).rejects.toMatchObject({ status: 400, code: 'thread_unknown' });
  });

  it('sits in the catalogue under thread', () => {
    for (const id of ['ls', 'start', 'reply', 'resolve', 'reopen', 'edit', 'delete'])
      expect(verbById(`thread.${id}`)).toBeDefined();
  });
});
