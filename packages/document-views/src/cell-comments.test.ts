// A Sheet's cell threads in the views (docs/specs/029-sheets/sheet.md "Cell comments"): listed by the comments
// view and the thread listing, printed by show, counted by diff, and never leaking an author id.
import { describe, expect, it } from 'vitest';
import type { Element, Tab } from '@livediagram/document';
import { commentHosts, commentsView, threadListingLines } from './comments';
import { diffView } from './diff';
import { cellThreadsOf } from './fields';
import { buildViewModel } from './model';
import { showView, shownFields } from './show';

const comment = (id: string, text: string) => ({
  id,
  text,
  createdAt: 0,
  authorName: 'Sam',
  authorColor: '#000',
  authorId: 'user_secret',
});

const sheet = (cellComments?: unknown): Element =>
  ({
    id: 'sheet-el',
    type: 'shape',
    shape: 'plan-sheet',
    x: 0,
    y: 0,
    width: 960,
    height: 560,
    label: 'Budget',
    planSheet: { sheetId: 'sheet01' },
    ...(cellComments ? { cellComments } : {}),
  }) as unknown as Element;

const B4 = 'row004:colb01';
const C2 = 'row002:colc01';
const tab = (el: Element): Tab => ({ id: 't', name: 'T', elements: [el] });

describe('cell threads in the views', () => {
  const el = sheet({
    [C2]: { comments: [comment('b', 'Done?')], resolved: true },
    [B4]: { comments: [comment('a', 'Check this')], resolved: false },
    'row009:colz01': { comments: [], resolved: false },
  });

  it('reads each non-empty cell thread in key order', () => {
    expect(cellThreadsOf(el).map((t) => t.cell)).toEqual([C2, B4]);
    expect(cellThreadsOf(sheet())).toEqual([]);
  });

  it('lists a Sheet with only cell threads as a host, and each thread in the comments view', () => {
    const model = buildViewModel(tab(el));
    expect(commentHosts(model).map((h) => h.el.id)).toEqual(['sheet-el']);
    const { text, json } = commentsView(model, { all: true });
    expect(json.threads.map((t) => t.cell)).toEqual([C2, B4]);
    expect(text).toContain(`cell ${B4} · open · 1`);
    expect(text).not.toContain('user_secret');
  });

  it('prints a cell thread in show, with its author id omitted', () => {
    const model = buildViewModel(tab(el));
    const { text, json } = showView(model, el);
    expect(text).toContain(`cell ${B4} comments: open · 1`);
    expect(JSON.stringify(json)).not.toContain('user_secret');
    expect(json.omitted).toContain('cellComments{}.comments[].authorId');
  });

  it('names the cell in a thread listing, its A1 first', () => {
    const base = { ref: 's1', label: null, resolved: false, tabName: 'T', comments: [] };
    expect(threadListingLines({ ...base, cell: B4, cellRef: 'B4' })[0]).toBe(
      's1 · cell B4 · open · 0 · tab "T"',
    );
    expect(threadListingLines({ ...base, cell: B4 })[0]).toContain(`cell ${B4}`);
  });

  it('counts cell threads in a diff', () => {
    const before = tab(sheet());
    const after = tab(el);
    const { text } = diffView(before, after, { tabIds: ['t'], since: 1, rev: 2 });
    expect(text).toContain('cells 2 in 2 (1 open)');
  });
});

describe('malformed cell threads', () => {
  it('skips a cell whose thread is not an object, and strips nothing from cellComments that is not a record', () => {
    expect(
      cellThreadsOf(sheet({ [B4]: 'nope', [C2]: { comments: [comment('a', 'x')] } })).map(
        (t) => t.cell,
      ),
    ).toEqual([C2]);
    const odd = sheet(['not', 'a', 'record']);
    expect(shownFields(odd).fields.cellComments).toEqual(['not', 'a', 'record']);
    expect(shownFields(odd).omitted).not.toContain('cellComments{}.comments[].authorId');
  });
});
