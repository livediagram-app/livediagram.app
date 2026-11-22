// @vitest-environment jsdom
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { opensEditOnDoubleClick, useDoubleClickToEdit } from './useDoubleClickToEdit';
import { PageEditBarView } from './PageEditBar';

vi.mock('./mode-flash', () => ({ ringAt: vi.fn() }));
// The floating corner follows the document area's size (useArticleZoneCorner).
vi.stubGlobal(
  'ResizeObserver',
  class {
    observe() {}
    disconnect() {}
  },
);

const page = () => {
  document.body.innerHTML = `<div data-canvas-root><aside id="rail">rail</aside><div data-page-scroller><div id="margin">margin</div><div class="article-flow" data-readonly><p id="words">Some words <a id="link" href="#x">a link</a></p></div></div></div><p id="outside">Elsewhere</p>`;
  const $ = (id: string) => document.getElementById(id)!;
  return {
    words: $('words'),
    link: $('link'),
    margin: $('margin'),
    rail: $('rail'),
    outside: $('outside'),
  };
};

function Host({ active, onEdit }: { active: boolean; onEdit: () => void }) {
  useDoubleClickToEdit(active, onEdit);
  return null;
}

afterEach(() => {
  cleanup();
  document.body.innerHTML = '';
});

describe('Double-click to edit', () => {
  it('opens edit mode off the writing only: its margins, never the writing, a link, a sidebar or outside', () => {
    const { words, link, margin, rail, outside } = page();
    expect(opensEditOnDoubleClick(margin)).toBe(true);
    // A double-click on the writing selects the word: it never enters edit mode (owner 2026-11-22).
    expect(opensEditOnDoubleClick(words)).toBe(false);
    expect(opensEditOnDoubleClick(words.firstChild)).toBe(false);
    expect(opensEditOnDoubleClick(link)).toBe(false);
    expect(opensEditOnDoubleClick(rail)).toBe(false);
    expect(opensEditOnDoubleClick(outside)).toBe(false);
    expect(opensEditOnDoubleClick(null)).toBe(false);
  });

  it('a double-click to select a word, a triple-click and a drag leave the page read', () => {
    const { words, margin } = page();
    const onEdit = vi.fn();
    render(<Host active onEdit={onEdit} />);
    fireEvent.mouseDown(words);
    fireEvent.mouseMove(words);
    fireEvent.mouseUp(words);
    fireEvent.doubleClick(words, { detail: 2 });
    fireEvent.click(words, { detail: 3 });
    expect(onEdit).not.toHaveBeenCalled();
    fireEvent.doubleClick(margin);
    expect(onEdit).toHaveBeenCalledTimes(1);
  });

  it('is off while editing, or for anyone who may not edit', () => {
    const { margin } = page();
    const onEdit = vi.fn();
    const { rerender } = render(<Host active={false} onEdit={onEdit} />);
    fireEvent.doubleClick(margin);
    expect(onEdit).not.toHaveBeenCalled();
    rerender(<Host active onEdit={onEdit} />);
    rerender(<Host active={false} onEdit={onEdit} />);
    fireEvent.doubleClick(margin);
    expect(onEdit).not.toHaveBeenCalled();
  });

  it('shows no "Double-click to Edit" label under the pointer (removed 2026-11-22)', () => {
    const { words } = page();
    render(
      <>
        <Host active onEdit={vi.fn()} />
        <PageEditBarView
          editing={false}
          mayEdit
          status=""
          agentChanges={0}
          others={[]}
          onEdit={vi.fn()}
          onSave={vi.fn()}
          onCancel={vi.fn()}
        />
      </>,
    );
    fireEvent.pointerMove(words, { pointerType: 'mouse', buttons: 0, clientX: 100, clientY: 120 });
    expect(document.querySelector('[data-double-click-hint]')).toBeNull();
    expect(document.body.textContent).not.toMatch(/Double-click to Edit/i);
  });
});
