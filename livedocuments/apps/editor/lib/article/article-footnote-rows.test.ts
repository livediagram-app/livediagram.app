// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EditorState } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import type { Node as PMNode } from 'prosemirror-model';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import type {
  ArticleBlock,
  ArticleRun,
  ArticleTableBlock,
  LaidOutPage,
} from '@livedocuments/document';
import { blocksToDoc } from './article-convert';
import { flowFrame } from './article-flow-geometry';
import { footnoteKey, footnotesPlugin, setFootBreaks, type FootBreak } from './article-footnotes';
import type { FootnoteNotes, NotePage } from './article-footnote-notes';
import { layoutFootnotes } from './article-footnote-layout';
import { hasHeader, splitRow, tableCut, tableNear, wholeRowAt } from './article-footnote-rows';

// docs/specs/007-editor/article-pages.md "Footnotes", "A table row above the notes": a row that would run under a
// page's notes moves to the next page whole, with its table's header row, or splits when it already starts its page;
// no row runs under the notes at any length.

// A layout the tests can reason about (as article-footnote-layout.test.ts): every place one step along a line of 10,
// five lines of 20 px a page. A table's cells sit side by side, each from its row's top; a row never breaks inside
// on its own unless it starts its page, a break in a cell sends the rest of the cell to the next page's top.
const PER_LINE = 10;
const LINE = 20;
const LINES = 5;
const PAGES = 120;
const pages = Array.from(
  { length: PAGES },
  (_v, i) =>
    ({
      id: `p${i}`,
      flow: 'f',
      rect: { x: i * 300, y: 0, width: 260, height: 160 },
    }) as LaidOutPage,
);
const frame = flowFrame(pages, 30, 30);

type At = { col: number; line: number; step: number };

function simulate(doc: PMNode, breaks: readonly FootBreak[]): Map<number, At> {
  const blockAt = new Set(breaks.filter((b) => b.block).map((b) => b.pos));
  const inlineAt = new Set(
    breaks.filter((b) => !b.block).flatMap((b) => [b.pos, ...(b.also ?? [])]),
  );
  const at = new Map<number, At>();
  let col = 0;
  let line = 0;
  let step = 0;
  const forced = () => {
    if (line > 0 || step > 0) {
      col++;
      line = 0;
      step = 0;
    }
  };
  const advance = (p: At) => {
    if (++p.step === PER_LINE) {
      p.step = 0;
      if (++p.line === LINES) {
        p.line = 0;
        p.col++;
      }
    }
  };
  const freshLine = () => {
    if (step === 0) return;
    step = 0;
    if (++line === LINES) {
      line = 0;
      col++;
    }
  };
  doc.forEach((block, bpos) => {
    if (block.type.name !== 'table') {
      for (let pos = bpos; pos < bpos + block.nodeSize; pos++) {
        if (blockAt.has(pos) || inlineAt.has(pos)) forced();
        at.set(pos, { col, line, step });
        const p = { col, line, step };
        advance(p);
        ({ col, line, step } = p);
      }
      return;
    }
    if (blockAt.has(bpos)) forced();
    freshLine();
    at.set(bpos, { col, line, step: 0 });
    let lastRow: At = { col, line, step: 0 };
    block.forEach((row, offset) => {
      const rowPos = bpos + 1 + offset;
      if (blockAt.has(rowPos)) forced();
      const cells: { start: number; end: number }[] = [];
      row.forEach((cell, o) => {
        const start = rowPos + 1 + o + 1;
        cells.push({ start, end: start + cell.content.size });
      });
      // Lines each cell needs on this page: to its first break, or all of it.
      const here = Math.max(
        ...cells.map((c) => {
          let n = c.end - c.start + 1;
          for (let p = c.start; p <= c.end; p++) if (inlineAt.has(p)) n = Math.min(n, p - c.start);
          return Math.ceil(n / PER_LINE);
        }),
      );
      if (line > 0 && line + here > LINES) forced();
      const top = { col, line };
      at.set(rowPos, { ...top, step: 0 });
      let end: At = { ...top, step: 0 };
      for (const c of cells) {
        at.set(c.start - 1, { ...top, step: 0 });
        const p: At = { ...top, step: 0 };
        for (let pos = c.start; pos <= c.end; pos++) {
          if (inlineAt.has(pos)) {
            p.col = top.col + 1;
            p.line = 0;
            p.step = 0;
          }
          at.set(pos, { ...p });
          if (pos < c.end) advance(p);
        }
        at.set(c.end + 1, at.get(c.end)!);
        const last = at.get(c.end)!;
        if (last.col > end.col || (last.col === end.col && last.line > end.line)) end = last;
      }
      at.set(rowPos + row.nodeSize - 1, end);
      lastRow = end;
      col = end.col;
      line = end.line + 1;
      step = 0;
      if (line === LINES) {
        line = 0;
        col++;
      }
    });
    // The table's end reads as its last row's foot.
    at.set(bpos + block.nodeSize - 1, lastRow);
  });
  at.set(doc.content.size, { col, line, step });
  return at;
}

const views: EditorView[] = [];
afterEach(() => {
  views.splice(0).forEach((v) => v.destroy());
});

function setUp(blocks: readonly ArticleBlock[]) {
  const view = new EditorView(document.createElement('div'), {
    state: EditorState.create({ doc: blocksToDoc(blocks), plugins: [footnotesPlugin(() => {})] }),
  });
  views.push(view);
  let cache: { state: EditorState; at: Map<number, At> } | null = null;
  const placeOf = (pos: number) => {
    if (cache?.state !== view.state)
      cache = {
        state: view.state,
        at: simulate(view.state.doc, footnoteKey.getState(view.state)?.breaks ?? []),
      };
    return cache.at.get(pos)!;
  };
  view.coordsAtPos = (pos: number) => {
    const p = placeOf(pos);
    const left = p.col * frame.stride + p.step;
    return { left, right: left + 1, top: p.line * LINE, bottom: (p.line + 1) * LINE };
  };
  let drawn: readonly NotePage[] = [];
  const notes = {
    setVars: vi.fn(),
    editing: () => null,
    // A note's height: 20, under a rule of 10 (one note leaves the text 70 px of the page's 100).
    heightsOf: (texts: readonly string[]) => ({ head: 10, notes: texts.map(() => 20) }),
    render: (p: readonly NotePage[]) => {
      drawn = p;
    },
  } as unknown as FootnoteNotes;
  const root = { left: 0, top: 0 } as DOMRect;
  const pass = () => layoutFootnotes(view, { frame, root, z: 1, pages, notes });
  const settle = () => {
    let laid = pass();
    for (let i = 0; i < 8 && laid.changed; i++) laid = pass();
    return {
      breaks: footnoteKey.getState(view.state)!.breaks,
      drawn,
      limits: laid.limits,
      settled: !laid.changed,
    };
  };
  // Every place on a page with notes that runs under them: none, at any length.
  const underNotes = (limits: ReadonlyMap<number, number>) => {
    const out: number[] = [];
    // (The writing's very end has no line of its own.)
    for (let pos = 0; pos < view.state.doc.content.size; pos++) {
      const p = placeOf(pos);
      const limit = limits.get(p.col);
      if (limit !== undefined && (p.line + 1) * LINE > limit) out.push(pos);
    }
    return out;
  };
  return { view, settle, underNotes, placeOf };
}

const text = (length: number, refAt?: number): ArticleRun[] =>
  refAt === undefined
    ? [{ text: 'x'.repeat(length) }]
    : [
        { text: 'x'.repeat(refAt) },
        { text: '*', fn: 'Note' },
        { text: 'x'.repeat(length - refAt - 1) },
      ];

const para = (id: string, length: number, refAt?: number): ArticleBlock => ({
  id,
  type: 'paragraph',
  runs: text(length, refAt),
});

// A table of rows of cells, each cell its runs.
const table = (id: string, rows: ArticleRun[][][], header = false): ArticleTableBlock => ({
  id,
  type: 'table',
  ...(header ? { header: true as const } : {}),
  cols: rows[0]!.map((_c, i) => ({ id: `${id}c${i}`, w: 1 / rows[0]!.length })),
  rows: rows.map((cells, i) => ({ id: `${id}r${i}`, cells })),
});

// Where a table's rows and cells start in a doc whose blocks are `blocks`.
function tableAt(doc: PMNode, id: string) {
  let pos = -1;
  doc.forEach((n, p) => {
    if (n.attrs.id === id) pos = p;
  });
  const node = doc.nodeAt(pos)!;
  const rows: number[] = [];
  const cells: number[][] = [];
  node.forEach((row, o) => {
    const rp = pos + 1 + o;
    rows.push(rp);
    const cs: number[] = [];
    row.forEach((_c, co) => cs.push(rp + 1 + co + 1));
    cells.push(cs);
  });
  return { pos, node, rows, cells };
}

describe('the rows of a table above its page notes', () => {
  it('moves a row that would run under the notes whole to the next page', () => {
    // Two lines of writing (its reference's note on page 0), then a one-line row and a two-line row: the second
    // row reaches line 4 (bottom 100), under the notes' top (70).
    const blocks = [para('a', 15, 5), table('t', [[text(3)], [text(15)]])];
    const { view, settle, underNotes } = setUp(blocks);
    const t = tableAt(view.state.doc, 't');
    const { breaks, limits, settled } = settle();
    expect(breaks).toEqual([{ page: 0, pos: t.rows[1], block: true }]);
    expect(underNotes(limits)).toEqual([]);
    expect(settled).toBe(true);
  });

  it('takes the table with it at its first row under a header row, never leaving the header alone', () => {
    const blocks = [para('a', 15, 5), table('t', [[text(3)], [text(15)]], true)];
    const { view, settle, underNotes } = setUp(blocks);
    const t = tableAt(view.state.doc, 't');
    const { breaks, limits } = settle();
    expect(breaks).toEqual([{ page: 0, pos: t.pos, block: true }]);
    expect(underNotes(limits)).toEqual([]);
  });

  it('splits a row that starts its page in every cell that runs under the notes', () => {
    // One row at the page's top: a five-line cell with the reference, a three-line cell and another five-line one.
    const blocks = [table('t', [[text(45, 3), text(25), text(45)]])];
    const { view, settle, underNotes, placeOf } = setUp(blocks);
    const t = tableAt(view.state.doc, 't');
    const [a, b, c] = t.cells[0]!;
    const { breaks, drawn, limits, settled } = settle();
    // Each tall cell ends after its third line (bottom 60), above the notes' top (70); the short one is whole.
    expect(breaks).toEqual([{ page: 0, pos: a! + 30, block: false, also: [c! + 30] }]);
    expect(underNotes(limits)).toEqual([]);
    expect(settled).toBe(true);
    expect(placeOf(a! + 30)).toEqual({ col: 1, line: 0, step: 0 });
    expect(placeOf(b! + 25).col).toBe(0);
    expect(drawn.map((d) => d.index)).toEqual([0]);
    // Drawn as a break in each of the two cells.
    expect(view.dom.querySelectorAll('.article-foot-break')).toHaveLength(2);
  });

  it('splits a row that starts its page under its repeated header row', () => {
    // A header row and a row filling page 0; a tall row with the reference starts page 1.
    const blocks = [
      table(
        't',
        [
          [text(5), text(5)],
          [text(35), text(5)],
          [text(45, 2), text(45)],
        ],
        true,
      ),
    ];
    const { view, settle, underNotes } = setUp(blocks);
    const t = tableAt(view.state.doc, 't');
    const [a, b] = t.cells[2]!;
    const { breaks, limits, drawn } = settle();
    expect(drawn.map((d) => d.index)).toEqual([1]);
    expect(breaks).toEqual([{ page: 1, pos: a! + 30, block: false, also: [b! + 30] }]);
    expect(underNotes(limits)).toEqual([]);
  });

  it('keeps no row under the notes for rows of any length', () => {
    for (let lines = 1; lines <= 12; lines++) {
      const blocks = [
        para('a', 15, 5),
        table(
          't',
          [
            [text(5), text(5)],
            [text(lines * PER_LINE - 1), text(7)],
            [text(9), text(9)],
          ],
          true,
        ),
        para('b', 30),
      ];
      const { settle, underNotes } = setUp(blocks);
      const { limits, settled } = settle();
      expect(underNotes(limits), `${lines} lines`).toEqual([]);
      expect(settled, `${lines} lines`).toBe(true);
    }
  });

  it('gives a split row back to its page when the notes go, and lays out as before', () => {
    const blocks = [table('t', [[text(45, 3), text(45, 4)]]), para('b', 5)];
    const { view, settle } = setUp(blocks);
    expect(settle().breaks).toHaveLength(1);
    const t = tableAt(view.state.doc, 't');
    const [a] = t.cells[0]!;
    // The first cell's reference deleted: the page still has one note, so the same cut holds.
    view.dispatch(view.state.tr.delete(a! + 3, a! + 4));
    const one = settle();
    expect(one.breaks.length).toBe(1);
    expect(one.settled).toBe(true);
  });

  it('sets no break for a document without footnotes, so its pages and exports stay as they were', () => {
    const blocks = [
      para('a', 30),
      table(
        't',
        [
          [text(45), text(45)],
          [text(60), text(5)],
        ],
        true,
      ),
    ];
    const { view, settle } = setUp(blocks);
    const dispatch = vi.spyOn(view, 'dispatch');
    expect(settle()).toMatchObject({ breaks: [], drawn: [], settled: true });
    expect(dispatch).not.toHaveBeenCalled();
    expect(
      view.dom.querySelectorAll('.article-foot-break, .article-foot-break-before'),
    ).toHaveLength(0);
  });

  it('takes a break before a moved row back once the whole row fits, never only its first line', () => {
    const blocks = [para('a', 15, 5), table('t', [[text(3)], [text(15)]])];
    const { view, settle } = setUp(blocks);
    const t = tableAt(view.state.doc, 't');
    expect(settle().breaks).toEqual([{ page: 0, pos: t.rows[1], block: true }]);
    // The reference deleted: no notes anywhere, the break goes.
    view.dispatch(view.state.tr.delete(6, 7));
    expect(settle().breaks).toEqual([]);
  });

  it('gives a moved row back to its page once the notes shrink and the whole row fits', () => {
    // A line with two references (notes 50 px: the text ends at 50), a one-line row and another one-line row at
    // line 2 (bottom 60): it moves; with one note (the text ends at 70) it fits back.
    const two: ArticleBlock = {
      id: 'a',
      type: 'paragraph',
      runs: [
        { text: 'xx' },
        { text: '*', fn: 'One' },
        { text: 'x' },
        { text: '*', fn: 'Two' },
        { text: 'x' },
      ],
    };
    const { view, settle, underNotes } = setUp([two, table('t', [[text(3)], [text(3)]])]);
    const t = tableAt(view.state.doc, 't');
    expect(settle().breaks).toEqual([{ page: 0, pos: t.rows[1], block: true }]);
    view.dispatch(view.state.tr.delete(3, 4));
    const after = settle();
    expect(after.breaks).toEqual([]);
    expect(underNotes(after.limits)).toEqual([]);
  });

  it('lays out a long article of tables and notes cheaply', () => {
    const blocks: ArticleBlock[] = [];
    for (let i = 0; i < 40; i++) {
      blocks.push(para(`p${i}`, 25, 4));
      blocks.push(
        table(
          `t${i}`,
          [
            [text(5), text(5)],
            [text(25, 3), text(15)],
            [text(45), text(45)],
            [text(9), text(9)],
          ],
          true,
        ),
      );
    }
    const { settle, underNotes } = setUp(blocks);
    let laid: ReturnType<typeof settle> | null = null;
    const ms = cpuMsOf(() => {
      laid = settle();
    });
    expect(underNotes(laid!.limits)).toEqual([]);
    expect(ms).toBeLessThan(cpuBudgetMs(1500));
    expect(laid!.settled).toBe(true);
    // A pass once settled (each edit's, typing that moves no line): no break moves.
    let again: ReturnType<typeof settle> | null = null;
    const once = cpuMsOf(() => {
      again = settle();
    });
    expect(again!.breaks).toEqual(laid!.breaks);
    expect(once).toBeLessThan(cpuBudgetMs(50));
  });
});

describe('the table pieces', () => {
  const doc = blocksToDoc([
    para('a', 5),
    table(
      't',
      [
        [text(3), text(3)],
        [text(3), text(3)],
        [text(3), text(3)],
      ],
      true,
    ),
    para('b', 5),
    table('u', [[text(3)], [text(3)]]),
  ]);
  const t = tableAt(doc, 't');
  const u = tableAt(doc, 'u');
  it('finds the table at a place, or just before the block holding it', () => {
    expect(tableNear(doc, t.cells[1]![0]! + 1)).toBe(t.pos);
    expect(tableNear(doc, t.pos + t.node.nodeSize + 2)).toBe(t.pos);
    expect(tableNear(doc, t.pos + t.node.nodeSize)).toBe(t.pos);
    expect(tableNear(doc, 2)).toBeNull();
    expect(tableNear(doc, doc.content.size)).toBe(u.pos);
  });
  it('moves the table at its first row, and at its second under a header row', () => {
    expect(hasHeader(t.node)).toBe(true);
    expect(hasHeader(u.node)).toBe(false);
    expect(wholeRowAt(t.node, t.pos, 0)).toBe(t.pos);
    expect(wholeRowAt(t.node, t.pos, 1)).toBe(t.pos);
    expect(wholeRowAt(t.node, t.pos, 2)).toBe(t.rows[2]);
    expect(wholeRowAt(u.node, u.pos, 1)).toBe(u.rows[1]);
  });
  it('leaves a cut to the writing when no row of a table there runs past the limit', () => {
    const read = { lineAt: () => ({ col: 0, top: 0, bottom: 10 }), lineBefore: () => null };
    expect(tableCut(doc, read, 0, 50, t.cells[0]![0]!)).toBeNull();
    expect(tableCut(doc, read, 0, 50, t.pos + t.node.nodeSize + 2)).toBeUndefined();
    expect(tableCut(doc, read, 0, 50, 2)).toBeUndefined();
  });
  it('keeps nothing of a row whose every cell starts past the limit', () => {
    const read = { lineAt: () => ({ col: 0, top: 60, bottom: 80 }), lineBefore: () => null };
    expect(splitRow(read, t.node.child(1), t.rows[1]!, 0, 50)).toBeUndefined();
  });
});

describe('a split row through a change', () => {
  it('keeps a cell cut while its cell is unchanged and drops it when its cell is typed in', () => {
    const blocks = [table('t', [[text(45, 3), text(45)]]), para('b', 5)];
    const view = new EditorView(document.createElement('div'), {
      state: EditorState.create({ doc: blocksToDoc(blocks), plugins: [footnotesPlugin(() => {})] }),
    });
    views.push(view);
    const t = tableAt(view.state.doc, 't');
    const [a, b] = t.cells[0]!;
    setFootBreaks(view, [{ page: 0, pos: a! + 30, block: false, also: [b! + 30] }]);
    // Typing in the paragraph after: both cuts move with the writing.
    const end = view.state.doc.content.size - 1;
    view.dispatch(view.state.tr.insertText('y', end));
    expect(footnoteKey.getState(view.state)!.breaks).toEqual([
      { page: 0, pos: a! + 30, block: false, also: [b! + 30] },
    ]);
    // Typing in the second cell: its cut goes (its lines wrap anew), the first cell's stays.
    view.dispatch(view.state.tr.insertText('y', b! + 2));
    expect(footnoteKey.getState(view.state)!.breaks).toEqual([
      { page: 0, pos: a! + 30, block: false, also: [] },
    ]);
  });
});
