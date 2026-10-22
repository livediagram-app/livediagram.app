// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ITEM_TYPES, type Item, type PlanBoardSetup } from '@livediagram/items';
import { PlanCardMenu, PlanCardMenuHost } from './PlanCardMenu';
import type { PlanContextValue } from './PlanContext';

// docs/specs/026-plan/items.md "Trash": a card's menu trashes it, never deletes it for good.
afterEach(cleanup);

// jsdom has no ResizeObserver; the menu measures itself with one.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

describe('PlanCardMenu', () => {
  it('offers Trash, not Delete, and moves the card there', () => {
    const onTrash = vi.fn();
    render(
      <PlanCardMenu
        at={{ x: 10, y: 10 }}
        title="Ship"
        canEdit
        columns={[]}
        onOpen={vi.fn()}
        onDuplicate={vi.fn()}
        onMove={vi.fn()}
        onTrash={onTrash}
        onArchive={vi.fn()}
        onFlag={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(screen.queryByRole('button', { name: 'Delete' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Trash' }));
    expect(onTrash).toHaveBeenCalledOnce();
  });

  it('opens the card’s type from Edit Card Type', () => {
    const onEditType = vi.fn();
    render(
      <PlanCardMenu
        at={{ x: 10, y: 10 }}
        title="Ship"
        canEdit
        columns={[]}
        onOpen={vi.fn()}
        onDuplicate={vi.fn()}
        onMove={vi.fn()}
        onTrash={vi.fn()}
        onArchive={vi.fn()}
        onFlag={vi.fn()}
        onEditType={onEditType}
        onClose={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Edit Card Type' }));
    expect(onEditType).toHaveBeenCalledOnce();
  });

  // docs/specs/013-workspace/share-roles.md: a Participant works on cards (duplicates, moves, flags) and never
  // retires them or changes their type, as the item panel's menu offers it; a Viewer only opens.
  it('gives a Participant Duplicate, Move to and Flag, and a Viewer Open alone', () => {
    const menu = (canEdit: boolean, canRetire: boolean) =>
      render(
        <PlanCardMenu
          at={{ x: 10, y: 10 }}
          title="Ship"
          canEdit={canEdit}
          canRetire={canRetire}
          columns={[{ status: 'done', name: 'Done' }]}
          onOpen={vi.fn()}
          onDuplicate={vi.fn()}
          onMove={vi.fn()}
          onTrash={vi.fn()}
          onArchive={vi.fn()}
          onFlag={vi.fn()}
          onEditType={vi.fn()}
          onAddSlide={vi.fn()}
          onClose={vi.fn()}
        />,
      );
    const rows = () => screen.getAllByRole('button').map((b) => b.textContent);
    menu(true, false);
    expect(rows()).toEqual(['Open', 'Duplicate', 'Move to Done', 'Flag']);
    cleanup();
    menu(false, false);
    expect(rows()).toEqual(['Open']);
  });

  // docs/specs/026-plan/item-types.md "An item type": Move To never offers a status the card's type leaves out.
  it('offers no column whose status the card’s type leaves out', () => {
    const types = ITEM_TYPES.map((t) =>
      t.id === 'task' ? { ...t, excludedStatuses: ['done'] } : t,
    );
    const item = { id: 'i1', type: 'task', key: 1, rev: 1, fields: { title: 'T', status: 'todo' } };
    const plan = {
      items: new Map([['i1', item as unknown as Item]]),
      types,
    } as unknown as PlanContextValue;
    const setup = {
      columns: [
        { status: 'todo', name: 'To Do' },
        { status: 'doing', name: 'Doing' },
        { status: 'done', name: 'Done' },
      ],
    } as unknown as PlanBoardSetup;
    render(
      <PlanCardMenuHost
        menu={{ itemId: 'i1', at: { x: 0, y: 0 } }}
        plan={plan}
        setup={setup}
        canEdit
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: 'Move to Doing' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Move to Done' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Move to To Do' })).toBeNull();
  });
});
