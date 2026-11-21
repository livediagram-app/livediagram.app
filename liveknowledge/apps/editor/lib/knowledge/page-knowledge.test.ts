import { describe, expect, it, vi } from 'vitest';
import type { AccessLevel, PageHealthResponse, PageKnowledge } from '@liveknowledge/api-schema';
import { ApiError } from '@liveworkspace/workbench/lib/api/api-error';
import { ContextBudgetError } from '@/lib/api/knowledge';
import { resolveEditorCapabilities } from '@/lib/editor-capabilities';
import { knowledgeRights } from './knowledge-rights';
import { contextBudgetText, knowledgeFailureText } from './knowledge-words';
import { currentHeading, pageHeadings, sameHeadings } from './page-headings';
import { createPageKnowledgeStore } from './page-knowledge-store';
import { pageTrust, reviewDueText, trustMarks } from './page-trust';

// docs/specs/030-knowledgebase/verification.md: the states, who may change them, and the optimistic store.

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 10, 20, 12);
const who = { ownerId: 'u1', shareCode: null };

describe('a page’s state, worked out when read', () => {
  it('is Never Verified with no verifiedAt, Verified until the review, then Review Due', () => {
    expect(pageTrust(undefined, 90, NOW).state).toBe('never-verified');
    const fresh = pageTrust({ verifiedAt: NOW - 10 * DAY, verifiedBy: 'u1' }, 90, NOW);
    expect(fresh).toMatchObject({ state: 'verified', reviewAt: NOW + 80 * DAY });
    expect(pageTrust({ verifiedAt: NOW - 91 * DAY }, 90, NOW).state).toBe('review-due');
    // Under a period of Never a page is verified with no review date.
    const never = pageTrust({ verifiedAt: NOW - 900 * DAY }, 'never', NOW);
    expect(never.state).toBe('verified');
    expect(never.reviewAt).toBeUndefined();
  });

  it('follows the knowledgebase’s Review Period, never one a page once stored', () => {
    const stored = { verifiedAt: NOW - 100 * DAY, reviewEvery: 'never' };
    expect(pageTrust(stored, 90, NOW)).toMatchObject({
      state: 'review-due',
      fields: { verifiedAt: NOW - 100 * DAY },
    });
    expect(pageTrust(stored, 90, NOW).fields).not.toHaveProperty('reviewEvery');
    expect(pageTrust(stored, 180, NOW)).toMatchObject({
      state: 'verified',
      reviewAt: NOW + 80 * DAY,
    });
    const pages = [{ id: 'a', knowledge: { verifiedAt: NOW - 40 * DAY } }];
    expect([...trustMarks(pages, 30, NOW)]).toEqual([['a', 'review-due']]);
    expect([...trustMarks(pages, 'never', NOW)]).toEqual([['a', 'verified']]);
  });

  it('marks only pages that were verified, in one pass over the list', () => {
    const marks = trustMarks(
      [
        { id: 'a', knowledge: { verifiedAt: NOW - DAY } },
        { id: 'b', knowledge: { verifiedAt: NOW - 400 * DAY } },
        { id: 'c' },
        { id: 'd', knowledge: { owner: 'u1' } },
      ],
      90,
      NOW,
    );
    expect([...marks]).toEqual([
      ['a', 'verified'],
      ['b', 'review-due'],
    ]);
  });

  it('says when the review is, or was, due', () => {
    expect(reviewDueText(Date.UTC(2027, 0, 14, 12), NOW)).toMatch(/^Review due 14 Jan/);
    expect(reviewDueText(NOW - 5 * DAY, NOW)).toMatch(/^Review was due 15 Nov/);
  });
});

describe('who may verify and change the fields', () => {
  const rights = (level: AccessLevel, over: Partial<Parameters<typeof knowledgeRights>[0]> = {}) =>
    knowledgeRights({
      can: resolveEditorCapabilities(level),
      isStructureReadOnly: level !== 'edit',
      accountUserId: 'u1',
      offline: false,
      ...over,
    });

  it('an Editor verifies and sets the owner, the interval and Always in Context', () => {
    expect(rights('edit')).toEqual({ editFields: true, verify: true });
  });
  it.each(['participate', 'view'] as const)('a %s session reads only', (level) => {
    expect(rights(level)).toEqual({ editFields: false, verify: false });
  });
  it('an Editor with no account sets the fields but cannot vouch for a page', () => {
    expect(rights('edit', { accountUserId: null })).toEqual({ editFields: true, verify: false });
  });
  it('an Editor on one page of the knowledgebase, or on one kept Offline, changes nothing', () => {
    expect(rights('edit', { isStructureReadOnly: true }).verify).toBe(false);
    expect(rights('edit', { offline: true })).toEqual({ editFields: false, verify: false });
  });
});

describe('the store', () => {
  const answer = (over: Partial<PageKnowledge> = {}): PageKnowledge => ({
    tab: 't1',
    state: 'never-verified',
    changedSinceVerified: false,
    tokens: 100,
    ...over,
  });
  const health = (over: Partial<PageKnowledge> = {}): PageHealthResponse => ({
    knowledge: answer(over),
    reads: { people: 4, agents: 9 },
    created: { by: 'u2', at: NOW - DAY },
    updated: { by: 'u1', at: NOW - 60_000 },
  });
  function deferred<T>() {
    let resolve!: (value: T) => void;
    let reject!: (err: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  }

  it('reads a page’s health once for the session, and concurrent asks share a request', async () => {
    const api = { health: vi.fn(async () => health()), verify: vi.fn(), set: vi.fn() };
    const store = createPageKnowledgeStore(api);
    const seen = vi.fn();
    store.subscribe(seen);
    await Promise.all([store.load(who, 'd1', 't1'), store.load(who, 'd1', 't1')]);
    await store.load(who, 'd1', 't1');
    expect(api.health).toHaveBeenCalledTimes(1);
    expect(seen).toHaveBeenCalledTimes(1);
    expect(store.healthOf('d1', 't1')?.reads).toEqual({ people: 4, agents: 9 });
    await store.load(who, 'd1', 't1', true);
    expect(api.health).toHaveBeenCalledTimes(2);
  });

  it('keeps what it held when a read fails', async () => {
    const api = {
      health: vi.fn().mockRejectedValue(new Error('down')),
      verify: vi.fn(),
      set: vi.fn(),
    };
    const store = createPageKnowledgeStore(api);
    await store.load(who, 'd1', 't1');
    expect(store.healthOf('d1', 't1')).toBeUndefined();
  });

  it('shows a Verify at once, then keeps the server’s answer', async () => {
    const sent = deferred<PageKnowledge>();
    const api = {
      health: vi.fn(async () => health()),
      verify: vi.fn(() => sent.promise),
      set: vi.fn(),
    };
    const store = createPageKnowledgeStore(api);
    await store.load(who, 'd1', 't1');
    const page = { id: 't1' };
    const done = store.verify(who, 'd1', page, 'u1', NOW);
    // Before the server answers: verified by the caller, who owns a page with no owner.
    expect(store.fieldsOf(page)).toEqual({ owner: 'u1', verifiedAt: NOW, verifiedBy: 'u1' });
    expect(store.healthOf('d1', 't1')?.knowledge).toMatchObject({
      state: 'verified',
      reviewAt: NOW + 90 * DAY,
      changedSinceVerified: false,
    });
    sent.resolve(answer({ state: 'verified', owner: 'u1', verifiedBy: 'u1', verifiedAt: NOW + 5 }));
    await done;
    expect(store.fieldsOf(page)).toMatchObject({ verifiedAt: NOW + 5 });
    // What only Page Health's read says stays: the week's reads, who created and updated the page.
    expect(store.healthOf('d1', 't1')).toMatchObject({
      reads: { people: 4, agents: 9 },
      created: { by: 'u2' },
      updated: { by: 'u1' },
    });
  });

  it('rolls a refused Verify back, fields and health alike', async () => {
    const api = {
      health: vi.fn(async () => health()),
      verify: vi.fn().mockRejectedValue(new ApiError('verify page', 403, 'forbidden')),
      set: vi.fn(),
    };
    const store = createPageKnowledgeStore(api);
    await store.load(who, 'd1', 't1');
    const page = { id: 't1', knowledge: { owner: 'u2' } };
    await expect(store.verify(who, 'd1', page, 'u1', NOW)).rejects.toMatchObject({ status: 403 });
    expect(store.fieldsOf(page)).toEqual({ owner: 'u2' });
    expect(store.healthOf('d1', 't1')?.knowledge.state).toBe('never-verified');
  });

  it('sets the fields at once and rolls back a page over the context budget', async () => {
    const refusal = new ContextBudgetError('set page knowledge', {
      tokens: 3000,
      used: 6000,
      budget: 8000,
    });
    const set = vi
      .fn()
      .mockResolvedValueOnce(answer({ owner: 'u3' }))
      .mockRejectedValueOnce(refusal);
    const store = createPageKnowledgeStore({ health: vi.fn(), verify: vi.fn(), set });
    const page = { id: 't1', knowledge: { owner: 'u2' } };
    await store.setFields(who, 'd1', page, { owner: 'u3' }, NOW);
    expect(store.fieldsOf(page)).toEqual({ owner: 'u3' });
    const pending = store.setFields(who, 'd1', page, { context: true }, NOW);
    expect(store.fieldsOf(page)).toMatchObject({ context: true });
    await expect(pending).rejects.toBe(refusal);
    expect(store.fieldsOf(page)).toEqual({ owner: 'u3' });
    expect(knowledgeFailureText(refusal, 'context')).toBe(contextBudgetText(refusal));
  });

  it('gives way to the tab once the room’s patch changes its fields', async () => {
    const set = vi.fn().mockResolvedValue(answer({ owner: 'u3' }));
    const store = createPageKnowledgeStore({ health: vi.fn(), verify: vi.fn(), set });
    const page = { id: 't1', knowledge: { owner: 'u2' } };
    await store.setFields(who, 'd1', page, { owner: 'u3' }, NOW);
    expect(store.fieldsOf(page)).toEqual({ owner: 'u3' });
    // A peer's later change arrives on the tab: it is what shows.
    expect(store.fieldsOf({ id: 't1', knowledge: { owner: 'u9' } })).toEqual({ owner: 'u9' });
  });
});

describe('a refusal in words', () => {
  it('names the budget, the owner, the limits and the role, never a code', () => {
    expect(contextBudgetText({ tokens: 3000, used: 6000, budget: 8000 })).toBe(
      'This page is 3,000 tokens and 6,000 of 8,000 are in use. Take another page out of Always in Context first.',
    );
    expect(knowledgeFailureText(new ApiError('x', 400, 'owner_no_access'), 'owner')).toMatch(
      /someone who can open this knowledgebase/,
    );
    expect(knowledgeFailureText(new ApiError('x', 400, 'query_too_long'), 'search')).toBe(
      'A search is at most 200 characters.',
    );
    expect(knowledgeFailureText(new ApiError('x', 429, 'rate_limited'), 'search')).toMatch(
      /Too many searches/,
    );
    expect(knowledgeFailureText(new ApiError('x', 403, 'forbidden'), 'verify')).toMatch(
      /Only an Editor signed in/,
    );
    expect(knowledgeFailureText(new Error('offline'), 'verify')).toBe(
      'The page could not be verified. Try again.',
    );
  });
});

describe('the headings of a page', () => {
  const para = (id: string, style: string, text: string) =>
    ({ id, type: 'paragraph', style, runs: [{ text }] }) as never;
  const blocks = [
    para('t', 'title', 'Release Process'),
    para('a', 'h1', 'Before  You Start'),
    para('b', 'body', 'Words.'),
    para('c', 'h2', 'Tag the Build'),
    para('d', 'h3', ''),
  ];

  it('lists Heading 1 to 3 with words, never the Title, and keeps its answer per block list', () => {
    const headings = pageHeadings(blocks);
    expect(headings).toEqual([
      { id: 'a', level: 1, text: 'Before You Start' },
      { id: 'c', level: 2, text: 'Tag the Build' },
    ]);
    // The same blocks: the same list, nothing read again.
    expect(pageHeadings(blocks)).toBe(headings);
    // A commit that changed a body block makes a new list that reads the same.
    const next = pageHeadings([...blocks]);
    expect(next).not.toBe(headings);
    expect(sameHeadings(next, headings)).toBe(true);
    expect(sameHeadings(next, [{ id: 'a', level: 1, text: 'Other' }, headings[1]!])).toBe(false);
  });

  it('marks the last heading at or above the reading line', () => {
    const tops = [
      { id: 'a', top: -400 },
      { id: 'c', top: 120 },
      { id: 'e', top: 900 },
    ];
    expect(currentHeading(tops, 160)).toBe('c');
    expect(currentHeading(tops, -500)).toBe('a');
    expect(currentHeading([], 160)).toBeUndefined();
  });
});
