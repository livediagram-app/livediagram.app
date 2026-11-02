// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FilterSearchBox } from './FilterSearchBox';

// docs/specs/004-interface-design/search-and-filters.md: a search and its filters as one field.
afterEach(cleanup);

const chips = [{ key: 'k', field: 'Card Type', value: 'Bug' }];

describe('FilterSearchBox', () => {
  it('takes the last chip off with Backspace in empty words, and clears everything', () => {
    const onRemoveChip = vi.fn();
    const onClear = vi.fn();
    const onKeyDown = vi.fn();
    render(
      <FilterSearchBox
        query=""
        onQuery={vi.fn()}
        chips={chips}
        onRemoveChip={onRemoveChip}
        onClear={onClear}
        placeholder="Search"
        ariaLabel="Search cards"
        onKeyDown={onKeyDown}
      />,
    );
    const box = screen.getByRole('textbox', { name: 'Search cards' }) as HTMLInputElement;
    expect(box.placeholder).toBe('Search these…');
    fireEvent.keyDown(box, { key: 'Backspace' });
    expect(onRemoveChip).toHaveBeenCalledWith(0);
    expect(onKeyDown).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Remove Card Type: Bug' }));
    expect(onRemoveChip).toHaveBeenCalledTimes(2);
    fireEvent.click(screen.getByRole('button', { name: 'Clear Search' }));
    expect(onClear).toHaveBeenCalledOnce();
  });

  it('names its search landmark, so two on one page are told apart', () => {
    render(
      <FilterSearchBox
        query=""
        onQuery={vi.fn()}
        chips={[]}
        onClear={vi.fn()}
        placeholder="Find"
        ariaLabel="Find a card"
      />,
    );
    expect(screen.getByRole('search', { name: 'Find a card' })).toBeTruthy();
  });

  it('draws the compact header form in a surface’s own colours, with its own clear name', () => {
    const tone = { border: '#111111', text: '#222222', muted: '#333333', focus: '#ff0000' };
    const onQuery = vi.fn();
    const { rerender } = render(
      <FilterSearchBox
        compact
        tone={tone}
        query=""
        onQuery={onQuery}
        chips={[]}
        onClear={vi.fn()}
        placeholder="Filter cards"
        chipsPlaceholder="Filter these…"
        clearLabel="Clear Filter"
        ariaLabel="Filter this board"
      />,
    );
    const search = screen.getByRole('search');
    expect(search.className).toContain('h-7');
    expect(search.style.borderColor).toBe('rgb(17, 17, 17)');
    expect(screen.queryByRole('button', { name: 'Clear Filter' })).toBeNull();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'x' } });
    expect(onQuery).toHaveBeenCalledWith('x');
    rerender(
      <FilterSearchBox
        compact
        tone={tone}
        query="x"
        onQuery={onQuery}
        chips={chips}
        onClear={vi.fn()}
        placeholder="Filter cards"
        chipsPlaceholder="Filter these…"
        clearLabel="Clear Filter"
        ariaLabel="Filter this board"
      />,
    );
    expect(search.style.borderColor).toBe('rgb(255, 0, 0)');
    expect(screen.getByRole<HTMLInputElement>('textbox').placeholder).toBe('Filter these…');
    expect(screen.getByRole('group', { name: 'Filters' }).className).toContain('flex-nowrap');
    // A chip with no way to change it has no cross.
    expect(screen.queryByRole('button', { name: /Remove/ })).toBeNull();
    expect(screen.getByRole('button', { name: 'Clear Filter' })).toBeTruthy();
  });

  it('puts the caret in the words on a press of the box’s empty space', () => {
    render(
      <FilterSearchBox
        query=""
        onQuery={vi.fn()}
        chips={[]}
        onClear={vi.fn()}
        placeholder="Search"
        ariaLabel="Search cards"
      />,
    );
    fireEvent.pointerDown(screen.getByRole('search'));
    expect(document.activeElement).toBe(screen.getByRole('textbox'));
  });
});
