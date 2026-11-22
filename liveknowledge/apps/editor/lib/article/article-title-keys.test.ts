import { describe, expect, it } from 'vitest';
import { EditorState, TextSelection, type Transaction } from 'prosemirror-state';
import type { ArticleBlock } from '@liveknowledge/document';
import { blocksToDoc } from './article-convert';
import { selectAll, tab } from './article-key-commands';

// docs/specs/030-knowledgebase/editing.md "The Title and the writing": select all keeps to the box the caret is in,
// and Tab leaves the Title for the writing.

const block = (id: string, style: string, text: string): ArticleBlock =>
  ({ id, type: 'paragraph', style, runs: text ? [{ text }] : [] }) as ArticleBlock;

const stateAt = (blocks: ArticleBlock[], pos: number) => {
  const doc = blocksToDoc(blocks);
  return EditorState.create({ doc, selection: TextSelection.create(doc, pos) });
};
const run = (cmd: typeof selectAll, state: EditorState) => {
  let tr: Transaction | undefined;
  cmd(state, (t) => (tr = t));
  return tr!;
};

const page = [block('t', 'title', 'Runbook'), block('b', 'body', 'Step one')];

describe('the Title and the writing', () => {
  it('select all in the Title takes the Title alone', () => {
    const sel = run(selectAll, stateAt(page, 2)).selection;
    expect(sel.$from.parent.textContent).toBe('Runbook');
    expect(sel.$to.parent.textContent).toBe('Runbook');
    expect(sel.from).toBe(1);
  });

  it('select all in the writing takes the writing, never the Title', () => {
    const state = stateAt(page, 12);
    const sel = run(selectAll, state).selection;
    expect(state.doc.textBetween(sel.from, sel.to)).toBe('Step one');
  });

  it('Tab in the Title goes to the start of the writing', () => {
    const tr = run(tab, stateAt(page, 3));
    expect(tr.selection.$from.parent.textContent).toBe('Step one');
    expect(tr.selection.$from.parentOffset).toBe(0);
  });

  it('Tab in the Title of a page with no writing makes a line to write on', () => {
    const tr = run(tab, stateAt([block('t', 'title', 'Runbook')], 3));
    expect(tr.doc.childCount).toBe(2);
    expect(tr.selection.$from.parent.attrs.style).toBe('body');
  });
});
