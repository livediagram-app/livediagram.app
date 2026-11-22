import { describe, expect, it } from 'vitest';
import {
  atLeast,
  called,
  contextFirst,
  linksOf,
  mentions,
  mentionsAll,
  pagesOf,
  pagesTitled,
  pagesUnder,
  replied,
  runChecks,
  toolsCalled,
} from './checks.mjs';

const made = {
  documents: [
    {
      id: 'd1',
      name: 'Handbook',
      pages: [
        { page: 'p1', title: 'Deploys', depth: 1, verified: 'verified', markdown: 'On Tuesdays.' },
        {
          page: 'p2',
          title: 'Hotfixes',
          depth: 2,
          parent: 'p1',
          verified: 'never-verified',
          markdown: 'Any day. See [[Rollbacks]] and [[Deploys]].',
        },
      ],
    },
    { id: 'd2', missing: true },
  ],
};

const run = {
  finalText: 'Deploys go out on Tuesdays.',
  calls: [
    { tool: 'find_documents', isError: false },
    { tool: 'get_context', isError: false },
    { tool: 'write_page', isError: true },
    { tool: 'suggest_edit', isError: false },
  ],
};

describe('readers', () => {
  it('reads the pages of every knowledgebase, by title and by parent', () => {
    expect(pagesOf(made).map((p) => [p.documentId, p.page])).toEqual([
      ['d1', 'p1'],
      ['d1', 'p2'],
    ]);
    expect(pagesTitled(made, /^deploys$/i).map((p) => p.page)).toEqual(['p1']);
    expect(pagesTitled(made, 'hotfix').map((p) => p.page)).toEqual(['p2']);
    expect(pagesUnder(made, 'Deploys').map((p) => p.page)).toEqual(['p2']);
    expect(pagesUnder(made, 'Nope')).toEqual([]);
    expect(pagesOf({ documents: [] })).toEqual([]);
  });

  it('reads the links of a page', () => {
    expect(linksOf(made.documents[0].pages![1])).toEqual(['Rollbacks', 'Deploys']);
    expect(linksOf({ markdown: 'No links.' })).toEqual([]);
  });

  it('finds words anywhere in what was made, and names what is missing', () => {
    expect(mentions(made, 'handbook', /tuesdays/i, 'a.y')).toBe(false);
    expect(mentions(made, 'handbook', /tuesdays/i)).toBe(true);
    expect(mentionsAll(made, [/tuesdays/i, 'Any day'])).toEqual({ pass: true, detail: null });
    expect(mentionsAll(made, [/fridays/i, 'Mondays'])).toEqual({
      pass: false,
      detail: 'missing: fridays, Mondays',
    });
    expect(atLeast(2, 2, 'pages')).toEqual({ pass: true, detail: null });
    expect(atLeast(3, 2, 'pages')).toEqual({ pass: false, detail: '2 pages, wanted 3+' });
  });
});

describe('what a run called and said', () => {
  it('lists the tools in order, and counts a tool only when it answered', () => {
    expect(toolsCalled(run)).toEqual([
      'find_documents',
      'get_context',
      'write_page',
      'suggest_edit',
    ]);
    expect(called(run, 'suggest_edit')).toBe(true);
    expect(called(run, 'write_page')).toBe(false);
    expect(called({}, 'get_context')).toBe(false);
    expect(replied(run, /tuesday/i)).toBe(true);
    expect(replied({}, 'tuesday')).toBe(false);
  });

  it('takes get_context as first when only finding the knowledgebase came before it', () => {
    expect(contextFirst(run)).toEqual({ pass: true, detail: 'first tool: get_context' });
    expect(contextFirst({ calls: [{ tool: 'search_pages' }, { tool: 'get_context' }] })).toEqual({
      pass: false,
      detail: 'first tool: search_pages',
    });
    expect(contextFirst({ calls: [{}] }).pass).toBe(false);
    expect(contextFirst({})).toEqual({ pass: false, detail: 'no tool called' });
  });
});

describe('runChecks', () => {
  it('adds the base checks, keeps a reason and fails a check that throws', () => {
    const task = {
      checks: [
        [
          'has deploys',
          ({ snap }: { snap: typeof made }) => pagesTitled(snap, /deploys/i).length > 0,
        ],
        ['reasoned', () => ({ pass: false, detail: 'why' })],
        ['bare reason', () => ({ pass: true })],
        [
          'throws',
          () => {
            throw new Error('boom');
          },
        ],
      ],
    } as const;
    expect(runChecks(task, { snap: made, run })).toEqual([
      { name: 'reached a knowledgebase', pass: true, detail: null },
      { name: 'replied', pass: true, detail: null },
      { name: 'has deploys', pass: true, detail: null },
      { name: 'reasoned', pass: false, detail: 'why' },
      { name: 'bare reason', pass: true, detail: null },
      { name: 'throws', pass: false, detail: 'check threw: boom' },
    ]);
    expect(
      runChecks({}, { snap: { documents: [] }, run: { finalText: ' ' } }).map((c) => c.pass),
    ).toEqual([false, false]);
    expect(
      runChecks({}, { snap: { documents: [{ id: 'x', missing: true }] }, run: {} })[0].pass,
    ).toBe(false);
  });
});
