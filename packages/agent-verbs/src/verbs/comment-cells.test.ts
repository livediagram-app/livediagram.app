import { describe, expect, it } from 'vitest';
import { VerbRefusal } from '../define';
import { contextOf, DOC_A, fakeApi, tabsOfA } from '../testing/fake-api';
import { commentAdd, commentLs, commentReply, commentResolve } from './comment';

// The comment verbs on a Sheet cell's thread (docs/specs/029-sheets/sheet.md "Cell comments"): the ref names the
// Sheet, `cell` its cell by A1, read against the sheet's stored layout.

const TAB = `/documents/${DOC_A}/tabs/tab-one-0000`;
const SHEETS = `/documents/${DOC_A}/sheets?tabId=tab-one-0000`;
const B4 = 'row004:colb01';
const sheetEl = {
  id: 'budget-sheet',
  type: 'shape',
  shape: 'plan-sheet',
  x: 0,
  y: 0,
  width: 960,
  height: 560,
  planSheet: { sheetId: 'sheet01' },
  cellComments: {
    [B4]: {
      resolved: false,
      comments: [{ id: 'k1', text: 'Why?', createdAt: 0, authorName: 'A', authorColor: '#000' }],
    },
  },
};
const square = { id: 'web', type: 'shape', shape: 'square', x: 0, y: 0, width: 10, height: 10 };
const words = { id: 'words', type: 'text', text: 'Hi', x: 0, y: 0, width: 10, height: 10 };
const ghost = {
  ...sheetEl,
  id: 'ghost-sheet',
  cellComments: undefined,
  planSheet: { sheetId: 'sheet99' },
};
const sheets = {
  sheets: [
    {
      id: 'sheet01',
      tabId: 'tab-one-0000',
      title: 'Budget',
      layout: { rows: ['row001', 'row002', 'row003', 'row004'], cols: ['cola01', 'colb01'] },
      cells: [],
      rev: 1,
      createdAt: 0,
      updatedAt: 0,
      updatedBy: { id: 'x', name: 'X', color: '#000' },
    },
  ],
};

function setUp() {
  const seen: { path: string; body: unknown }[] = [];
  const route = async (request: Request) => {
    const text = await request.text();
    seen.push({
      path: new URL(request.url).pathname.replace(/^\/api/, ''),
      body: text ? JSON.parse(text) : undefined,
    });
    return request.url.endsWith('/resolve')
      ? new Response(null, { status: 204 })
      : Response.json({ comment: { id: 'c9' } }, { status: 201 });
  };
  const api = fakeApi({
    ...tabsOfA,
    [TAB]: {
      tab: { id: 'tab-one-0000', name: 'Overview', elements: [sheetEl, square, words, ghost] },
    },
    [SHEETS]: sheets,
    [`${TAB}/comments`]: route,
    [`${TAB}/comments/k1/reply`]: route,
    [`${TAB}/comments/k1/resolve`]: route,
  });
  return { seen, ctx: contextOf(api) };
}

const refusal = (p: Promise<unknown>) =>
  p.then(
    () => null,
    (e: unknown) => (e instanceof VerbRefusal ? [e.status, e.code] : e),
  );

describe('comment verbs on a Sheet cell', () => {
  it('adds to a cell thread by A1, naming the cell key', async () => {
    const { seen, ctx } = setUp();
    const out = await commentAdd.run!(ctx, {
      doc: DOC_A,
      ref: 'budget',
      text: 'Check',
      cell: 'B4',
    });
    expect(out.text).toBe('+ comment c9 on budget B4');
    expect(seen[0]!.body).toEqual({ elementId: 'budget-sheet', text: 'Check', cell: B4 });
  });

  it('replies to and resolves the cell thread through its last comment', async () => {
    const { seen, ctx } = setUp();
    await commentReply.run!(ctx, { doc: DOC_A, ref: 'budget', text: 'Fixed', cell: 'B4' });
    await commentResolve.run!(ctx, { doc: DOC_A, ref: 'budget', cell: 'B4' });
    expect(seen.map((s) => s.path.split('/').slice(-2).join('/'))).toEqual([
      'k1/reply',
      'k1/resolve',
    ]);
  });

  it('refuses a cell off the sheet, an element that is not a Sheet, and a cell with no thread', async () => {
    const { ctx } = setUp();
    expect(
      await refusal(commentAdd.run!(ctx, { doc: DOC_A, ref: 'budget', text: 'x', cell: 'Z99' })),
    ).toEqual([400, 'cell_not_found']);
    expect(
      await refusal(commentAdd.run!(ctx, { doc: DOC_A, ref: 'web', text: 'x', cell: 'B4' })),
    ).toEqual([400, 'not_a_sheet']);
    expect(
      await refusal(commentReply.run!(ctx, { doc: DOC_A, ref: 'budget', text: 'x', cell: 'A1' })),
    ).toEqual([404, 'no_thread']);
    // A cell that is not A1, a Sheet whose sheet is gone, and an element that is not a shape.
    expect(
      await refusal(commentAdd.run!(ctx, { doc: DOC_A, ref: 'budget', text: 'x', cell: 'nope' })),
    ).toEqual([400, 'cell_not_found']);
    expect(
      await refusal(
        commentAdd.run!(ctx, { doc: DOC_A, ref: 'ghost-sheet', text: 'x', cell: 'B4' }),
      ),
    ).toEqual([400, 'cell_not_found']);
    expect(
      await refusal(commentAdd.run!(ctx, { doc: DOC_A, ref: 'words', text: 'x', cell: 'B4' })),
    ).toEqual([400, 'not_a_sheet']);
  });

  it('lists a cell thread with its A1', async () => {
    const api = fakeApi({
      ...tabsOfA,
      [`/documents/${DOC_A}/comments?status=open`]: {
        threads: [
          {
            tabId: 'tab-one-0000',
            tabName: 'Overview',
            elementId: 'budget-sheet',
            ref: 'budget',
            label: 'Budget',
            cell: B4,
            cellRef: 'B4',
            resolved: false,
            comments: [
              { id: 'k1', text: 'Why?', createdAt: 0, authorName: 'A', authorColor: '#000' },
            ],
          },
        ],
      },
    });
    const out = await commentLs.run!(contextOf(api), { doc: DOC_A, status: 'open' });
    expect(out.threads[0]).toMatchObject({ cell: B4, cellRef: 'B4' });
    expect(commentLs.text!(out)[0]).toBe('budget "Budget" · cell B4 · open · 1 · tab "Overview"');
  });
});
