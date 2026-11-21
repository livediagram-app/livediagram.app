import { describe, expect, it } from 'vitest';
import { EditorState, TextSelection } from 'prosemirror-state';
import { PARAGRAPH, S } from './article-block-commands';
import { keepTitlePlugin } from './keep-title-plugin';
import { backspaceAtStart } from './article-key-commands';

const doc = () =>
  S.nodes.doc.create(null, [
    PARAGRAPH.create({ id: 't', style: 'title' }, S.text('Onboarding')),
    PARAGRAPH.create({ id: 'b', style: 'body' }, S.text('Welcome')),
  ]);
const state = () => EditorState.create({ doc: doc(), plugins: [keepTitlePlugin()] });
const first = (s: EditorState) => s.doc.firstChild!;

describe('the Title stays', () => {
  it('Backspace at its start keeps it a Title', () => {
    let s = state();
    s = s.apply(s.tr.setSelection(TextSelection.create(s.doc, 1)));
    let next = s;
    expect(backspaceAtStart(s, (tr) => (next = s.apply(tr)))).toBe(true);
    expect(first(next).attrs.style).toBe('title');
    expect(first(next).textContent).toBe('Onboarding');
  });

  it('a change that drops its style gives it back', () => {
    const s = state();
    const next = s.apply(s.tr.setNodeMarkup(0, undefined, { ...first(s).attrs, style: 'body' }));
    expect(first(next).attrs.style).toBe('title');
    expect(first(next).textContent).toBe('Onboarding');
  });

  it('a change that removes the block puts an empty Title back in front', () => {
    const s = state();
    const next = s.apply(s.tr.delete(0, first(s).nodeSize));
    expect(first(next).attrs.style).toBe('title');
    expect(first(next).textContent).toBe('');
    expect(next.doc.child(1).textContent).toBe('Welcome');
  });
});
