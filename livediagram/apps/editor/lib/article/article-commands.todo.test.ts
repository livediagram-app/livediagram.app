import { describe, expect, it } from 'vitest';
import { EditorState, TextSelection } from 'prosemirror-state';
import type { ArticleBlock } from '@livediagram/document';
import { blocksToDoc, docToBlocks } from './article-convert';
import { toggleTodoChecked } from './article-commands';

// docs/specs/007-editor/article-pages.md "Writing": ⌘Enter ticks or unticks the to-do at the caret.
const blocks: ArticleBlock[] = [
  { id: 'p', type: 'paragraph', runs: [{ text: 'Plain' }] },
  { id: 't1', type: 'list', list: 'todo', runs: [{ text: 'One' }] },
  { id: 't2', type: 'list', list: 'todo', checked: true, runs: [{ text: 'Two' }] },
];

const stateAt = (from: number, to = from) => {
  const doc = blocksToDoc(blocks);
  return EditorState.create({ doc, selection: TextSelection.create(doc, from, to) });
};
const run = (state: EditorState) => {
  let next = state;
  const ok = toggleTodoChecked(state, (tr) => (next = state.apply(tr)));
  return { ok, blocks: docToBlocks(next.doc, blocks) };
};
const checked = (bs: ArticleBlock[], id: string) =>
  (bs.find((b) => b.id === id) as { checked?: boolean }).checked === true;

describe('ticking a to-do from the keyboard', () => {
  it('ticks the to-do at the caret, and unticks it again', () => {
    const doc = blocksToDoc(blocks);
    const inOne = doc.child(0).nodeSize + 2;
    const once = run(stateAt(inOne));
    expect(once.ok).toBe(true);
    expect(checked(once.blocks, 't1')).toBe(true);
    const inTwo = doc.child(0).nodeSize + doc.child(1).nodeSize + 2;
    expect(checked(run(stateAt(inTwo)).blocks, 't2')).toBe(false);
  });

  it('ticks every selected to-do unless all already are', () => {
    const doc = blocksToDoc(blocks);
    const out = run(stateAt(doc.child(0).nodeSize + 2, doc.content.size - 1));
    expect(checked(out.blocks, 't1')).toBe(true);
    expect(checked(out.blocks, 't2')).toBe(true);
  });

  it('lets the key fall through away from a to-do', () => {
    expect(toggleTodoChecked(stateAt(2))).toBe(false);
  });
});
