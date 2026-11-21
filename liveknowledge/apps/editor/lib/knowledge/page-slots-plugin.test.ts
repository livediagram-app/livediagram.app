// @vitest-environment jsdom
import { EditorState } from 'prosemirror-state';
import { describe, expect, it } from 'vitest';
import { blocksToDoc } from '@/lib/article/article-convert';
import { createPageSlots } from './page-slots-plugin';

// The meta row's and Linked From's room in the writing (docs/specs/030-knowledgebase/blueprints/knowledge-ui.md).
const para = (id: string, style: string, text: string) =>
  ({ id, type: 'paragraph', style, runs: text ? [{ text }] : [] }) as never;

function stateOf(blocks: never[]) {
  const slots = createPageSlots();
  const state = EditorState.create({ doc: blocksToDoc(blocks), plugins: [slots.plugin] });
  return { slots, state };
}
const places = (slots: ReturnType<typeof createPageSlots>, state: EditorState) =>
  slots.plugin
    .getState(state)!
    .find()
    .map((d) => [(d.spec as { key: string }).key, d.from]);

describe('the page slots', () => {
  it('puts the icon over the Title, the meta row under it and the foot after the last block', () => {
    const { slots, state } = stateOf([para('t', 'title', 'Release'), para('b', 'body', 'Words')]);
    const title = state.doc.firstChild!.nodeSize;
    expect(places(slots, state)).toEqual(
      expect.arrayContaining([
        ['head', 0],
        ['meta', title],
        ['foot', state.doc.content.size],
      ]),
    );
    expect(slots.meta.contentEditable).toBe('false');
    expect(slots.meta.dataset.pageSlot).toBe('meta');
    expect(slots.head.dataset.pageSlot).toBe('head');
    expect(slots.head.contentEditable).toBe('false');
  });

  it('has no icon or meta row on writing that does not start with a Title', () => {
    const { slots, state } = stateOf([para('b', 'body', 'Words')]);
    expect(places(slots, state)).toEqual([['foot', state.doc.content.size]]);
  });

  it('follows the writing as it is typed, and keeps the same set when nothing changed', () => {
    const { slots, state } = stateOf([para('t', 'title', 'Release'), para('b', 'body', 'Words')]);
    const typed = state.apply(state.tr.insertText('s', 8));
    expect(places(slots, typed)).toEqual(
      expect.arrayContaining([
        ['meta', typed.doc.firstChild!.nodeSize],
        ['foot', typed.doc.content.size],
      ]),
    );
    const moved = typed.apply(typed.tr.setMeta('x', 1));
    expect(slots.plugin.getState(moved)).toBe(slots.plugin.getState(typed));
  });
});
