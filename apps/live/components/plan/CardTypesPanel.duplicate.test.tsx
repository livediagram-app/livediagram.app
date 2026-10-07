// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ITEM_TYPES, ITEM_TYPES_MAX, duplicateItemType } from '@livediagram/items';
import { CardTypesPanel } from './CardTypesPanel';
import { ItemTypeEditor } from './ItemTypeEditor';

// docs/specs/026-plan/item-types.md "The Card Types panel": Duplicate opens the editor on a new type filled
// from the one duplicated; nothing is made until Save.
const plan: Record<string, unknown> = {};
vi.mock('./PlanContext', () => ({ usePlan: () => plan }));
vi.mock('@/components/primitives/MovablePanel', () => ({
  MovablePanel: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock('@/hooks/ui/useConfirm', () => ({ useConfirm: () => vi.fn() }));

afterEach(cleanup);

function panel(over: Record<string, unknown> = {}) {
  for (const key of Object.keys(plan)) delete plan[key];
  Object.assign(
    plan,
    {
      types: ITEM_TYPES,
      canEdit: true,
      items: new Map(),
      editType: vi.fn(),
      itemTypes: { catalogue: null, restoreBuiltIns: vi.fn() },
    },
    over,
  );
  render(<CardTypesPanel popoverOpen onPopoverClose={() => {}} />);
}

describe('duplicating a card type', () => {
  it('opens the editor on a new type from the row’s Duplicate, never the row’s own edit', () => {
    panel();
    fireEvent.click(screen.getByRole('button', { name: 'Duplicate Task' }));
    expect(plan['editType']).toHaveBeenCalledTimes(1);
    expect(plan['editType']).toHaveBeenCalledWith('new', 'task');
  });

  it('is disabled with its reason when the catalogue is full, and hidden from a viewer', () => {
    const many = Array.from({ length: ITEM_TYPES_MAX }, (_, i) => ({
      ...ITEM_TYPES[1]!,
      id: `t${i}`,
      label: `T${i}`,
    }));
    panel({ types: many });
    const full = screen.getAllByRole('button', {
      name: 'The document has the most card types it can hold',
    })[0]!;
    fireEvent.click(full);
    expect(plan['editType']).not.toHaveBeenCalled();
    cleanup();
    panel({ canEdit: false });
    expect(screen.queryByRole('button', { name: 'Duplicate Task' })).toBeNull();
  });

  it('fills a new type in the editor, saved as a new type', () => {
    const task = ITEM_TYPES.find((t) => t.id === 'task')!;
    const onSave = vi.fn();
    render(
      <ItemTypeEditor
        type={null}
        template={duplicateItemType(task, ITEM_TYPES)}
        types={ITEM_TYPES}
        itemCount={0}
        canDelete
        onSave={onSave}
        onDelete={() => {}}
        onClose={() => {}}
      />,
    );
    expect(screen.getByText('New Card Type')).toBeTruthy();
    expect((screen.getByLabelText('Name') as HTMLInputElement).value).toBe('Task copy');
    expect(screen.queryByRole('button', { name: 'Duplicate Type' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    const saved = onSave.mock.calls[0]![0];
    expect(saved).toMatchObject({ id: 'task-copy', label: 'Task copy', color: task.color });
    // The same fields; the save puts Title and Status first, as every type's are.
    expect([...saved.fields].sort()).toEqual([...task.fields].sort());
  });

  it('offers Duplicate Type in the footer of a type that exists', () => {
    const onDuplicate = vi.fn();
    render(
      <ItemTypeEditor
        type={ITEM_TYPES[1]!}
        types={ITEM_TYPES}
        itemCount={0}
        canDelete
        onSave={() => {}}
        onDelete={() => {}}
        onClose={() => {}}
        onDuplicate={onDuplicate}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Duplicate Type' }));
    expect(onDuplicate).toHaveBeenCalled();
  });
});
