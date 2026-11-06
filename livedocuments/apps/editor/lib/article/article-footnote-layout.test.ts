// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EditorState } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import type { ArticleBlock, LaidOutPage } from '@livedocuments/document';
import { newArticleTable } from '@livedocuments/document';
import { blocksToDoc } from './article-convert';
import { flowFrame } from './article-flow-geometry';
import { footnoteKey, footnotesPlugin, setFootBreaks, type FootBreak } from './article-footnotes';
import type { FootnoteNotes, NotePage } from './article-footnote-notes';
import {
  breakAt,
  fitsAfter,
  footCut,
  FOOTNOTE_MAX_SHARE,
  layoutFootnotes,
  notesHeight,
} from './article-footnote-layout';

// docs/specs/007-editor/article-pages.md "Footnotes": a page's notes at its foot, its text ending above them, a
// reference that would sit under its own note going on with its line.
describe('footCut', () => {
  const tall = (j: number) => 10 + 20 * j;
  it('keeps every note when the last reference ends above them', () => {
    expect(footCut(2, 200, tall, (_j, limit) => limit >= 100)).toEqual({ keep: 2, limit: 150 });
  });
  it('sends on a reference whose line would sit under its own note', () => {
    // Reference 2 ends at 160: above the foot with one note (170), under it with two (150).
    const ends = [100, 160];
    expect(footCut(2, 200, tall, (j, limit) => ends[j - 1]! <= limit)).toEqual({
      keep: 1,
      limit: 170,
    });
    expect(footCut(1, 200, tall, () => false)).toEqual({ keep: 0, limit: 200 });
  });
  it('gives the notes at most two thirds of the page', () => {
    expect(notesHeight(300, 1000)).toBe(300 * FOOTNOTE_MAX_SHARE);
    expect(
      footCut(
        1,
        300,
        () => 1000,
        () => true,
      ).limit,
    ).toBeCloseTo(100);
  });
});

describe('fitsAfter', () => {
  it('fits the next line when it ends above the foot, with the margin a block break left out', () => {
    expect(fitsAfter(100, 0, 20, 130)).toBe(true);
    expect(fitsAfter(100, 12, 20, 130)).toBe(false);
    expect(fitsAfter(100, 0, 20, 121)).toBe(false);
  });
});

describe('breakAt', () => {
  const doc = blocksToDoc([
    { id: 'a', type: 'paragraph', runs: [{ text: 'Hello world' }] },
    newArticleTable('t', 2, 3, true),
  ]);
  it("breaks inside a block's lines, or before the block at its start", () => {
    expect(breakAt(doc, 0, 5)).toEqual({ page: 0, pos: 5, block: false });
    expect(breakAt(doc, 0, 1)).toEqual({ page: 0, pos: 0, block: true });
    expect(breakAt(doc, 0, 13)).toEqual({ page: 0, pos: 13, block: true });
  });
  it('breaks a table before a row, or before the table at its first row', () => {
    const table = 13;
    const firstRow = table + 1;
    const secondRow = firstRow + doc.nodeAt(firstRow)!.nodeSize;
    expect(breakAt(doc, 1, firstRow + 2)).toEqual({ page: 1, pos: table, block: true });
    expect(breakAt(doc, 1, secondRow + 2)).toEqual({ page: 1, pos: secondRow, block: true });
  });
});

// A layout the tests can reason about: every place in the writing is one step along a line of 10, five lines (of 20
// px) a page, a break starting the next page at its place.
const PER_LINE = 10;
const LINE = 20;
const LINES = 5;
const pages = [0, 1, 2, 3].map(
  (i) =>
    ({
      id: `p${i}`,
      flow: 'f',
      rect: { x: i * 300, y: 0, width: 260, height: 160 },
    }) as LaidOutPage,
);
const frame = flowFrame(pages, 30, 30);

function simulate(view: EditorView) {
  const breaks = new Set(
    (footnoteKey.getState(view.state)?.breaks ?? []).map((b: FootBreak) => b.pos),
  );
  const at = new Map<number, { col: number; line: number; step: number }>();
  let col = 0;
  let line = 0;
  let step = 0;
  for (let pos = 0; pos <= view.state.doc.content.size; pos++) {
    if (breaks.has(pos) && (line > 0 || step > 0)) {
      col++;
      line = 0;
      step = 0;
    }
    at.set(pos, { col, line, step });
    if (++step === PER_LINE) {
      step = 0;
      if (++line === LINES) {
        line = 0;
        col++;
      }
    }
  }
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
  view.coordsAtPos = (pos: number) => {
    const p = simulate(view).get(pos)!;
    const left = p.col * frame.stride + p.step;
    return { left, right: left + 1, top: p.line * LINE, bottom: (p.line + 1) * LINE };
  };
  let drawn: readonly NotePage[] = [];
  const notes = {
    setVars: vi.fn(),
    editing: () => null,
    // A note's height: 20, under a rule of 10.
    heightsOf: (texts: readonly string[]) => ({ head: 10, notes: texts.map(() => 20) }),
    render: (p: readonly NotePage[]) => {
      drawn = p;
    },
  } as unknown as FootnoteNotes;
  const root = { left: 0, top: 0 } as DOMRect;
  const settle = () => {
    for (let i = 0; i < 6; i++)
      if (!layoutFootnotes(view, { frame, root, z: 1, pages, notes }).changed) break;
    return { breaks: footnoteKey.getState(view.state)!.breaks, drawn };
  };
  return { view, settle };
}

// One paragraph whose text fills `lines` lines, a reference after `refAt` characters.
const para = (id: string, length: number, refAt?: number, note = 'Note') => ({
  id,
  type: 'paragraph' as const,
  runs:
    refAt === undefined
      ? [{ text: 'x'.repeat(length) }]
      : [
          { text: 'x'.repeat(refAt) },
          { text: '*', fn: note },
          { text: 'x'.repeat(length - refAt - 1) },
        ],
});

describe('layoutFootnotes', () => {
  it('draws nothing and sets no break without references', () => {
    const { settle } = setUp([para('a', 120)]);
    expect(settle()).toEqual({ breaks: [], drawn: [] });
  });

  it("ends a page's text above its notes, the note drawn at its foot", () => {
    // 100 text height; one note takes 30, so the page's text ends after its third line (60).
    const { settle } = setUp([para('a', 120, 5)]);
    const { breaks, drawn } = settle();
    expect(breaks).toEqual([{ page: 0, pos: 30, block: false }]);
    expect(drawn).toEqual([
      {
        index: 0,
        x: 30,
        bottom: frame.top + frame.height,
        width: frame.columnWidth,
        maxHeight: frame.height * FOOTNOTE_MAX_SHARE,
        notes: [{ n: 1, text: 'Note' }],
      },
    ]);
  });

  it('sends a reference on with its line when its note would cover it', () => {
    // The reference is on the fourth line (ending at 80): with its note the text must end at 70.
    const { settle } = setUp([para('a', 120, 33)]);
    const { breaks, drawn } = settle();
    // Page 0 ends before the fourth line; the reference starts page 1, its note there.
    expect(breaks).toEqual([
      { page: 0, pos: 30, block: false },
      { page: 1, pos: 60, block: false },
    ]);
    expect(drawn.map((d) => [d.index, d.notes.map((n) => n.n)])).toEqual([[1, [1]]]);
  });

  it('takes a break away when the page needs it no more', () => {
    const { view, settle } = setUp([para('a', 120, 5)]);
    expect(settle().breaks).toHaveLength(1);
    // The reference deleted: no notes, and the line after the break fits again.
    view.dispatch(view.state.tr.delete(6, 7));
    expect(settle()).toEqual({ breaks: [], drawn: [] });
  });

  it('clears breaks left over when the last reference goes', () => {
    const { view, settle } = setUp([para('a', 30)]);
    setFootBreaks(view, [{ page: 0, pos: 10, block: false }]);
    expect(settle().breaks).toEqual([]);
  });

  it('takes away a break before a block once that block fits above the notes', () => {
    const { view, settle } = setUp([para('a', 15, 5), para('b', 10)]);
    setFootBreaks(view, [{ page: 0, pos: 17, block: true }]);
    expect(settle().breaks).toEqual([]);
  });

  it('moves a break later when the line after it fits again', () => {
    const { view, settle } = setUp([para('a', 120, 5)]);
    setFootBreaks(view, [{ page: 0, pos: 20, block: false }]);
    expect(settle().breaks).toEqual([{ page: 0, pos: 30, block: false }]);
  });
});
