// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PHONE_HINT, type ItemPerson } from '@liveplanner/items';
import { useEscape } from '@liveplanner/ui';
import { AddFieldTryIt, STILL_NOTE } from './AddFieldTryIt';
import type { NewField } from './AddFieldShape';
import { PlanProvider, type PlanContextValue } from './PlanContext';

// docs/specs/026-plan/item-types.md "Fields and Tabs": Add Field, Shape's Try It: the card panel's own editor on a
// pretend card, held here alone.
afterEach(cleanup);

const SAM: ItemPerson = { id: 'sam', name: 'Sam Rivera', color: '#7c3aed' };

// Every way the plan could be written: none may be called.
const WRITES = [
  'addItem',
  'addItems',
  'moveItem',
  'moveItems',
  'patchItem',
  'patchItems',
  'trackTime',
  'deleteItem',
  'trashItem',
  'trashItems',
  'restoreItem',
  'updateBoard',
  'updateView',
  'updateCard',
  'editType',
] as const;

function plan() {
  const writes = Object.fromEntries(WRITES.map((w) => [w, vi.fn()]));
  const value = {
    ...writes,
    items: new Map(),
    types: [],
    people: [SAM],
    canEdit: true,
    canEditCards: true,
    announce: vi.fn(),
  } as unknown as PlanContextValue;
  return { value, writes: Object.values(writes) };
}

// As Shape holds it: inside its form, in a modal whose Escape steps back (AddFieldDialog's, a page-wide listener).
function Harness({ field, onCancel }: { field: NewField; onCancel: () => void }) {
  useEscape(onCancel, { preventDefault: true });
  return (
    <form aria-label="New field">
      <AddFieldTryIt field={field} required={false} />
    </form>
  );
}

function open(field: NewField) {
  const onCancel = vi.fn();
  const p = plan();
  const view = render(
    <PlanProvider value={p.value}>
      <Harness field={field} onCancel={onCancel} />
    </PlanProvider>,
  );
  const rerender = (next: NewField) =>
    view.rerender(
      <PlanProvider value={p.value}>
        <Harness field={next} onCancel={onCancel} />
      </PlanProvider>,
    );
  return { onCancel, writes: p.writes, rerender };
}

const tryIt = () => within(screen.getByRole('figure', { name: 'Try It' }));
const MEAL: NewField = { label: 'Meal', kind: 'choice', options: ['Fish', 'Meat', 'Veg'] };

describe('AddFieldTryIt', () => {
  it("opens a Choice's real list with the options being shaped, and picks one", () => {
    const { writes } = open(MEAL);
    expect(tryIt().getByText('Try It')).toBeTruthy();
    expect(tryIt().getByText('Nothing here is saved')).toBeTruthy();
    fireEvent.click(tryIt().getByRole('button', { name: /^Meal:/ }));
    const list = screen.getByRole('listbox');
    expect(
      within(list)
        .getAllByRole('option')
        .map((o) => o.textContent),
    ).toEqual(['None', 'Fish', 'Meat', 'Veg']);
    fireEvent.click(within(list).getByRole('option', { name: /Meat/ }));
    expect(tryIt().getByRole('button', { name: 'Meal: Meat' })).toBeTruthy();
    for (const w of writes) expect(w).not.toHaveBeenCalled();
  });

  it('closes only the open list on Escape, never the Add Field modal', () => {
    const { onCancel } = open(MEAL);
    fireEvent.click(tryIt().getByRole('button', { name: /^Meal:/ }));
    act(() => {
      screen
        .getByRole('listbox')
        .dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('says why a Phone box refuses what was typed, and takes a real number', () => {
    const { writes } = open({ label: 'Mobile', kind: 'phone' });
    const box = tryIt().getByRole('textbox', { name: 'Mobile' }) as HTMLInputElement;
    fireEvent.change(box, { target: { value: 'call me' } });
    fireEvent.blur(box);
    expect(tryIt().getByRole('alert').textContent).toBe(`Mobile: ${PHONE_HINT}.`);
    expect(box.value).toBe('');
    fireEvent.change(box, { target: { value: '+44 20 7946 0958' } });
    fireEvent.blur(box);
    expect(tryIt().queryByRole('alert')).toBeNull();
    expect(tryIt().getByRole('link', { name: 'Call +44 20 7946 0958' })).toBeTruthy();
    for (const w of writes) expect(w).not.toHaveBeenCalled();
  });

  it('says why an Email or a Link is refused', () => {
    open({ label: 'Contact', kind: 'email' });
    const email = tryIt().getByRole('textbox', { name: 'Contact' });
    fireEvent.change(email, { target: { value: 'sam' } });
    fireEvent.blur(email);
    expect(tryIt().getByRole('alert').textContent).toContain('email address');
    cleanup();
    open({ label: 'Site', kind: 'link' });
    const link = tryIt().getByRole('textbox', { name: 'Site' });
    fireEvent.change(link, { target: { value: 'example.com' } });
    fireEvent.blur(link);
    expect(tryIt().getByRole('alert').textContent).toContain('https://');
  });

  it('keeps Enter in a box from submitting the Shape form', () => {
    open({ label: 'Mobile', kind: 'phone' });
    const box = tryIt().getByRole('textbox', { name: 'Mobile' });
    // fireEvent answers false when the default (the form's implicit submit) was prevented.
    expect(fireEvent.keyDown(box, { key: 'Enter' })).toBe(false);
  });

  it("opens a Person's picker on the plan's people", () => {
    const { writes, onCancel } = open({ label: 'Reviewer', kind: 'person' });
    fireEvent.click(tryIt().getByRole('button', { name: /^Reviewer:/ }));
    const list = screen.getByRole('listbox', { name: 'Reviewer' });
    fireEvent.click(within(list).getByRole('option', { name: /Sam Rivera/ }));
    expect(tryIt().getByText('Sam Rivera')).toBeTruthy();
    for (const w of writes) expect(w).not.toHaveBeenCalled();
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('toggles a Checkbox', () => {
    open({ label: 'Signed Off', kind: 'checkbox' });
    const box = tryIt().getByRole('checkbox', { name: 'Signed Off' }) as HTMLInputElement;
    fireEvent.click(box);
    expect(box.checked).toBe(true);
  });

  it('starts again when a setting that shapes it changes, never when it is renamed', () => {
    const { rerender } = open(MEAL);
    fireEvent.click(tryIt().getByRole('button', { name: /^Meal:/ }));
    fireEvent.click(within(screen.getByRole('listbox')).getByRole('option', { name: /Fish/ }));
    rerender({ ...MEAL, label: 'Main', required: true });
    expect(tryIt().getByRole('button', { name: 'Main: Fish' })).toBeTruthy();
    rerender({ ...MEAL, label: 'Main', options: ['Fish', 'Veg'] });
    expect(tryIt().getByRole('button', { name: 'Main: None' })).toBeTruthy();
  });

  it('keeps the still preview, saying so, for the kinds that need a real card', () => {
    for (const field of [
      { label: 'Parent', kind: 'card', linkTypes: ['epic'] },
      { label: 'Total', kind: 'calculated', calculation: 'children' },
      { label: 'Photo', kind: 'image' },
      { label: 'Spent', kind: 'duration', timeSpent: true },
    ] as NewField[]) {
      open(field);
      const still = within(screen.getByRole('figure', { name: 'Preview' }));
      expect(still.getByText(STILL_NOTE)).toBeTruthy();
      expect(screen.queryByRole('figure', { name: 'Try It' })).toBeNull();
      cleanup();
    }
  });
});
