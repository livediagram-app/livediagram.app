// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Item } from '@liveplanner/items';
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
  it('ends in Trash for an editor (after Help), and offers a viewer Help alone', () => {
    const openArticle = vi.spyOn(window, 'open').mockImplementation(() => null);
    open(false, false);
    expect(screen.getAllByRole('menuitem').map((m) => m.textContent)).toEqual(['Help']);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Help' }));
    expect(openArticle).toHaveBeenCalledOnce();
    cleanup();
    open();
    const labels = screen.getAllByRole('menuitem').map((m) => m.textContent);
    expect(labels.slice(-2)).toEqual(['Help', 'Trash']);
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

  // docs/specs/026-plan/plan-board.md "Its address": Copy Card Link is every role's, before Help.
  it.each([
    ['an Editor', true, true],
    ['a Participant', true, false],
    ['a Viewer', false, false],
  ])('offers %s Copy Card Link before Help, and copies', (_role, canEdit, canRetire) => {
    const onCopyLink = vi.fn();
    render(
      <ItemPanelMenu
        itemKey={7}
        canEdit={canEdit}
        canRetire={canRetire}
        archived={false}
        flagged={false}
        onDuplicate={vi.fn()}
        onFlag={vi.fn()}
        onArchive={vi.fn()}
        onTrash={vi.fn()}
        onCopyLink={onCopyLink}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'More for #7' }));
    const labels = screen.getAllByRole('menuitem').map((m) => m.textContent);
    expect(labels[labels.indexOf('Help') - 1]).toBe('Copy Card Link');
    if (!canEdit) expect(labels).toEqual(['Copy Card Link', 'Help']);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Copy Card Link' }));
    expect(onCopyLink).toHaveBeenCalledOnce();
    expect(screen.queryByRole('menuitem')).toBeNull();
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
    duplicateItem(plan, item);
    expect(plan.addItem).toHaveBeenCalledWith({
      type: 'task',
      fields: { title: 'Ship', status: 'doing' },
      status: 'doing',
      after: 'item0001',
    });
    expect(plan.announce).toHaveBeenCalledWith('Card duplicated');
  });

  it('leaves tracked time behind but keeps a plain Duration', () => {
    const custom = [
      { id: 'spent', label: 'Time Spent', kind: 'duration', timeSpent: true },
      { id: 'est', label: 'Estimate', kind: 'duration' },
    ];
    const plan = {
      addItem: vi.fn(),
      announce: vi.fn(),
      itemTypes: { types: [{ id: 'task', fields: ['spent', 'est'], custom }] },
    };
    const item = {
      id: 'item0001',
      type: 'task',
      fields: { title: 'Ship', spent: { people: {}, entries: [] }, est: 90 },
    } as unknown as Item;
    duplicateItem(plan as unknown as Parameters<typeof duplicateItem>[0], item);
    expect(plan.addItem).toHaveBeenCalledWith(
      expect.objectContaining({ fields: { title: 'Ship', est: 90 } }),
    );
  });
});

// docs/specs/026-plan/items.md "Repeating cards": Repeat, or Edit Repeat and Stop Repeating, for an Editor alone.
describe('the Repeat rows', () => {
  const fns = { onDuplicate: vi.fn(), onFlag: vi.fn(), onArchive: vi.fn(), onTrash: vi.fn() };
  const menu = (repeating: boolean, canRetire = true, canEdit = true) => {
    const repeat = { repeating, onRepeat: vi.fn(), onStopRepeat: vi.fn() };
    render(
      <ItemPanelMenu
        itemKey={7}
        canEdit={canEdit}
        canRetire={canRetire}
        archived={false}
        flagged={false}
        repeat={repeat}
        {...fns}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'More for #7' }));
    return repeat;
  };
  const rows = () => screen.getAllByRole('menuitem').map((m) => m.textContent);

  it('offers an Editor Repeat on a plain card and opens the dialog', () => {
    const repeat = menu(false);
    expect(rows()).toContain('Repeat');
    expect(rows()).not.toContain('Stop Repeating');
    fireEvent.click(screen.getByRole('menuitem', { name: 'Repeat' }));
    expect(repeat.onRepeat).toHaveBeenCalledOnce();
    expect(screen.queryByRole('menuitem')).toBeNull();
  });

  it('offers Edit Repeat and Stop Repeating on a repeating card', () => {
    const repeat = menu(true);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Stop Repeating' }));
    expect(repeat.onStopRepeat).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', { name: 'More for #7' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Edit Repeat' }));
    expect(repeat.onRepeat).toHaveBeenCalledOnce();
  });

  it('offers a Participant and a Viewer no Repeat row', () => {
    menu(true, false);
    expect(rows().some((r) => r?.includes('Repeat'))).toBe(false);
    cleanup();
    menu(true, false, false);
    expect(rows()).toEqual(['Help']);
  });
});

describe('HelpArticleLink labelled', () => {
  it('shows the ? with a Help label', () => {
    render(<HelpArticleLink article="planCards" variant="labelled" />);
    expect(screen.getByRole('link').textContent).toContain('Help');
  });
});
