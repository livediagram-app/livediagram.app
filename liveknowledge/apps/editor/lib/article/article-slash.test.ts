// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EditorState, TextSelection } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import type { ArticleBlock } from '@liveknowledge/document';
import { blocksToDoc } from './article-convert';
import { removeSlashQuery, slashKey, slashPlugin, type SlashBridge } from './article-slash';

// docs/specs/030-knowledgebase/page-surface.md "The slash menu", "Keys": while open the menu takes Up, Down, Enter,
// Tab and Shift+Tab (its groups) and Escape; every other key is the writing's.
const views: EditorView[] = [];
afterEach(() => views.splice(0).forEach((v) => v.destroy()));

function open() {
  const bridge: SlashBridge & { onKey: ReturnType<typeof vi.fn> } = {
    onChange: vi.fn(),
    onKey: vi.fn(() => true),
  };
  const blocks = [{ id: 'a', type: 'paragraph', runs: [{ text: '' }] }] as ArticleBlock[];
  const view = new EditorView(document.createElement('div'), {
    state: EditorState.create({ doc: blocksToDoc(blocks), plugins: [slashPlugin(bridge)] }),
  });
  views.push(view);
  view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, 1)));
  view.dispatch(view.state.tr.insertText('/'));
  view.dispatch(view.state.tr.insertText('ta'));
  return { view, bridge };
}

const press = (view: EditorView, key: string, shiftKey = false) =>
  view.someProp('handleKeyDown', (f) => f(view, new KeyboardEvent('keydown', { key, shiftKey }))) ??
  false;

describe('the slash menu’s keys', () => {
  it('opens on a typed `/` with what follows as its query', () => {
    const { view, bridge } = open();
    expect(slashKey.getState(view.state)).toEqual({ active: true, from: 1, query: 'ta' });
    expect(bridge.onChange).toHaveBeenCalled();
  });

  it('hands the menu its moves: arrows, Enter, Tab and Shift+Tab between groups', () => {
    const { view, bridge } = open();
    for (const [key, shift, sent] of [
      ['ArrowDown', false, 'down'],
      ['ArrowUp', false, 'up'],
      ['Enter', false, 'enter'],
      ['Tab', false, 'next-group'],
      ['Tab', true, 'prev-group'],
    ] as const) {
      expect(press(view, key, shift)).toBe(true);
      expect(bridge.onKey).toHaveBeenLastCalledWith(sent);
    }
    expect(press(view, 'a')).toBe(false);
  });

  it('closes on Escape, and takes no key once closed', () => {
    const { view, bridge } = open();
    expect(press(view, 'Escape')).toBe(true);
    expect(slashKey.getState(view.state)?.active).toBe(false);
    bridge.onKey.mockClear();
    expect(press(view, 'Tab')).toBe(false);
    expect(bridge.onKey).not.toHaveBeenCalled();
  });

  it('takes the `/` and its query out of the block when an entry is chosen', () => {
    const { view } = open();
    removeSlashQuery(view);
    expect(view.state.doc.textContent).toBe('');
    expect(slashKey.getState(view.state)?.active).toBe(false);
  });
});
