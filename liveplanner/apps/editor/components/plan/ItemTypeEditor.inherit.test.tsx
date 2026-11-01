// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ITEM_TYPE_CATALOGUE_VERSION,
  validateItemTypeCatalogue,
  type ItemTypeDef,
} from '@liveplanner/items';
import { ItemTypeEditor, deleteMessage } from './ItemTypeEditor';

// docs/specs/026-plan/item-types.md "Inherited types": Inherits From, inherited fields locked, Detach, and the States
// and Display notices.
const plan: Record<string, unknown> = {};
vi.mock('./PlanContext', () => ({ usePlan: () => plan }));
const tracked = vi.hoisted(() => vi.fn());
vi.mock('@/lib/telemetry', () => ({ track: tracked }));

afterEach(() => {
  cleanup();
  tracked.mockReset();
});

const resolved = (types: readonly unknown[]) => {
  const r = validateItemTypeCatalogue({ version: ITEM_TYPE_CATALOGUE_VERSION, types });
  if (!r.ok) throw new Error(r.reason);
  return r.catalogue.types;
};

const TYPES = resolved([
  {
    id: 'work',
    label: 'Work',
    color: '#71717a',
    glyph: 'task',
    fields: ['description', 'assignee', 'f-area'],
    custom: [{ id: 'f-area', label: 'Area', kind: 'choice', options: ['Web', 'API'] }],
    statuses: ['todo', 'done'],
  },
  {
    id: 'bug',
    label: 'Bug',
    color: '#dc2626',
    glyph: 'bug',
    fields: ['f-severity'],
    custom: [{ id: 'f-severity', label: 'Severity', kind: 'number' }],
    inherits: 'work',
  },
  { id: 'idea', label: 'Idea', color: '#eab308', glyph: 'idea', fields: ['labels'] },
]);
const [WORK, BUG, IDEA] = TYPES as [ItemTypeDef, ItemTypeDef, ItemTypeDef];

function editor(type: ItemTypeDef | null) {
  for (const key of Object.keys(plan)) delete plan[key];
  Object.assign(plan, {
    types: TYPES,
    items: new Map(),
    statusNames: new Map([
      ['todo', 'To Do'],
      ['done', 'Done'],
    ]),
  });
  const onSave = vi.fn();
  render(
    <ItemTypeEditor
      type={type}
      types={TYPES}
      itemCount={0}
      onSave={onSave}
      onDelete={() => {}}
      onClose={() => {}}
    />,
  );
  return onSave;
}

const menu = () => screen.getByLabelText<HTMLSelectElement>('Inherits From');
const row = (name: string) => screen.getByText(name, { selector: 'span.truncate' }).closest('li')!;

describe('Inherits From', () => {
  it('offers None and every type inheriting from none, never the type itself', () => {
    editor(IDEA);
    expect([...menu().options].map((o) => o.textContent)).toEqual(['None', 'Work']);
    expect(menu().value).toBe('');
  });

  it('is disabled on a base type, naming the types inheriting from it', () => {
    editor(WORK);
    expect(menu().disabled).toBe(true);
    expect(screen.getByText('Bug inherits from this type.')).toBeTruthy();
  });

  it('lays the draft out from a chosen base, keeping its own fields, and saves it inheriting', () => {
    const onSave = editor(IDEA);
    fireEvent.change(menu(), { target: { value: 'work' } });
    // Work's fields, locked; Labels, Idea's own, still its own.
    expect(within(row('Area')).getByRole('img', { name: 'Inherited from Work' })).toBeTruthy();
    expect(within(row('Labels')).queryByRole('img', { name: /Inherited/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    const saved = onSave.mock.calls[0]![0] as ItemTypeDef;
    expect(saved).toMatchObject({
      inherits: 'work',
      ownFields: ['labels'],
      statuses: ['todo', 'done'],
    });
    expect(saved.fields).toEqual([...WORK.fields, 'labels']);
    expect(tracked).toHaveBeenCalledWith('Plan', 'Linked', 'CardTypeBase');
  });

  it('moves from one base to another keeping only the type’s own fields', () => {
    const onSave = editor({ ...IDEA, label: 'Spike' });
    fireEvent.change(menu(), { target: { value: 'work' } });
    fireEvent.change(menu(), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    // None keeps the draft as it stood: a copy of Work's fields, now its own.
    const saved = onSave.mock.calls[0]![0] as ItemTypeDef;
    expect(saved.inherits).toBeUndefined();
    expect(saved.fields).toContain('f-area');
  });
});

describe('an inherited type in the editor', () => {
  it('locks its inherited fields: no Edit, no Remove, the lock naming the base', () => {
    editor(BUG);
    expect(menu().value).toBe('work');
    const area = row('Area');
    expect(within(area).getByRole('img', { name: 'Inherited from Work' })).toBeTruthy();
    expect(within(area).queryByRole('button', { name: 'Edit Area' })).toBeNull();
    expect(within(row('Severity')).getByRole('button', { name: 'Edit Severity' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Add Tab' })).toBeNull();
    expect(screen.getByLabelText<HTMLInputElement>('Details name').readOnly).toBe(true);
  });

  it('shows the States and Display notices in place of their controls', () => {
    editor(BUG);
    fireEvent.click(screen.getByRole('tab', { name: 'States' }));
    expect(screen.getByRole('note').textContent).toBe(
      'Bug takes its states from Work. Change them on Work, or Detach to give Bug its own.',
    );
    expect(screen.getByRole('group', { name: 'Work’s states' }).hasAttribute('inert')).toBe(true);
    fireEvent.click(screen.getByRole('tab', { name: 'Display' }));
    expect(screen.getByRole('note').textContent).toContain('Bug takes its display from Work.');
  });

  it('Detach keeps a copy of the base’s settings and saves the type on its own', () => {
    const onSave = editor(BUG);
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Detach: Stop following Work and keep a copy of its settings',
      }),
    );
    expect(menu().value).toBe('');
    expect(within(row('Area')).queryByRole('img', { name: /Inherited/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    const saved = onSave.mock.calls[0]![0] as ItemTypeDef;
    expect(saved.inherits).toBeUndefined();
    expect(saved.fields).toEqual(BUG.fields);
    expect(tracked).toHaveBeenCalledWith('Plan', 'Unlinked', 'CardTypeBase');
  });
});

describe('deleting a base type', () => {
  it('says the types inheriting from it keep a copy of its settings', () => {
    expect(deleteMessage('Work', 0, ['Bug'])).toBe(
      'Delete the Work type? Bug will keep a copy of its settings.',
    );
    expect(deleteMessage('Work', 2, ['Bug', 'Story', 'Spike'])).toBe(
      'Delete the Work type? Its 2 cards will be moved to the Trash too. Bug, Story and Spike will keep a copy of its settings.',
    );
  });
});
