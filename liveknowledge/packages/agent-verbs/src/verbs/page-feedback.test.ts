import { describe, expect, it } from 'vitest';
import type { z } from 'zod';
import { ApiError } from '@liveworkspace/api-client';
import type { VerbContext, Verb } from '../define';
import { contextOf, DOC_A, fakeApi } from '../testing/fake-api';
import { applyPageCommentChanges, listedPageThread, trustFieldsOf, trustLine } from '../knowledge';
import { approval, comments, discuss, pageFeedbackVerbs } from './page-feedback';

// Approval and a page's comments for agents (docs/specs/030-knowledgebase/approval.md, page-comments.md "Agents").

const base = `/documents/${DOC_A}`;
type Sent = { method: string; path: string; body: unknown };

function setup(routes: Record<string, unknown>) {
  const sent: Sent[] = [];
  const recording = Object.fromEntries(
    Object.entries(routes).map(([path, answer]) => [
      path,
      async (request: Request) => {
        const text = await request.text();
        sent.push({
          method: request.method,
          path,
          body: text ? (JSON.parse(text) as unknown) : null,
        });
        return typeof answer === 'function' ? (answer as () => Response)() : Response.json(answer);
      },
    ]),
  );
  const api = fakeApi({ [base]: { document: { id: DOC_A, name: 'Handbook' } }, ...recording });
  const shareCodes: string[] = [];
  const ctx = contextOf(api, shareCodes, []) as unknown as VerbContext;
  return { api, ctx, sent, shareCodes };
}

const run = <I extends z.ZodObject, O extends z.ZodType>(
  verb: Verb<I, O>,
  ctx: VerbContext,
  input: z.infer<I>,
) => verb.run!(ctx, input);

const AT = Date.UTC(2026, 10, 1);
const THREAD = {
  id: 'th-123456789',
  tab: 'deploys',
  createdAt: AT,
  updatedAt: AT,
  resolved: false,
  comments: [
    {
      id: 'c1',
      text: 'Still true?',
      createdAt: AT,
      authorName: 'Priya',
      authorColor: '#000',
      by: 'k',
    },
    {
      id: 'c2',
      text: 'Yes',
      createdAt: AT,
      authorName: 'Priya',
      authorColor: '#000',
      by: 'k',
      ai: true as const,
      editedAt: AT + 1,
    },
  ],
};

describe('approval', () => {
  const path = `${base}/pages/Deploys/approval`;
  it('asks, or takes the request back', async () => {
    const { ctx, sent } = setup({ [path]: { knowledge: { tab: 'deploys' } } });
    const asked = await run(approval, ctx, { doc: DOC_A, page: 'Deploys' });
    const withdrawn = await run(approval, ctx, { doc: DOC_A, page: 'Deploys', withdraw: true });
    expect(sent.map((s) => s.body)).toEqual([{ action: 'request' }, { action: 'withdraw' }]);
    expect(approval.text!(asked)).toEqual(['~ deploys is Pending Approval']);
    expect(approval.text!(withdrawn)).toEqual(['~ deploys: the request is withdrawn']);
    expect(approval.quiet!(asked)).toEqual(['deploys']);
  });

  it('sends a share link’s code with the request', async () => {
    const { ctx, shareCodes } = setup({
      '/share/AB12': { document: { id: DOC_A, name: 'Handbook' }, role: 'participate' },
      [path]: { knowledge: { tab: 'deploys' } },
    });
    await run(approval, ctx, {
      doc: 'https://liveknowledge.app/document/shared?s=AB12',
      page: 'Deploys',
    });
    expect(shareCodes).toEqual(['AB12']);
  });
});

describe('comments', () => {
  const path = `${base}/pages/Deploys/threads`;
  const resolved = { ...THREAD, id: 'th-2', resolved: true, resolvedBy: 'Sam' };
  it('lists open threads by default, or resolved, or all', async () => {
    const { ctx } = setup({ [path]: { threads: [THREAD, resolved] } });
    const open = await run(comments, ctx, { doc: DOC_A, page: 'Deploys' });
    expect(open.threads.map((t) => t.thread)).toEqual(['th-123456789']);
    expect(open.count).toBe(1);
    const done = await run(comments, ctx, { doc: DOC_A, page: 'Deploys', status: 'resolved' });
    expect(done.threads).toEqual([
      expect.objectContaining({ thread: 'th-2', state: 'resolved', resolved_by: 'Sam' }),
    ]);
    const all = await run(comments, ctx, { doc: DOC_A, page: 'Deploys', status: 'all' });
    expect(comments.text!(all)).toEqual([
      '--- thread th-123456789 · open',
      'Priya · 2026-11-01 00:00: Still true?',
      'Priya [AI] · 2026-11-01 00:00 (edited): Yes',
      '--- thread th-2 · resolved by Sam',
      'Priya · 2026-11-01 00:00: Still true?',
      'Priya [AI] · 2026-11-01 00:00 (edited): Yes',
    ]);
    expect(comments.text!({ page: 'deploys', threads: [], count: 0 })).toEqual(['no comments']);
  });

  it('names a page with no threads as asked', async () => {
    const { ctx } = setup({ [path]: { threads: [] } });
    expect((await run(comments, ctx, { doc: DOC_A, page: 'Deploys' })).page).toBe('Deploys');
  });
});

describe('discuss', () => {
  const path = `${base}/pages/Deploys/threads`;
  it('starts a thread, replies, resolves and reopens', async () => {
    const { ctx, sent } = setup({ [path]: { thread: THREAD } });
    const started = await run(discuss, ctx, {
      doc: DOC_A,
      page: 'Deploys',
      text: ['Still', 'true?'],
    });
    await run(discuss, ctx, { doc: DOC_A, page: 'Deploys', text: ['Yes'], thread: 'th-1' });
    await run(discuss, ctx, { doc: DOC_A, page: 'Deploys', resolve: 'th-1' });
    const reopened = await run(discuss, ctx, { doc: DOC_A, page: 'Deploys', reopen: 'th-1' });
    expect(sent.map((s) => s.body)).toEqual([
      { op: 'start', text: 'Still true?' },
      { op: 'reply', thread: 'th-1', text: 'Yes' },
      { op: 'resolve', thread: 'th-1' },
      { op: 'reopen', thread: 'th-1' },
    ]);
    expect(discuss.text!(started)).toEqual(['+ started thread th-12345']);
    expect(reopened.applied).toEqual(['~ reopened thread th-12345']);
  });

  it('refuses nothing to say, and passes a refusal on', async () => {
    const { ctx, api } = setup({
      [path]: () => Response.json({ error: 'forbidden', message: 'No.' }, { status: 403 }),
    });
    await expect(
      run(discuss, ctx, { doc: DOC_A, page: 'Deploys', text: ['  '] }),
    ).rejects.toMatchObject({
      message: 'discuss needs the words to post, or --resolve <thread> or --reopen <thread>',
    });
    expect(api.calls).toEqual([]);
    await expect(
      run(discuss, ctx, { doc: DOC_A, page: 'Deploys', text: ['Hi'] }),
    ).rejects.toBeInstanceOf(ApiError);
  });
});

describe('applyPageCommentChanges', () => {
  it('says what each change did, and stops at a refusal', async () => {
    let calls = 0;
    const answers = [{ thread: THREAD }, { thread: THREAD }, { removed: 'th-123456789' }];
    const api = {
      json: async <T>() => {
        const next = answers[calls++];
        if (!next) throw new ApiError(403, 'not_your_comment');
        return next as T;
      },
    };
    const out = await applyPageCommentChanges(api, DOC_A, 'deploys', [
      { op: 'edit', thread: 't', comment: 'c', text: 'x' },
      { op: 'delete', thread: 't', comment: 'c' },
      { op: 'delete', thread: 't', comment: 'c' },
      { op: 'delete', thread: 't', comment: 'd' },
    ]);
    expect(out.applied).toEqual([
      '~ edited a comment on thread th-12345',
      '- deleted a comment on thread th-12345',
      '- deleted the last comment; thread th-12345 is gone',
    ]);
    expect(out.failure).toBeInstanceOf(ApiError);
  });

  it('turns anything else thrown into an Error, keeping it as the cause', async () => {
    const api = {
      json: async <T>(): Promise<T> => {
        // oxlint-disable-next-line typescript/only-throw-error -- what a broken fetch might throw
        throw 'offline';
      },
    };
    const out = await applyPageCommentChanges(api, DOC_A, 'deploys', [
      { op: 'reopen', thread: 't' },
    ]);
    expect(out.failure?.cause).toBe('offline');
  });
});

describe('the trust fields', () => {
  it('say a page is pending, or was rejected and why', () => {
    const trust = (approvalState: 'pending' | 'rejected', note?: string) =>
      trustFieldsOf({
        state: 'never-verified',
        stale: false,
        approval: { state: approvalState, requestedAt: AT, ...(note ? { note } : {}) },
      });
    expect(trust('pending')).toEqual({
      verified: 'never-verified',
      stale: false,
      approval: 'pending',
      approval_requested_at: '2026-11-01T00:00:00.000Z',
    });
    expect(trustLine(trust('pending'))).toBe('never verified, PENDING APPROVAL');
    expect(trustLine(trust('rejected', 'Fix it'))).toBe('never verified, REJECTED: Fix it');
    expect(trustLine(trust('rejected'))).toBe('never verified, REJECTED');
  });

  it('list a thread without its account ids', () => {
    expect(listedPageThread({ ...THREAD, resolved: true }).state).toBe('resolved');
  });

  it('are three commands, each with two examples', () => {
    expect(pageFeedbackVerbs.map((v) => v.id)).toEqual(['approval', 'comments', 'discuss']);
    for (const verb of pageFeedbackVerbs) expect(verb.cli!.examples).toHaveLength(2);
  });
});
