import { describe, expect, it } from 'vitest';
import { EditorState, TextSelection } from 'prosemirror-state';
import { CellSelection } from 'prosemirror-tables';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import {
  articleFromMarkdown,
  articleWordCount,
  newArticleTable,
  type ArticleBlock,
  type ArticleFlow,
} from '@livedocuments/document';
import { blocksToDoc } from './article-convert';
import { articleSchema as S } from './article-schema';
import { articleCountsOf, wordCountLabel } from './article-word-count';

// docs/specs/007-editor/article-pages.md "Word Count": the caret's article, and the selection beside it, counted as
// agents' page summaries count them.

// The article Markdown reads as (a flow, never a refusal: these name no zones).
const md = (text: string): ArticleFlow => {
  const read = articleFromMarkdown(text);
  if (!('blocks' in read)) throw new Error('refused');
  return read;
};
const stateOf = (blocks: ArticleBlock[]) => EditorState.create({ doc: blocksToDoc(blocks) });
const select = (state: EditorState, from: number, to: number) =>
  state.apply(state.tr.setSelection(TextSelection.create(state.doc, from, to)));
// Where `text` starts in the doc's text (the first match), as a position.
const posOf = (state: EditorState, text: string): number => {
  let found = -1;
  state.doc.descendants((node, pos) => {
    if (found >= 0) return false;
    if (node.isText) {
      const i = node.text!.indexOf(text);
      if (i >= 0) found = pos + i;
    }
    return true;
  });
  if (found < 0) throw new Error(`no "${text}"`);
  return found;
};

describe('articleCountsOf', () => {
  it('counts the whole article as the page summaries do, with nothing selected', () => {
    const flow = md(
      '# A title\n\nOne two three[^1] four.\n\n| cell one | two |\n|---|---|\n| three | |\n\n```\ncode words\n```\n\n[^1]: the note text',
    );
    const counts = articleCountsOf(stateOf(flow.blocks));
    expect(counts).toEqual({ total: articleWordCount(flow), selected: null });
    // Title 2, paragraph 4 plus the note's 3, the table's 4, the code's 2: the marker is no word.
    expect(counts.total).toBe(15);
  });

  it("counts a selection's words beside the total", () => {
    const state = stateOf(md('Alpha beta gamma delta.\n\nEpsilon zeta.').blocks);
    const from = posOf(state, 'beta');
    const counts = articleCountsOf(select(state, from, from + 'beta gamma'.length));
    expect(counts).toEqual({ total: 6, selected: 2 });
    // Across two blocks: the words in each part.
    const across = articleCountsOf(select(state, posOf(state, 'delta'), posOf(state, 'zeta') + 2));
    expect(across.selected).toBe(3);
  });

  it("counts a footnote's note text but never its marker", () => {
    const state = stateOf(md('Alpha[^1] beta.\n\n[^1]: gamma delta').blocks);
    const from = posOf(state, 'Alpha');
    const to = posOf(state, 'beta') + 'beta.'.length;
    expect(articleCountsOf(select(state, from, to))).toEqual({ total: 4, selected: 4 });
  });

  it('counts only the cells a cell selection holds', () => {
    const table = newArticleTable('t', 2, 2, false);
    const words = ['one two', 'three', 'four five six', 'seven'];
    const t = {
      ...table,
      rows: table.rows.map((r, i) => ({
        ...r,
        cells: r.cells.map((_, j) => [{ text: words[i * 2 + j]! }]),
      })),
    };
    const state = stateOf([{ id: 'p', type: 'paragraph', runs: [{ text: 'Lead in' }] }, t]);
    // The cells of the first column: "one two" and "four five six".
    const cells: number[] = [];
    state.doc.descendants((node, pos) => {
      if (node.type === S.nodes.table_cell) cells.push(pos);
      return true;
    });
    const sel = state.apply(
      state.tr.setSelection(CellSelection.create(state.doc, cells[0]!, cells[2])),
    );
    expect(articleCountsOf(sel)).toEqual({ total: 9, selected: 5 });
  });

  it('counts a long article well inside a frame', () => {
    const line = 'word '.repeat(50).trim();
    const blocks: ArticleBlock[] = Array.from({ length: 2000 }, (_, i) => ({
      id: `b${i}`,
      type: 'paragraph',
      runs: [{ text: line }],
    }));
    const state = stateOf(blocks);
    let total = 0;
    const spent = cpuMsOf(() => {
      total = articleCountsOf(state).total;
    });
    expect(total).toBe(100_000);
    expect(spent).toBeLessThan(cpuBudgetMs(60));
    // The selection moving over the same writing counts only the selection.
    const moved = select(state, 1, 20);
    let selected: number | null = null;
    const again = cpuMsOf(() => {
      selected = articleCountsOf(moved).selected;
    });
    expect(selected).toBe(4);
    expect(again).toBeLessThan(cpuBudgetMs(5));
  });
});

describe('wordCountLabel', () => {
  it('names one word, many, and a selection of the total', () => {
    expect(wordCountLabel({ total: 1, selected: null })).toBe('1 word');
    expect(wordCountLabel({ total: 0, selected: null })).toBe('0 words');
    expect(wordCountLabel({ total: 840, selected: null })).toBe('840 words');
    expect(wordCountLabel({ total: 840, selected: 12 })).toBe('12 of 840 words');
    expect(wordCountLabel({ total: 12345, selected: 1234 })).toBe('1,234 of 12,345 words');
  });
});
