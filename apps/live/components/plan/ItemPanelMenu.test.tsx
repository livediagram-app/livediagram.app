// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Item } from '@livediagram/items';
import { ItemPanelMenu } from './ItemPanelMenu';
import { duplicateItem } from './duplicate-item';
import { HelpArticleLink } from '@/components/primitives/HelpArticleLink';

// docs/specs/026-plan/plan-board.md "Open an item": the panel's ⋯ menu holds Duplicate, Archive (or
// Restore) and Delete; Help carries a label.
afterEach(cleanup);

function open(archived = false) {
  const fns = { onDuplicate: vi.fn(), onArchive: vi.fn(), onDelete: vi.fn() };
  render(<ItemPanelMenu itemKey={7} archived={archived} {...fns} />);
  fireEvent.click(screen.getByRole('button', { name: 'More for #7' }));
  return fns;
}

describe('ItemPanelMenu', () => {
  it('runs each verb and closes', () => {
    const fns = open();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Duplicate' }));
    expect(fns.onDuplicate).toHaveBeenCalledOnce();
    expect(screen.queryByRole('menuitem', { name: 'Delete' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'More for #7' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Archive' }));
    expect(fns.onArchive).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', { name: 'More for #7' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Delete' }));
    expect(fns.onDelete).toHaveBeenCalledOnce();
  });

  it('offers Restore for an archived card', () => {
    open(true);
    expect(screen.getByRole('menuitem', { name: 'Restore' })).toBeTruthy();
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
