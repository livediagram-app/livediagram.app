import { describe, expect, it } from 'vitest';
import { EditorState, TextSelection } from 'prosemirror-state';
import type { ArticleBlock } from '@livedocuments/document';
import { blocksToDoc, docToBlocks } from './article-convert';
import { replaceContentTr } from './article-replace';

const run = (text: string) => (text ? [{ text }] : []);
const table = (a: string, b: string): ArticleBlock => ({
  id: 't1',
  type: 'table',
  cols: [
    { id: 'c1', w: 1 },
    { id: 'c2', w: 1 },
  ],
  rows: [
    { id: 'r1', cells: [run(a), run(b)] },
    { id: 'r2', cells: [run(''), run('')] },
  ],
});
const para = (id: string, text: string): ArticleBlock => ({
  id,
  type: 'paragraph',
  runs: run(text),
});
const stateOf = (blocks: ArticleBlock[]) => EditorState.create({ doc: blocksToDoc(blocks) });

describe('replaceContentTr', () => {
  it('returns null when nothing differs', () => {
    expect(replaceContentTr(stateOf([para('p1', 'hi')]), [para('p1', 'hi')], false)).toBeNull();
  });

  it('fills two cells of a table (a redo of typing in both) without adding a column', () => {
    const tr = replaceContentTr(stateOf([table('', '')]), [table('cell1', 'cell2')], true)!;
    const [t] = docToBlocks(tr.doc);
    expect(t).toMatchObject({ type: 'table' });
    const rows = (t as Extract<ArticleBlock, { type: 'table' }>).rows;
    expect(rows.map((r) => r.cells.length)).toEqual([2, 2]);
    expect(rows[0]!.cells.map((c) => c.map((r) => r.text).join(''))).toEqual(['cell1', 'cell2']);
    expect(tr.getMeta('addToHistory')).toBe(false);
    expect(tr.getMeta('article-remote')).toBe(true);
  });

  it('empties two cells of a table (the undo) without adding a column', () => {
    const tr = replaceContentTr(stateOf([table('cell1', 'cell2')]), [table('', '')], false)!;
    const rows = (docToBlocks(tr.doc)[0] as Extract<ArticleBlock, { type: 'table' }>).rows;
    expect(rows.map((r) => r.cells.length)).toEqual([2, 2]);
  });

  it("keeps a caret in the block a peer types in, past the peer's change", () => {
    let state = stateOf([para('p1', 'hello world')]);
    state = state.apply(state.tr.setSelection(TextSelection.create(state.doc, 10)));
    const tr = replaceContentTr(state, [para('p1', 'Xhello world')], false)!;
    const next = state.apply(tr);
    expect(next.selection.from).toBe(11);
    expect(next.doc.textContent).toBe('Xhello world');
  });

  it('changes across two paragraphs and puts the caret at the end of the change', () => {
    const tr = replaceContentTr(
      stateOf([para('p1', 'one'), para('p2', 'two')]),
      [para('p1', 'one!'), para('p2', 'two!')],
      true,
    )!;
    expect(
      docToBlocks(tr.doc).map((b) => (b as { runs: { text: string }[] }).runs[0]!.text),
    ).toEqual(['one!', 'two!']);
    expect(tr.selection.from).toBe(tr.doc.child(0).nodeSize + 5);
  });
});
