// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Item } from '@livediagram/items';
import { ItemPanelMenu } from './ItemPanelMenu';
import { duplicateItem } from './duplicate-item';
import { HelpArticleLink } from '@/components/primitives/HelpArticleLink';

// docs/specs/026-plan/plan-board.md "Open an item": the panel's ⋯ menu holds Duplicate, Archive (or
// Restore) and Trash for an editor, then Help for everyone; the type editor's Help carries a label.
afterEach(cleanup);

function open(archived = false, canEdit = true) {
  const fns = { onDuplicate: vi.fn(), onFlag: vi.fn(), onArchive: vi.fn(), onTrash: vi.fn() };
  render(
    <ItemPanelMenu itemKey={7} canEdit={canEdit} archived={archived} flagged={archived} {...fns} />,
  );
  fireEvent.click(screen.getByRole('button', { name: 'More for #7' }));
  return fns;
}

describe('ItemPanelMenu', () => {
  it('ends in Help for everyone, and offers a viewer Help alone', () => {
    const openArticle = vi.spyOn(window, 'open').mockImplementation(() => null);
    open(false, false);
    expect(screen.getAllByRole('menuitem').map((m) => m.textContent)).toEqual(['Help']);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Help' }));
    expect(openArticle).toHaveBeenCalledOnce();
    cleanup();
    open();
    expect(screen.getAllByRole('menuitem').at(-1)!.textContent).toBe('Help');
    openArticle.mockRestore();
  });

  it('runs each verb and closes', () => {
    const fns = open();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Duplicate' }));
    expect(fns.onDuplicate).toHaveBeenCalledOnce();
    expect(screen.queryByRole('menuitem', { name: 'Trash' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'More for #7' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Archive' }));
    expect(fns.onArchive).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', { name: 'More for #7' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Trash' }));
    expect(fns.onTrash).toHaveBeenCalledOnce();
  });

  it('offers Restore for an archived card, and Remove Flag for a flagged one', () => {
    open(true);
    expect(screen.getByRole('menuitem', { name: 'Restore' })).toBeTruthy();
    expect(screen.getByRole('menuitem', { name: 'Remove Flag' })).toBeTruthy();
  });

  it('opens the card’s type from Edit Card Type, for an editor', () => {
    const onEditType = vi.fn();
    render(
      <ItemPanelMenu
        itemKey={7}
        canEdit
        archived={false}
        flagged={false}
        onDuplicate={vi.fn()}
        onFlag={vi.fn()}
        onArchive={vi.fn()}
        onTrash={vi.fn()}
        onEditType={onEditType}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'More for #7' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Edit Card Type' }));
    expect(onEditType).toHaveBeenCalledOnce();
  });

  it('flags the card', () => {
    const fns = open();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Flag' }));
    expect(fns.onFlag).toHaveBeenCalledOnce();
  });
});

describe('duplicateItem', () => {
  it('copies the card right after it, in its column, without its votes', () => {
    const plan = { addItem: vi.fn(), announce: vi.fn() };
    const item = {
      id: 'item0001',
      type: 'task',
      fields: { title: 'Ship', status: 'doing', votes: { a: 1 } },
    } as unknown as Item;
    duplicateItem(plan as never, item);
    expect(plan.addItem).toHaveBeenCalledWith({
      type: 'task',
      fields: { title: 'Ship', status: 'doing' },
      status: 'doing',
      after: 'item0001',
    });
    expect(plan.announce).toHaveBeenCalledWith('Card duplicated');
  });
});

describe('HelpArticleLink labelled', () => {
  it('shows the ? with a Help label', () => {
    render(<HelpArticleLink article="planCards" variant="labelled" />);
    expect(screen.getByRole('link').textContent).toContain('Help');
  });
});
