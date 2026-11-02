// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { FindView } from '@/hooks/editor/useFindReplace';
import { DEFAULT_FIND_OPTIONS } from '@/lib/find/find-text';
import { FindBar, findCountLabel } from './FindBar';

// docs/specs/007-editor/find-and-replace.md "The bar", "The count and stepping", "Share roles".
function view(over: Partial<FindView> = {}): FindView {
  return {
    open: true,
    replaceOpen: false,
    canReplace: true,
    query: 'plan',
    setQuery: vi.fn(),
    by: '',
    setBy: vi.fn(),
    opts: DEFAULT_FIND_OPTIONS,
    toggleOption: vi.fn(),
    setReplaceOpen: vi.fn(),
    searched: true,
    count: 12,
    capped: false,
    index: 2,
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

describe('findCountLabel', () => {
  it('says where the match in hand is, none, the cap, or nothing yet', () => {
    expect(findCountLabel(view())).toBe('3 of 12');
    expect(findCountLabel(view({ count: 0, index: null }))).toBe('No Results');
    expect(findCountLabel(view({ count: 5000, capped: true, index: 0 }))).toBe('1 of 5,000+');
    expect(findCountLabel(view({ index: null }))).toBe('0 of 12');
    expect(findCountLabel(view({ query: '' }))).toBe('');
    expect(findCountLabel(view({ searched: false }))).toBe('');
  });
});

describe('the Find bar', () => {
  it('puts the caret in the Find field and steps with Enter and Shift+Enter', () => {
    const find = view();
    render(<FindBar find={find} />);
    const field = screen.getByRole('textbox', { name: 'Find' });
    expect(document.activeElement).toBe(field);
    expect(screen.getByText('3 of 12')).toBeTruthy();
    fireEvent.change(field, { target: { value: 'plans' } });
    expect(find.setQuery).toHaveBeenCalledWith('plans');
    fireEvent.keyDown(field, { key: 'Enter' });
    fireEvent.keyDown(field, { key: 'Enter', shiftKey: true });
    fireEvent.keyDown(field, { key: 'a' });
    expect(find.next).toHaveBeenCalledTimes(1);
    expect(find.previous).toHaveBeenCalledTimes(1);
  });

  it('toggles the options by button and by Alt+C and Alt+W, showing them pressed', () => {
    const find = view({ opts: { matchCase: true, wholeWord: false } });
    render(<FindBar find={find} />);
    const matchCase = screen.getByRole('button', { name: /^Match Case/ });
    expect(matchCase.getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: /^Whole Word/ }).getAttribute('aria-pressed')).toBe(
      'false',
    );
    fireEvent.click(matchCase);
    const field = screen.getByRole('textbox', { name: 'Find' });
    fireEvent.keyDown(field, { key: 'ç', code: 'KeyC', altKey: true });
    fireEvent.keyDown(field, { key: '∑', code: 'KeyW', altKey: true });
    fireEvent.keyDown(field, { key: 'x', code: 'KeyX', altKey: true });
    expect(find.toggleOption).toHaveBeenNthCalledWith(1, 'matchCase');
    expect(find.toggleOption).toHaveBeenNthCalledWith(2, 'matchCase');
    expect(find.toggleOption).toHaveBeenNthCalledWith(3, 'wholeWord');
    expect(find.toggleOption).toHaveBeenCalledTimes(3);
  });

  it('closes on Escape and on Close, and turns stepping off with no matches', () => {
    const find = view({ count: 0, index: null });
    render(<FindBar find={find} />);
    expect(screen.getByText('No Results')).toBeTruthy();
    expect(screen.getByRole('button', { name: /^Next Match/ })).toHaveProperty('disabled', true);
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Find' }), { key: 'Escape' });
    fireEvent.click(screen.getByRole('button', { name: /^Close Find/ }));
    expect(find.close).toHaveBeenCalledTimes(2);
  });

  it('shows the Replace row only when open, and for someone who may replace', () => {
    const find = view();
    const { rerender } = render(<FindBar find={find} />);
    const chevron = screen.getByRole('button', { name: /^Show Replace/ });
    expect(chevron.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('textbox', { name: 'Replace With' })).toBeNull();
    fireEvent.click(chevron);
    expect(find.setReplaceOpen).toHaveBeenCalledWith(true);
    // A Viewer: no chevron, no Replace row.
    rerender(<FindBar find={view({ canReplace: false })} />);
    expect(screen.queryByRole('button', { name: /Replace/ })).toBeNull();
  });

  it('replaces with Enter and Replace, and all with Mod+Enter and Replace All', () => {
    const find = view({ replaceOpen: true, by: 'map' });
    render(<FindBar find={find} />);
    expect(
      screen.getByRole('button', { name: /^Hide Replace/ }).getAttribute('aria-expanded'),
    ).toBe('true');
    const by = screen.getByRole('textbox', { name: 'Replace With' });
    fireEvent.change(by, { target: { value: 'maps' } });
    expect(find.setBy).toHaveBeenCalledWith('maps');
    fireEvent.keyDown(by, { key: 'Enter' });
    fireEvent.keyDown(by, { key: 'Enter', metaKey: true });
    fireEvent.keyDown(by, { key: 'Enter', ctrlKey: true });
    fireEvent.keyDown(by, { key: 'b' });
    fireEvent.click(screen.getByRole('button', { name: /^Replace \(/ }));
    fireEvent.click(screen.getByRole('button', { name: /^Replace All/ }));
    expect(find.replace).toHaveBeenCalledTimes(2);
    expect(find.replaceAll).toHaveBeenCalledTimes(3);
  });

  it('gives the keyboard back to the Find field when Replace All takes the last match', () => {
    const { rerender } = render(<FindBar find={view({ replaceOpen: true, by: 'map' })} />);
    const all = screen.getByRole('button', { name: /^Replace All/ });
    all.focus();
    expect(document.activeElement).toBe(all);
    // Every match replaced: the button turns off under the keyboard.
    rerender(<FindBar find={view({ replaceOpen: true, by: 'map', count: 0, index: null })} />);
    expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Find' }));
  });

  it('leaves the keyboard where it is when the control it is on stays on', () => {
    const { rerender } = render(<FindBar find={view({ replaceOpen: true, by: 'map' })} />);
    const all = screen.getByRole('button', { name: /^Replace All/ });
    all.focus();
    rerender(<FindBar find={view({ replaceOpen: true, by: 'map', count: 11, index: 2 })} />);
    expect(document.activeElement).toBe(all);
  });

  it('says which matches are held and why Replace is off on one', () => {
    render(<FindBar find={view({ replaceOpen: true, heldCount: 3, currentHeld: 'role' })} />);
    const replace = screen.getByRole('button', { name: "Replace: You can't edit this text" });
    expect(replace).toHaveProperty('disabled', true);
    expect(screen.getByText(/3 can.t be replaced/)).toBeTruthy();
    expect(screen.getByRole('button', { name: /^Replace All/ })).toHaveProperty('disabled', false);
  });

  it('turns Replace All off when none of the matches can be replaced', () => {
    render(
      <FindBar find={view({ replaceOpen: true, count: 2, heldCount: 2, currentHeld: 'locked' })} />,
    );
    expect(screen.getByRole('button', { name: 'Replace: This text is locked' })).toBeTruthy();
    const all = screen.getByRole('button', {
      name: 'Replace All: None of these matches can be replaced',
    });
    expect(all).toHaveProperty('disabled', true);
  });
});
