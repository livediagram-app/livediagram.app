// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AddPageButton } from './AddPageButton';

afterEach(cleanup);

// docs/specs/007-editor/illustrate-pages.md "Adding a page": the + sits beside the last page, level with its middle,
// whether or not the page sits on the row's axis (a page sized to its content need not).
describe('AddPageButton', () => {
  it('sits level with the last page’s middle', () => {
    render(<AddPageButton lastRight={800} lastMiddle={420} zoom={1} onAdd={vi.fn()} />);
    const holder = screen
      .getByRole('button', { name: 'Add Page' })
      .closest('div[style]') as HTMLElement;
    expect(holder.style.top).toBe('420px');
  });
});

// docs/specs/007-editor/illustrate-pages.md "Adding a page": the last page's kind first.
describe('Add a Page, the last kind first', () => {
  it('offers the last page’s kind first, tagged and focused, and adds it', () => {
    const onAdd = vi.fn();
    render(
      <AddPageButton lastRight={800} lastMiddle={420} zoom={1} onAdd={onAdd} suggested="slide" />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Add Page' }));
    const group = screen.getByRole('group', { name: 'Add a Page' });
    const cards = within(group).getAllByRole('button');
    expect(cards[0]!.textContent).toContain('Slide');
    expect(cards[0]!.textContent).toContain('Same as last page');
    expect(document.activeElement).toBe(cards[0]);
    fireEvent.click(cards[0]!);
    expect(onAdd).toHaveBeenCalledWith('slide');
  });

  it('keeps the usual order with no last page to follow', () => {
    render(<AddPageButton lastRight={800} lastMiddle={420} zoom={1} onAdd={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add Page' }));
    const cards = within(screen.getByRole('group', { name: 'Add a Page' })).getAllByRole('button');
    expect(cards[0]!.textContent).toContain('Infographic');
    expect(screen.queryByText('Same as last page')).toBeNull();
  });
});
