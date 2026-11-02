// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CustomFieldDef } from '@liveplanner/items';
import { SetFieldMenu, fieldValueOf } from './SelectionBarMenus';
import type { SetFieldKind } from './board-selection-edits';

// docs/specs/026-plan/plan-board.md "Several cards at once": Set Field's value, as the field keeps it.
afterEach(cleanup);

const f = (kind: SetFieldKind, extra: Partial<CustomFieldDef> = {}) =>
  ({ id: `f-${kind}`, label: kind, kind, ...extra }) as CustomFieldDef & { kind: SetFieldKind };
const ann = { id: 'ann', name: 'Ann', color: '#ff0000' };

describe('fieldValueOf', () => {
  it('reads words, a day, a number and a percent', () => {
    expect(fieldValueOf(f('text'), '  hi ')).toBe('hi');
    expect(fieldValueOf(f('text'), '  ')).toBeUndefined();
    expect(fieldValueOf(f('date'), '2026-11-01')).toBe('2026-11-01');
    expect(fieldValueOf(f('date'), 'soon')).toBeUndefined();
    expect(fieldValueOf(f('number'), '4.5')).toBe(4.5);
    expect(fieldValueOf(f('currency'), 'x')).toBeUndefined();
    expect(fieldValueOf(f('number'), '')).toBeUndefined();
    expect(fieldValueOf(f('percent'), '140')).toBe(100);
    expect(fieldValueOf(f('percent'), '-3')).toBe(0);
  });
});

describe('SetFieldMenu', () => {
  const menu = (fields: (CustomFieldDef & { kind: SetFieldKind })[]) => {
    const onPick = vi.fn();
    render(<SetFieldMenu fields={fields} people={[ann]} onPick={onPick} />);
    return onPick;
  };
  const press = (name: string | RegExp) => fireEvent.click(screen.getByRole('button', { name }));

  it('says when the cards share no field', () => {
    menu([]);
    expect(screen.getByText('The selected cards share no field to set.')).toBeTruthy();
  });

  it('picks a checkbox, a rating and a person value', () => {
    const onPick = menu([f('checkbox'), f('rating', { scale: 3 }), f('person')]);
    press('checkbox');
    press('No');
    expect(onPick).toHaveBeenLastCalledWith('f-checkbox', false);
    press(/^Set Field/);
    press('rating');
    press('2 of 3');
    expect(onPick).toHaveBeenLastCalledWith('f-rating', 2);
    press(/^Set Field/);
    press('person');
    press(/Ann/);
    expect(onPick).toHaveBeenLastCalledWith('f-person', ann);
  });

  it('types a date, saves it with Enter, and clears a typed field', () => {
    const onPick = menu([f('date'), f('choice')]);
    press('date');
    const box = screen.getByLabelText('date');
    fireEvent.change(box, { target: { value: '2026-11-02' } });
    fireEvent.submit(box.closest('form')!);
    expect(onPick).toHaveBeenLastCalledWith('f-date', '2026-11-02');
    fireEvent.change(box, { target: { value: '' } });
    fireEvent.submit(box.closest('form')!);
    expect(onPick).toHaveBeenCalledTimes(1);
    press('Clear');
    expect(onPick).toHaveBeenLastCalledWith('f-date', null);
    press(/^Set Field/);
    press('choice');
    // A choice field with no options offers Clear alone.
    expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual([
      expect.stringContaining('Set Field'),
      'Clear',
    ]);
  });
});
