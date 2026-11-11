import { describe, expect, it } from 'vitest';
import { timeCards, type TimeCardsContext } from './time-cards';
import { OUTLINE, ZONE, bug } from './test-fixtures';
import { automationPerson, type AutomationCondition } from './types';
import type { AutomationTimeTrigger } from './schedule';

// docs/specs/026-plan/automations.md "Time triggers": the cards a moment runs on, at most 100, due first; Due In and
// Overdue once per card per due date, re-armed by a moved date; Done never overdue.
const MOMENT = Date.parse('2026-11-11T09:00:00Z');
const ctx: TimeCardsContext = {
  outline: OUTLINE,
  by: automationPerson('Nudge'),
  role: 'system',
  timeZone: ZONE,
  isDone: (s) => s === 'done',
};
const rule = (trigger: AutomationTimeTrigger, conditions: AutomationCondition[] = []) => ({
  id: 'r1',
  trigger,
  conditions,
});

describe('timeCards', () => {
  it('runs a Scheduled rule on every live card its conditions match, one id per moment', () => {
    const a = bug({ priority: 'high' });
    const b = bug();
    const gone = bug({ status: 'trash', priority: 'high' });
    const archived = bug({ archived: true, priority: 'high' });
    const r = timeCards(
      rule({ kind: 'scheduled', every: 'day', at: '09:00' }, [
        { kind: 'field', field: 'priority', op: 'is', value: 'high' },
      ]),
      [a, b, gone, archived],
      MOMENT,
      ctx,
    );
    expect(r).toEqual({
      cards: [{ card: a, eventId: `t:r1:2026-11-11:09:00:${a.id}` }],
      matched: 1,
    });
  });

  it('runs Due In on the cards due that many days after the moment’s day', () => {
    const due = bug({ due: '2026-11-13' });
    const later = bug({ due: '2026-11-14' });
    const none = bug();
    const r = timeCards(
      rule({ kind: 'due_in', days: 2, at: '09:00' }),
      [due, later, none],
      MOMENT,
      ctx,
    );
    expect(r.cards).toEqual([{ card: due, eventId: `d:r1:${due.id}:2026-11-13` }]);
  });

  it('runs Overdue on cards due before the day and outside a done column', () => {
    const late = bug({ due: '2026-11-09' });
    const today = bug({ due: '2026-11-11' });
    const doneLate = bug({ due: '2026-11-01', status: 'done' });
    const noDue = bug();
    const r = timeCards(
      rule({ kind: 'overdue', at: '09:00' }),
      [late, today, doneLate, noDue],
      MOMENT,
      ctx,
    );
    expect(r.cards.map((c) => c.eventId)).toEqual([`d:r1:${late.id}:2026-11-09`]);
    // A moved due date is a new id (fires again); moved back, the old id (already ran).
    const moved = { ...late, fields: { ...late.fields, due: '2026-11-10' } };
    expect(
      timeCards(rule({ kind: 'overdue', at: '09:00' }), [moved], MOMENT, ctx).cards[0]!.eventId,
    ).toBe(`d:r1:${late.id}:2026-11-10`);
  });

  it('takes the 100 due first, then the oldest, and says how many matched', () => {
    const cards = Array.from({ length: 150 }, (_, i) =>
      bug(i % 2 ? { due: `2026-11-${String(10 + (i % 3)).padStart(2, '0')}` } : {}, {
        key: 500 - i,
      }),
    );
    const r = timeCards(rule({ kind: 'scheduled', every: 'day', at: '09:00' }), cards, MOMENT, ctx);
    expect(r.matched).toBe(150);
    expect(r.cards).toHaveLength(100);
    // Every card with a due date (75) comes before any without.
    expect(r.cards.slice(0, 75).every((c) => c.card.fields['due'] !== undefined)).toBe(true);
    expect(r.cards[0]!.card.fields['due']).toBe('2026-11-10');
    const undated = r.cards.slice(75).map((c) => c.card.key);
    expect(undated).toEqual([...undated].sort((x, y) => x - y));
  });
});
