// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ITEM_TYPES, type Item, type ItemTypeDef } from '@liveplanner/items';
import { ItemTypeEditor } from './ItemTypeEditor';
import { PlanSheetsHost } from './PlanSheetsHost';
import type { PlanSlice } from '@/hooks/plan/usePlanSlice';
import type { SaveAlong } from '@/hooks/plan/retype-settle';

// docs/specs/026-plan/item-types.md "Edit Field": a field's pencil opens Add Field's modal on it, to rename it,
// reshape it or make it another type, saying first what that does to the values cards hold.
const plan: Record<string, unknown> = {};
vi.mock('./PlanContext', () => ({ usePlan: () => plan }));

afterEach(cleanup);

const TASK: ItemTypeDef = {
  ...ITEM_TYPES[1],
  id: 'task',
  label: 'Task',
  fields: ['title', 'status', 'f-size', 'f-tier', 'f-owner', 'f-notes'],
  custom: [
    { id: 'f-size', label: 'Size', kind: 'text' },
    { id: 'f-tier', label: 'Tier', kind: 'choice', options: ['Gold', 'Silver'] },
    { id: 'f-owner', label: 'Owner', kind: 'person' },
    { id: 'f-notes', label: 'Notes', kind: 'longtext' },
  ],
};
const SAM = { id: 'p-sam', name: 'Sam', color: '#2563eb' };

let n = 0;
const card = (fields: Item['fields']): Item => ({
  id: `c${(n += 1)}`,
  type: 'task',
  key: n,
  rank: 'i',
  fields: { title: 'Card', status: 'todo', ...fields },
  rev: 1,
  createdAt: 0,
  updatedAt: 0,
  createdBy: SAM,
  updatedBy: SAM,
});
const CARDS = [
  card({ 'f-size': '12', 'f-owner': SAM }),
  card({ 'f-size': 'n/a' }),
  card({ 'f-size': '7' }),
];

function setPlan(extra: Record<string, unknown> = {}) {
  for (const key of Object.keys(plan)) delete plan[key];
  Object.assign(plan, {
    types: [TASK],
    items: new Map(CARDS.map((c) => [c.id, c])),
    people: [SAM],
    statusNames: new Map(),
    ...extra,
  });
}

function editor() {
  setPlan();
  const onSave = vi.fn<(t: ItemTypeDef) => void>();
  render(
    <ItemTypeEditor
      type={TASK}
      types={[TASK]}
      itemCount={3}
      onSave={onSave}
      onDelete={() => {}}
      onClose={() => {}}
    />,
  );
  return onSave;
}

const row = (name: string) =>
  screen.getAllByRole('listitem').find((li) => li.textContent?.startsWith(name))!;
const editField = () => screen.getByRole('dialog', { name: 'Edit Field' });
const openEdit = (name: string) => {
  fireEvent.click(within(row(name)).getByRole('button', { name: `Edit ${name}` }));
  return editField();
};
const saveType = (onSave: ReturnType<typeof editor>) => {
  fireEvent.click(
    within(screen.getByRole('dialog', { name: /Task/ })).getByRole('button', { name: 'Save' }),
  );
  return onSave.mock.lastCall![0];
};
const fieldOf = (t: ItemTypeDef, id: string) => t.custom!.find((f) => f.id === id)!;

describe('Edit Field', () => {
  it('opens on Shape with the field’s name, renames it, and keeps its id', () => {
    const onSave = editor();
    const dialog = openEdit('Size');
    expect(within(dialog).getByText('Rename it, reshape it, or pick another type.')).toBeTruthy();
    const name = within(dialog).getByLabelText('Name') as HTMLInputElement;
    expect(name.value).toBe('Size');
    fireEvent.change(name, { target: { value: 'Points' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect(screen.queryByRole('dialog', { name: 'Edit Field' })).toBeNull();
    expect(fieldOf(saveType(onSave), 'f-size')).toEqual({
      id: 'f-size',
      label: 'Points',
      kind: 'text',
    });
  });

  it('reshapes a Choice’s options', () => {
    const onSave = editor();
    const dialog = openEdit('Tier');
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Option 2' }), {
      target: { value: 'Bronze' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect(fieldOf(saveType(onSave), 'f-tier').options).toEqual(['Gold', 'Bronze']);
  });

  it('makes a Person Several People, keeping every value without asking', () => {
    const onSave = editor();
    const dialog = openEdit('Owner');
    fireEvent.click(within(dialog).getByRole('button', { name: /All kinds/ }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Several People' }));
    // Nothing to rewrite: one person reads as a list of one, so no line and no question.
    expect(within(dialog).queryByRole('status')).toBeNull();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect(fieldOf(saveType(onSave), 'f-owner')).toMatchObject({ kind: 'person', multiple: true });
  });

  it('says how many values a lossy change clears, and asks before saving it', () => {
    const onSave = editor();
    const dialog = openEdit('Size');
    fireEvent.click(within(dialog).getByRole('button', { name: /All kinds/ }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Number' }));
    expect(
      within(dialog).getByText(
        /3 cards have a value; 1 can’t be kept as a Number and will be cleared\./,
      ),
    ).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    // Asked once: still open, Keep Editing beside Change Values.
    expect(within(dialog).getByText(/Change them\? Undo puts them back\./)).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Keep Editing' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Change Values' }));
    expect(screen.queryByRole('dialog', { name: 'Edit Field' })).toBeNull();
    expect(fieldOf(saveType(onSave), 'f-size')).toEqual({
      id: 'f-size',
      label: 'Size',
      kind: 'number',
    });
  });

  it('starts a Choice made from text with the values cards hold', () => {
    editor();
    const dialog = openEdit('Size');
    fireEvent.click(within(dialog).getByRole('button', { name: /All kinds/ }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Choice' }));
    const options = within(dialog)
      .getAllByRole('textbox', { name: /^Option \d/ })
      .map((o) => (o as HTMLInputElement).value);
    expect(options).toEqual(['12', 'n/a', '7']);
    expect(within(dialog).getByText(/every one is kept as a Choice/)).toBeTruthy();
  });

  it('dims the tiles a field can’t become, each saying why, and tags its own', () => {
    editor();
    const dialog = openEdit('Size');
    fireEvent.click(within(dialog).getByRole('button', { name: /All kinds/ }));
    const comments = within(dialog).getByRole('button', { name: /^Comments: / });
    expect(comments.getAttribute('aria-disabled')).toBe('true');
    expect(comments.getAttribute('aria-label')).toMatch(/Comments hold threads, not values/);
    expect(
      within(dialog).getByRole('button', { name: /^Formula: Worked out, never typed/ }),
    ).toBeTruthy();
    expect(
      within(dialog).getByRole('button', { name: /^Link to Card: Only a card link/ }),
    ).toBeTruthy();
    expect(within(dialog).getByText('Current')).toBeTruthy();
    // Pressing a dimmed tile does nothing.
    fireEvent.click(comments);
    expect(within(dialog).queryByLabelText('Name')).toBeNull();
  });

  it('steps back to the gallery on Escape, then closes, the draft untouched', () => {
    const onSave = editor();
    const dialog = openEdit('Size');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(within(dialog).queryByLabelText('Name')).toBeNull();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'Edit Field' })).toBeNull();
    expect(fieldOf(saveType(onSave), 'f-size')).toEqual(TASK.custom![0]);
  });
});

describe('saving a type whose field changed type', () => {
  function host(canEdit: boolean) {
    const saveType = vi.fn<(t: ItemTypeDef, along?: SaveAlong) => void>();
    const reshapeValues = vi.fn((_patches: unknown) => Promise.resolve({ ok: true, step: null }));
    const removeFieldFilters = vi.fn((_targets: unknown) => false);
    setPlan({ canEdit, itemTypes: { saveType }, reshapeValues, removeFieldFilters });
    const slice = {
      context: plan,
      editingType: { id: 'task' },
      requiredFields: null,
      openItemId: null,
      itemTrail: [],
      typeTemplateId: null,
      typeForBoard: null,
      closeTypeEditor: vi.fn(),
    } as unknown as PlanSlice;
    render(<PlanSheetsHost plan={slice} />);
    return { saveType, reshapeValues, removeFieldFilters };
  }

  it('writes the cards’ values with the type, handing their undo step to the type’s save', () => {
    const { saveType, reshapeValues, removeFieldFilters } = host(true);
    const dialog = openEdit('Size');
    fireEvent.click(within(dialog).getByRole('button', { name: /All kinds/ }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Number' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Change Values' }));
    fireEvent.click(
      within(screen.getByRole('dialog', { name: /Task/ })).getByRole('button', { name: 'Save' }),
    );
    expect(reshapeValues).toHaveBeenCalledWith([
      { id: CARDS[0]!.id, patch: { set: { 'f-size': 12 } } },
      { id: CARDS[1]!.id, patch: { clear: ['f-size'] } },
      { id: CARDS[2]!.id, patch: { set: { 'f-size': 7 } } },
    ]);
    const along = saveType.mock.lastCall![1]!;
    expect(along.name).toBe('Size');
    expect(along.values).toBeInstanceOf(Promise);
    // Its filters come off once the type and the values have landed (the type's save runs it).
    expect(removeFieldFilters).not.toHaveBeenCalled();
    along.settle!();
    expect(removeFieldFilters.mock.lastCall![0]).toEqual([
      expect.objectContaining({ field: 'f-size', builtIn: false }),
    ]);
  });

  it('shows the pencil to an Editor only', () => {
    host(false);
    expect(screen.queryByRole('button', { name: 'Edit Size' })).toBeNull();
    cleanup();
    host(true);
    expect(screen.getByRole('button', { name: 'Edit Size' })).toBeTruthy();
  });
});
