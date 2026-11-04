// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ITEM_TYPES, type Item, type ItemTypeDef } from '@liveplanner/items';
import type { Tab } from '@liveplanner/project';
import { ItemTypeEditor } from './ItemTypeEditor';
import { PlanSheetsHost } from './PlanSheetsHost';
import type { PlanSlice } from '@/hooks/plan/usePlanSlice';
import type { SaveAlong } from '@/hooks/plan/retype-settle';

// docs/specs/026-plan/item-types.md "Edit Field": Built-in fields. Each built-in but Title gets the pencil: renamed
// on its own tile (Notifies for the Assignee), made a custom field on another (saying first what that does to its
// values, its filters and what stops reading it). Status keeps its type. Only an Editor opens the type editor.
const plan: Record<string, unknown> = {};
vi.mock('./PlanContext', () => ({ usePlan: () => plan }));

afterEach(cleanup);

const TASK: ItemTypeDef = {
  ...ITEM_TYPES.find((t) => t.id === 'task')!,
  fields: ['title', 'status', 'assignee', 'priority', 'due', 'comments'],
  tabs: undefined,
  display: undefined,
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
const CARDS = [card({ priority: 'high' }), card({ priority: 'low' }), card({})];

// A tab with a board sorted by Priority and a saved filter on it, for the confirm's lines.
const TABS = [
  {
    id: 'tab-1',
    name: 'Sprint',
    elements: [
      {
        id: 'b1',
        type: 'shape',
        shape: 'plan-board',
        planBoard: {
          title: 'Sprint',
          columns: [{ id: 'c', status: 'todo', name: 'To Do' }],
          swimlaneBy: 'none',
          cardFields: [],
          hideWriting: false,
          sortBy: [{ field: 'priority', dir: 'desc' }],
          savedFilters: [{ id: 's', name: 'High', priority: 'high' }],
        },
      },
    ],
  },
] as unknown as Tab[];

function setPlan(extra: Record<string, unknown> = {}) {
  for (const key of Object.keys(plan)) delete plan[key];
  Object.assign(plan, {
    types: [TASK],
    items: new Map(CARDS.map((c) => [c.id, c])),
    people: [SAM],
    statusNames: new Map(),
    planTabs: () => TABS,
    ...extra,
  });
}

function editor(type: ItemTypeDef = TASK) {
  setPlan({ types: [type] });
  const onSave = vi.fn<(t: ItemTypeDef, retyped: Record<string, string>) => void>();
  render(
    <ItemTypeEditor
      type={type}
      types={[type]}
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
  return onSave.mock.lastCall!;
};

describe('Edit Field on a built-in field', () => {
  it('gives every built-in but Title the pencil', () => {
    editor();
    expect(within(row('Title')).queryByRole('button', { name: 'Edit Title' })).toBeNull();
    for (const name of ['Status', 'Assignee', 'Priority', 'Due Date', 'Comments'])
      expect(within(row(name)).getByRole('button', { name: `Edit ${name}` })).toBeTruthy();
  });

  it('renames it on its own tile, keeping its id, and the row shows the new name', () => {
    const onSave = editor();
    const dialog = openEdit('Priority');
    expect(within(dialog).getByText('Urgent to Low, for sorting and swimlanes')).toBeTruthy();
    // No Options, Required or Try It: a built-in's values and rules are its own.
    expect(within(dialog).queryByRole('group', { name: 'Options' })).toBeNull();
    const name = within(dialog).getByLabelText('Name') as HTMLInputElement;
    expect(name.placeholder).toBe('Priority');
    fireEvent.change(name, { target: { value: '' } });
    expect(within(dialog).getByRole('button', { name: 'Save' })).toHaveProperty('disabled', true);
    fireEvent.change(name, { target: { value: 'Urgency' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect(row('Urgency')).toBeTruthy();
    const [saved, retyped] = saveType(onSave);
    expect(saved.fieldLabels).toEqual({ priority: 'Urgency' });
    expect(saved.fields).toContain('priority');
    expect(retyped).toEqual({});
  });

  it('sets the Assignee’s Notifies with its name', () => {
    const onSave = editor();
    const dialog = openEdit('Assignee');
    fireEvent.click(within(dialog).getByRole('switch', { name: /Notifies/ }));
    fireEvent.change(within(dialog).getByLabelText('Name'), { target: { value: 'Owner' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    const [saved] = saveType(onSave);
    expect(saved.assigneeNotifies).toBe(false);
    expect(saved.fieldLabels).toEqual({ assignee: 'Owner' });
  });

  it('keeps Status’s type: every other tile dimmed, saying why', () => {
    editor();
    const dialog = openEdit('Status');
    expect(within(dialog).getByText('Its states are set in States.')).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('button', { name: /All kinds/ }));
    const number = within(dialog).getByRole('button', { name: /^Number: / });
    expect(number.getAttribute('aria-disabled')).toBe('true');
    expect(number.getAttribute('aria-label')).toMatch(/Status places the card in a column/);
    // Its own tile is open: back on it, it is renamed.
    expect(within(dialog).getByText('Current')).toBeTruthy();
  });

  it('keeps Comments apart: Text is dimmed', () => {
    editor();
    const dialog = openEdit('Comments');
    fireEvent.click(within(dialog).getByRole('button', { name: /All kinds/ }));
    const text = within(dialog).getByRole('button', { name: /^Text: / });
    expect(text.getAttribute('aria-disabled')).toBe('true');
  });

  it('makes it a custom field on another tile, asking first with what stops reading it', () => {
    const onSave = editor();
    const dialog = openEdit('Priority');
    fireEvent.click(within(dialog).getByRole('button', { name: /All kinds/ }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Text' }));
    const status = within(dialog).getByRole('status');
    expect(status.textContent).toContain('2 cards have a value; every one is kept as a Text.');
    expect(status.textContent).toContain('1 filter on it will be removed.');
    expect(status.textContent).toContain('Sprint sorts by Priority');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    // Asked once: Keep Editing goes back to Save.
    fireEvent.click(within(dialog).getByRole('button', { name: 'Keep Editing' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Change Values' }));
    const [saved, retyped] = saveType(onSave);
    expect(saved.fields).not.toContain('priority');
    const made = saved.custom!.find((f) => f.label === 'Priority')!;
    expect(made.kind).toBe('text');
    expect(saved.fields).toContain(made.id);
    expect(retyped).toEqual({ [made.id]: 'priority' });
  });

  it('says nothing else reads it when nothing does, and reopens the new field as a custom one', () => {
    editor();
    setPlan({ planTabs: () => [] });
    const dialog = openEdit('Due Date');
    fireEvent.click(within(dialog).getByRole('button', { name: /All kinds/ }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Text' }));
    expect(within(dialog).getByText('Nothing else in the plan reads it.')).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Change Values' }));
    // The row is the new field now: its pencil opens Edit Field on it, nothing yet lost.
    const again = openEdit('Due Date');
    fireEvent.change(within(again).getByLabelText('Name'), { target: { value: 'When' } });
    fireEvent.click(within(again).getByRole('button', { name: 'Save' }));
    expect(row('When')).toBeTruthy();
  });
});

describe('a type saved with a built-in made a custom field', () => {
  it('moves its values and takes its filters off with the type', () => {
    const saveType = vi.fn<(t: ItemTypeDef, along?: SaveAlong) => void>();
    const reshapeValues = vi.fn((_patches: unknown) => Promise.resolve({ ok: true, step: null }));
    const removeFieldFilters = vi.fn((_targets: unknown) => true);
    setPlan({ canEdit: true, itemTypes: { saveType }, reshapeValues, removeFieldFilters });
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
    const dialog = openEdit('Priority');
    fireEvent.click(within(dialog).getByRole('button', { name: /All kinds/ }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Text' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Change Values' }));
    fireEvent.click(
      within(screen.getByRole('dialog', { name: /Task/ })).getByRole('button', { name: 'Save' }),
    );
    const [saved, along] = saveType.mock.lastCall!;
    const made = saved.custom!.find((f) => f.label === 'Priority')!;
    expect(reshapeValues.mock.lastCall![0]).toEqual([
      { id: CARDS[0]!.id, patch: { set: { [made.id]: 'High' }, clear: ['priority'] } },
      { id: CARDS[1]!.id, patch: { set: { [made.id]: 'Low' }, clear: ['priority'] } },
    ]);
    expect(along!.name).toBe('Priority');
    expect(along!.settle!()).toBe(true);
    expect(removeFieldFilters.mock.lastCall![0]).toEqual([
      expect.objectContaining({ field: 'priority', builtIn: true }),
    ]);
  });

  it('never shows the type editor, so never the pencil, to a Participant or a Viewer', () => {
    setPlan({ canEdit: false, itemTypes: { saveType: vi.fn() } });
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
    expect(screen.queryByRole('button', { name: 'Edit Priority' })).toBeNull();
  });
});
