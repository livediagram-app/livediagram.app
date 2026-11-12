// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createSticky, type BoxedElement } from '@livehuddle/document';
import { storedPinnedArrow } from '@/test/retired-elements';
import { publishClearStyles } from '@liveworkspace/workbench/lib/clear-styles-store';
import { ElementMenuQuickBar } from './ElementMenuQuickBar';

// docs/specs/008-canvas/element-menu-quick-bar.md, and docs/specs/002-project-scope/not-in-livehuddle.md "Comments,
// actions, links and notes": the bar holds Clear Styles alone.
afterEach(() => {
  cleanup();
  publishClearStyles(null);
});

const square = (over: Partial<BoxedElement> = {}) =>
  ({ ...createSticky(0, 0), id: 'sq', ...over }) as BoxedElement;

const open = (target: BoxedElement = square()) => {
  const onClose = vi.fn();
  render(<ElementMenuQuickBar target={target} onClose={onClose} />);
  return { onClose };
};

describe('ElementMenuQuickBar', () => {
  it('offers no Assign Action, Comment, Link or Note, even on an element that carries all four', () => {
    const carrying = square({
      link: { kind: 'url', url: 'https://example.com' },
      note: 'Remember',
      commentThread: { resolved: false, comments: [{ id: 'c' }] },
    } as Partial<BoxedElement>);
    open(carrying);
    act(() => publishClearStyles({ targetIds: new Set(['sq']), clear: vi.fn() }));
    expect(screen.getAllByRole('button').map((b) => b.getAttribute('aria-label'))).toEqual([
      'Clear Styles',
    ]);
    for (const name of [/Action/, /Comment/, /Link/, /Note/])
      expect(screen.queryByRole('button', { name })).toBeNull();
  });

  it('runs Clear Styles while the element takes a quick style, and closes the menu', () => {
    const clear = vi.fn();
    const { onClose } = open();
    expect(screen.queryByRole('button', { name: 'Clear Styles' })).toBeNull();
    act(() => publishClearStyles({ targetIds: new Set(['sq']), clear }));
    fireEvent.click(screen.getByRole('button', { name: 'Clear Styles' }));
    expect(clear).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('draws nothing for an element the quick style is not on, a stored arrow included', () => {
    open(storedPinnedArrow('ar', 'a', 'e', 'b', 'w') as BoxedElement);
    act(() => publishClearStyles({ targetIds: new Set(['other']), clear: vi.fn() }));
    expect(screen.queryByRole('toolbar')).toBeNull();
  });
});
