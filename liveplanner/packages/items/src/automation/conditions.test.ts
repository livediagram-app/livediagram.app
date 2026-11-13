import { describe, expect, it } from 'vitest';
import { allHold, automationDayWords, holds, type ConditionContext } from './conditions';
import type { AutomationCondition } from './types';
import { ALI, NOW, OUTLINE, SAM, ZONE, bug } from './test-fixtures';
import { item } from '../test-items';

// docs/specs/026-plan/automations.md "Conditions".
const ctx = (fields = {}, extra: Partial<ConditionContext> = {}): ConditionContext => ({
  card: bug(fields),
  outline: OUTLINE,
  by: SAM,
  role: 'editor',
  now: NOW,
  timeZone: ZONE,
  ...extra,
});
const ok = (c: AutomationCondition, fields = {}, extra: Partial<ConditionContext> = {}) =>
  holds(c, ctx(fields, extra)).ok;

describe('Card Type and Column', () => {
  it('holds for a type or column in the list, and the opposite with not', () => {
    expect(holds({ kind: 'type', types: ['bug'] }, ctx())).toEqual({
      ok: true,
      text: 'Card Type is Bug (Bug)',
    });
    expect(ok({ kind: 'type', not: true, types: ['bug', 'note'] })).toBe(false);
    expect(holds({ kind: 'column', statuses: ['todo', 'done'] }, ctx())).toEqual({
      ok: true,
      text: 'Column is To Do or Done (To Do)',
    });
    expect(ok({ kind: 'column', not: true, statuses: ['done'] })).toBe(true);
    expect(holds({ kind: 'column', statuses: ['done'] }, ctx({ status: undefined })).text).toBe(
      'Column is Done (none)',
    );
  });

  it('does not hold when it names a type or column that is gone', () => {
    expect(holds({ kind: 'type', not: true, types: ['epic'] }, ctx())).toEqual({
      ok: false,
      text: 'Card Type is not epic (epic is gone)',
      gone: { kind: 'type', id: 'epic' },
    });
    expect(holds({ kind: 'column', statuses: ['qa'] }, ctx()).gone).toEqual({
      kind: 'column',
      id: 'qa',
    });
  });

  it('records every gone thing a condition names, each once', () => {
    expect(holds({ kind: 'type', types: ['epic', 'bug', 'saga', 'epic'] }, ctx())).toEqual({
      ok: false,
      text: 'Card Type is epic or Bug or saga or epic (epic, saga are gone)',
      gone: { kind: 'type', id: 'epic', more: ['saga'] },
    });
    expect(holds({ kind: 'column', statuses: ['qa', 'done', 'later'] }, ctx()).gone).toEqual({
      kind: 'column',
      id: 'qa',
      more: ['later'],
    });
    expect(
      holds({ kind: 'who', who: [{ person: 'p1' }, { role: 'agent' }, { person: 'p2' }] }, ctx())
        .gone,
    ).toEqual({ kind: 'person', id: 'p1', more: ['p2'] });
  });
});

describe('Field', () => {
  it('compares is and is not, case aside, a person by id or name, a list as a set', () => {
    expect(holds({ kind: 'field', field: 'f-severity', op: 'is', value: 'high' }, ctx())).toEqual({
      ok: true,
      text: 'Severity is high (High)',
    });
    expect(ok({ kind: 'field', field: 'f-severity', op: 'is_not', value: 'Low' })).toBe(true);
    expect(
      ok({ kind: 'field', field: 'assignee', op: 'is', value: 'p-sam' }, { assignee: SAM }),
    ).toBe(true);
    expect(
      ok({ kind: 'field', field: 'assignee', op: 'is', value: 'ali' }, { assignee: SAM }),
    ).toBe(false);
    expect(
      ok({ kind: 'field', field: 'labels', op: 'is', value: ['a', 'B'] }, { labels: ['b', 'a'] }),
    ).toBe(true);
    expect(
      ok({ kind: 'field', field: 'labels', op: 'is', value: ['a'] }, { labels: ['a', 'b'] }),
    ).toBe(false);
    expect(
      ok({ kind: 'field', field: 'labels', op: 'is', value: ['a', 'c'] }, { labels: ['a', 'b'] }),
    ).toBe(false);
    expect(ok({ kind: 'field', field: 'estimate', op: 'is', value: 3 }, { estimate: 3 })).toBe(
      true,
    );
    expect(ok({ kind: 'field', field: 'estimate', op: 'is', value: 3 }, { estimate: '3' })).toBe(
      false,
    );
    expect(ok({ kind: 'field', field: 'f-severity', op: 'is', value: { today: 0 } })).toBe(false);
  });

  it('compares contains in text and in lists', () => {
    expect(ok({ kind: 'field', field: 'title', op: 'contains', value: 'LOGIN' })).toBe(true);
    expect(ok({ kind: 'field', field: 'title', op: 'not_contains', value: 'crash' })).toBe(true);
    expect(
      ok({ kind: 'field', field: 'labels', op: 'contains', value: ['a'] }, { labels: ['a', 'b'] }),
    ).toBe(true);
    expect(
      ok({ kind: 'field', field: 'labels', op: 'contains', value: 'z' }, { labels: ['a'] }),
    ).toBe(false);
    expect(
      ok({ kind: 'field', field: 'estimate', op: 'contains', value: 5 }, { estimate: 5 }),
    ).toBe(true);
    expect(
      ok(
        { kind: 'field', field: 'labels', op: 'contains', value: ['a'] },
        { labels: [null, ['a']] },
      ),
    ).toBe(true);
    expect(ok({ kind: 'field', field: 'labels', op: 'is', value: 'a' }, { labels: null })).toBe(
      false,
    );
  });

  it('names a priority by its label, as the rule sentence does', () => {
    expect(
      holds(
        { kind: 'field', field: 'priority', op: 'is', value: 'high' },
        ctx({ priority: 'medium' }),
      ).text,
    ).toBe('Priority is High (Medium)');
    expect(
      holds(
        { kind: 'field', field: 'priority', op: 'is', value: ['urgent', 'low'] },
        ctx({ priority: 'low' }),
      ).text,
    ).toBe('Priority is Urgent, Low (Low)');
  });

  it('compares empty and not empty, a false flag as empty', () => {
    expect(holds({ kind: 'field', field: 'due', op: 'empty' }, ctx()).text).toBe(
      'Deadline is empty (empty)',
    );
    expect(ok({ kind: 'field', field: 'due', op: 'not_empty' }, { due: '2026-11-11' })).toBe(true);
    expect(ok({ kind: 'field', field: 'flagged', op: 'empty' }, { flagged: false })).toBe(true);
    expect(ok({ kind: 'field', field: 'flagged', op: 'not_empty' }, { flagged: false })).toBe(
      false,
    );
  });

  it('compares days with a day or today ± days', () => {
    const due = { due: '2026-11-11' };
    expect(
      holds({ kind: 'field', field: 'due', op: 'before', value: { today: 1 } }, ctx(due)),
    ).toEqual({
      ok: true,
      text: 'Deadline is before Today + 1 day (11 Nov 2026)',
    });
    expect(ok({ kind: 'field', field: 'due', op: 'after', value: { today: -2 } }, due)).toBe(true);
    expect(ok({ kind: 'field', field: 'due', op: 'on_or_before', value: { today: 0 } }, due)).toBe(
      true,
    );
    expect(
      ok({ kind: 'field', field: 'due', op: 'on_or_after', value: { day: '2026-11-12' } }, due),
    ).toBe(false);
    expect(ok({ kind: 'field', field: 'due', op: 'before', value: { today: 1 } })).toBe(false);
    expect(ok({ kind: 'field', field: 'due', op: 'before', value: { day: 'bad' } }, due)).toBe(
      false,
    );
    expect(ok({ kind: 'field', field: 'due', op: 'before', value: 'x' }, due)).toBe(false);
  });

  it('compares numbers with less than and more than', () => {
    expect(
      ok({ kind: 'field', field: 'estimate', op: 'less_than', value: 5 }, { estimate: 3 }),
    ).toBe(true);
    expect(
      ok({ kind: 'field', field: 'estimate', op: 'more_than', value: 5 }, { estimate: 3 }),
    ).toBe(false);
    expect(ok({ kind: 'field', field: 'estimate', op: 'more_than', value: 5 })).toBe(false);
  });

  it('does not hold on a field that is gone or that the card type lacks', () => {
    expect(holds({ kind: 'field', field: 'f-gone', op: 'empty' }, ctx()).text).toBe(
      'f-gone is empty (f-gone is gone)',
    );
    const note = item({ title: 'n', status: 'todo' }, { type: 'note' });
    expect(
      holds({ kind: 'field', field: 'f-points', op: 'is', value: 1 }, ctx({}, { card: note })),
    ).toEqual({
      ok: false,
      text: 'Points is 1 (a Note card has no Points)',
    });
  });
});

describe('Who Did It', () => {
  it('holds for a chosen person or a role, and its opposite with not', () => {
    expect(holds({ kind: 'who', who: [{ person: 'p-sam' }] }, ctx())).toEqual({
      ok: true,
      text: 'Who Did It is Sam Lee (Sam Lee)',
    });
    expect(
      ok({ kind: 'who', who: [{ role: 'participant' }] }, {}, { role: 'participant', by: ALI }),
    ).toBe(true);
    expect(
      holds({ kind: 'who', not: true, who: [{ role: 'editor' }, { role: 'agent' }] }, ctx()).text,
    ).toBe('Who Did It is not an Editor or an agent (Sam Lee)');
    expect(ok({ kind: 'who', not: true, who: [{ role: 'editor' }] })).toBe(false);
  });

  it('does not hold when the person is gone', () => {
    expect(holds({ kind: 'who', who: [{ person: 'p-gone' }] }, ctx())).toEqual({
      ok: false,
      text: 'Who Did It is p-gone (p-gone is gone)',
      gone: { kind: 'person', id: 'p-gone' },
    });
  });
});

describe('Matches a Saved Filter', () => {
  it('applies the filter as the person who made the change sees it', () => {
    expect(
      holds({ kind: 'saved_filter', tab: 't1', filter: 'sf-mine' }, ctx({ assignee: SAM })),
    ).toEqual({
      ok: true,
      text: 'Matches Saved Filter Mine (it does)',
    });
    expect(
      ok({ kind: 'saved_filter', tab: 't1', filter: 'sf-mine' }, { assignee: SAM }, { by: ALI }),
    ).toBe(false);
    expect(ok({ kind: 'saved_filter', tab: 't1', filter: 'sf-high' }, { priority: 'high' })).toBe(
      true,
    );
    expect(
      holds({ kind: 'saved_filter', tab: 't1', filter: 'sf-high' }, ctx({ priority: 'low' })).text,
    ).toBe('Matches Saved Filter High (it does not)');
  });

  it('does not hold when the filter is gone', () => {
    expect(holds({ kind: 'saved_filter', tab: 't2', filter: 'sf-mine' }, ctx())).toEqual({
      ok: false,
      text: 'Matches a Saved Filter (sf-mine is gone)',
      gone: { kind: 'filter', id: 'sf-mine' },
    });
  });
});

describe('allHold', () => {
  it('holds only when every condition does, with a line each', () => {
    const r = allHold(
      [
        { kind: 'type', types: ['bug'] },
        { kind: 'column', statuses: ['done'] },
      ],
      ctx(),
    );
    expect(r.ok).toBe(false);
    expect(r.lines.map((l) => l.ok)).toEqual([true, false]);
    expect(allHold([], ctx()).ok).toBe(true);
  });
});

describe('automationDayWords', () => {
  it('says Today, Today ± days, or the day', () => {
    expect(automationDayWords({ today: 0 })).toBe('Today');
    expect(automationDayWords({ today: -3 })).toBe('Today - 3 days');
    expect(automationDayWords({ day: '2026-11-11' })).toBe('11 Nov 2026');
  });
});
