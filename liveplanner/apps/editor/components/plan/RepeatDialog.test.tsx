// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { RepeatRule } from '@liveplanner/items';
import { RepeatDialog } from './RepeatDialog';
import { draftProblem, draftRule, repeatDraft, toggleDay, untilFor } from './repeat-draft';

// docs/specs/026-plan/items.md "Repeating cards": the Repeat dialog's choices and the rule they save.
afterEach(cleanup);

const TODAY = '2026-11-04'; // a Wednesday
const ZONE = 'Pacific/Auckland';
const STATUSES = [
  { status: 'todo', name: 'To Do' },
  { status: 'doing', name: 'Doing' },
];

function dialog(rule?: RepeatRule) {
  const fns = { onSave: vi.fn(), onStop: vi.fn(), onClose: vi.fn() };
  render(<RepeatDialog rule={rule} statuses={STATUSES} today={TODAY} timeZone={ZONE} {...fns} />);
  return fns;
}
const save = (name = 'Repeat') => fireEvent.click(screen.getByRole('button', { name }));

describe('repeat-draft', () => {
  it('opens on every week on today, or on the card’s rule', () => {
    expect(repeatDraft(undefined, TODAY)).toEqual({
      every: 'week',
      days: [3],
      date: 4,
      until: null,
      status: '',
    });
    const rule: RepeatRule = {
      every: 'month',
      date: 31,
      until: '2027-01-31',
      status: 'doing',
      from: '2026-10-01',
      timeZone: ZONE,
    };
    expect(repeatDraft(rule, TODAY)).toMatchObject({
      every: 'month',
      date: 31,
      until: '2027-01-31',
      status: 'doing',
    });
  });

  it('keeps the last week day ticked and sorts the rest', () => {
    expect(toggleDay([3], 3)).toEqual([3]);
    expect(toggleDay([3], 1)).toEqual([1, 3]);
    expect(toggleDay([1, 3], 3)).toEqual([1]);
  });

  it('seeds an end a month out, refuses one before today, and stamps the saved rule', () => {
    expect(untilFor(true, TODAY)).toBe('2026-12-04');
    expect(untilFor(false, TODAY)).toBeNull();
    const draft = { ...repeatDraft(undefined, TODAY), until: '2026-11-03' };
    expect(draftProblem(draft, TODAY)).toBe('Pick an end day from today on');
    expect(draftRule(draft, TODAY, ZONE)).toBeNull();
    expect(draftRule({ ...draft, until: TODAY, every: 'day' }, TODAY, ZONE)).toEqual({
      every: 'day',
      until: TODAY,
      from: TODAY,
      timeZone: ZONE,
    });
  });
});

describe('RepeatDialog', () => {
  it('saves every week on the days ticked, Monday first', () => {
    const fns = dialog();
    const days = screen
      .getAllByRole('button', { pressed: true })
      .concat(screen.getAllByRole('button', { pressed: false }));
    expect(days.length).toBe(7);
    const week = screen.getByRole('group', { name: 'Days of the week' });
    expect([...week.querySelectorAll('button')].map((b) => b.textContent)).toEqual([
      'Mon',
      'Tue',
      'Wed',
      'Thu',
      'Fri',
      'Sat',
      'Sun',
    ]);
    fireEvent.click(screen.getByRole('button', { name: 'Mon' }));
    fireEvent.click(screen.getByRole('button', { name: 'Wed' }));
    fireEvent.click(screen.getByRole('button', { name: 'Wed' }));
    save();
    expect(fns.onSave).toHaveBeenCalledWith({
      every: 'week',
      days: [1, 3],
      from: TODAY,
      timeZone: ZONE,
    });
  });

  it('saves a month date, an end day and a column, and says a short month uses its last day', () => {
    const fns = dialog();
    fireEvent.click(screen.getByRole('radio', { name: 'Month' }));
    expect(screen.queryByRole('group', { name: 'Days of the week' })).toBeNull();
    fireEvent.change(screen.getByLabelText('On the'), { target: { value: '31' } });
    expect(screen.getByText('A shorter month repeats on its last day.')).toBeTruthy();
    fireEvent.click(screen.getByRole('radio', { name: 'On a date' }));
    fireEvent.change(screen.getByLabelText('Last day'), { target: { value: '2027-03-31' } });
    fireEvent.change(screen.getByLabelText('Lands In'), { target: { value: 'doing' } });
    save();
    expect(fns.onSave).toHaveBeenCalledWith({
      every: 'month',
      date: 31,
      until: '2027-03-31',
      status: 'doing',
      from: TODAY,
      timeZone: ZONE,
    });
  });

  it('refuses an end before today until it is fixed, and goes back to Never', () => {
    const fns = dialog();
    fireEvent.click(screen.getByRole('radio', { name: 'Day' }));
    fireEvent.click(screen.getByRole('radio', { name: 'On a date' }));
    fireEvent.change(screen.getByLabelText('Last day'), { target: { value: '2026-11-01' } });
    expect(screen.getByRole('note').textContent).toBe('Pick an end day from today on');
    expect(screen.getByRole('button', { name: 'Repeat' })).toHaveProperty('disabled', true);
    fireEvent.submit(screen.getByRole('button', { name: 'Repeat' }).closest('form')!);
    expect(fns.onSave).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('radio', { name: 'Never' }));
    // Picking the chosen one again changes nothing.
    fireEvent.click(screen.getByRole('radio', { name: 'Never' }));
    save();
    expect(fns.onSave).toHaveBeenCalledWith({ every: 'day', from: TODAY, timeZone: ZONE });
  });

  it('edits a rule: Save, Stop Repeating, Cancel, and keeps a column no board shows', () => {
    const fns = dialog({
      every: 'weekday',
      status: 'gone',
      from: '2026-10-01',
      timeZone: 'Europe/London',
    });
    expect(screen.getByRole('option', { name: 'gone' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Stop Repeating' }));
    expect(fns.onStop).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(fns.onClose).toHaveBeenCalledOnce();
    save('Save');
    // Saved again, it is stamped with this setter's day and zone.
    expect(fns.onSave).toHaveBeenCalledWith({
      every: 'weekday',
      status: 'gone',
      from: TODAY,
      timeZone: ZONE,
    });
  });
});

describe('RepeatDialog contrast', () => {
  it('draws an unpicked choice above slate-500, which reads 4.3:1 on the slate-100 track', () => {
    dialog();
    for (const name of ['Day', 'Weekday', 'Month', 'On a date']) {
      const classes = screen.getByRole('radio', { name }).className.split(/\s+/);
      expect(classes).not.toContain('text-slate-500');
      expect(classes).toContain('text-slate-600');
    }
  });
});
