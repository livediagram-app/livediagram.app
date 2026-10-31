// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { FindView } from '@/hooks/editor/useFindReplace';
import { DEFAULT_FIND_OPTIONS } from '@/lib/find/find-text';
import { FindBar } from './FindBar';
import { FindBarLoading, takeLoadingHandover } from './FindBarLoading';

// docs/specs/007-editor/find-and-replace.md "Opening and closing": what is typed straight after Cmd/Ctrl+F is the
// query, even while the bar's code is still arriving, and never reaches the canvas.
function view(over: Partial<FindView> = {}): FindView {
  return {
    open: true,
    replaceOpen: false,
    canReplace: true,
    query: '',
    setQuery: vi.fn(),
    by: '',
    setBy: vi.fn(),
    opts: DEFAULT_FIND_OPTIONS,
    toggleOption: vi.fn(),
    setReplaceOpen: vi.fn(),
    searched: false,
    count: 0,
    capped: false,
    index: null,
    heldCount: 0,
    currentHeld: null,
    focusSeq: 1,
    openBar: vi.fn(),
    next: vi.fn(),
    previous: vi.fn(),
    replace: vi.fn(),
    replaceAll: vi.fn(),
    close: vi.fn(),
    ...over,
  };
}

describe('the Find field while the bar loads', () => {
  it('takes the keyboard at once, so typing is the query', () => {
    const find = view();
    render(<FindBarLoading find={find} />);
    const field = screen.getByRole('textbox', { name: 'Find' });
    expect(document.activeElement).toBe(field);
    fireEvent.change(field, { target: { value: 't' } });
    expect(find.setQuery).toHaveBeenCalledWith('t');
  });

  it('hands the bar what was typed, the caret after it rather than the text selected', () => {
    const { rerender } = render(<FindBarLoading find={view({ query: 'th' })} />);
    // The bar's code arrives and takes the field's place.
    rerender(<FindBar find={view({ query: 'th' })} />);
    const field = screen.getByRole('textbox', { name: 'Find' }) as HTMLInputElement;
    expect(document.activeElement).toBe(field);
    expect([field.selectionStart, field.selectionEnd]).toEqual([2, 2]);
    // Taken once: the next opening selects the query as ever.
    expect(takeLoadingHandover()).toBe(false);
  });

  it('closes on Escape, and a bar opened later selects its query', () => {
    const find = view({ query: 'plan' });
    const { unmount } = render(<FindBarLoading find={find} />);
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Find' }), { key: 'Escape' });
    expect(find.close).toHaveBeenCalledOnce();
    unmount();
    render(<FindBar find={view({ query: 'plan' })} />);
    const field = screen.getByRole('textbox', { name: 'Find' }) as HTMLInputElement;
    expect([field.selectionStart, field.selectionEnd]).toEqual([0, 4]);
  });
});
