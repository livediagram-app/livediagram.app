import { describe, expect, it } from 'vitest';
import { calendarFieldOf, calendarMove } from './calendar-move';
import { calendarModel } from './plan-view-charts';
import { dayNumber } from './plan-view-dates';
import { viewNeeds } from './plan-views';
import { item } from './test-items';

// docs/specs/026-plan/plan-views.md "Moving a card on a calendar".
const day = (iso: string) => dayNumber(iso)!;

describe('calendarMove on a Due Calendar', () => {
  it('moves only the Due when the card has no Start', () => {
    expect(calendarMove(item({ due: '2026-10-05' }), 'due', day('2026-10-14'))).toEqual({
      set: { due: '2026-10-14' },
      days: 9,
    });
  });

  it('keeps the Start while the Due stays on or after it', () => {
    const card = item({ start: '2026-10-01', due: '2026-10-05' });
    expect(calendarMove(card, 'due', day('2026-10-20'))!.set).toEqual({ due: '2026-10-20' });
    expect(calendarMove(card, 'due', day('2026-10-01'))!.set).toEqual({ due: '2026-10-01' });
  });

  it('shifts the Start by the same days when the Due would fall before it', () => {
    const card = item({ start: '2026-10-03', due: '2026-10-05' });
    expect(calendarMove(card, 'due', day('2026-09-30'))).toEqual({
      set: { due: '2026-09-30', start: '2026-09-28' },
      days: -5,
    });
  });

  it('never leaves a Start after the Due, even from dates the wrong way round', () => {
    const card = item({ start: '2026-10-10', due: '2026-10-05' });
    expect(calendarMove(card, 'due', day('2026-10-04'))!.set).toEqual({
      due: '2026-10-04',
      start: '2026-10-04',
    });
  });

  it('crosses months and years', () => {
    expect(calendarMove(item({ due: '2026-12-31' }), 'due', day('2027-01-02'))!.set).toEqual({
      due: '2027-01-02',
    });
  });

  it('does nothing on the same day, without a date, or for a day that is not whole', () => {
    expect(calendarMove(item({ due: '2026-10-05' }), 'due', day('2026-10-05'))).toBeNull();
    expect(calendarMove(item({ title: 'x' }), 'due', day('2026-10-05'))).toBeNull();
    expect(calendarMove(item({ due: 'soon' }), 'due', day('2026-10-05'))).toBeNull();
    expect(calendarMove(item({ due: '2026-10-05' }), 'due', 1.5)).toBeNull();
  });
});

describe('calendarMove on a Start Calendar', () => {
  it('moves the Start and keeps a Due still after it', () => {
    const card = item({ start: '2026-10-01', due: '2026-10-10' });
    expect(calendarMove(card, 'start', day('2026-10-08'))!.set).toEqual({ start: '2026-10-08' });
  });

  it('shifts the Due by the same days when the Start would pass it', () => {
    const card = item({ start: '2026-10-01', due: '2026-10-03' });
    expect(calendarMove(card, 'start', day('2026-10-06'))).toEqual({
      set: { start: '2026-10-06', due: '2026-10-08' },
      days: 5,
    });
  });

  it('never leaves a Due before the Start, even from dates the wrong way round', () => {
    const card = item({ start: '2026-10-10', due: '2026-10-01' });
    expect(calendarMove(card, 'start', day('2026-10-12'))!.set).toEqual({
      start: '2026-10-12',
      due: '2026-10-12',
    });
  });
});

describe('the Start Calendar', () => {
  it('places cards by Start and needs a Start field', () => {
    expect(calendarFieldOf('calendar')).toBe('due');
    expect(calendarFieldOf('start-calendar')).toBe('start');
    expect(calendarFieldOf('gantt')).toBeUndefined();
    expect(viewNeeds('start-calendar')).toEqual(['start']);
    const a = item({ title: 'a', start: '2026-10-05', due: '2026-10-20' });
    const b = item({ title: 'b', due: '2026-10-05' });
    const m = calendarModel([a, b], new Map(), 2026, 9, 'start');
    expect(m.count).toBe(1);
    expect(m.weeks[1]![0]!.cards.map((c) => c.item.id)).toEqual([a.id]);
  });
});
