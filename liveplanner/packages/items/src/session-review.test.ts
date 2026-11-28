import { describe, expect, it } from 'vitest';
import type { ItemTypeDef } from './item-types';
import { DAY_MS } from './plan-view-dates';
import {
  FOLLOW_UP_TITLE_MAX,
  doneRangeFrom,
  followUpFieldOf,
  followUpStatus,
  followUpTitle,
  lastReviewAt,
} from './session-review';

// docs/specs/026-plan/session-tabs.md "Sprint Review": the done range's chips, the last review, where a follow-up
// goes and the field it links through.
const task: ItemTypeDef = {
  id: 'task',
  label: 'Task',
  newTitle: 'New task',
  glyph: 'task',
  color: '#0ea5e9',
  fields: ['title', 'status', 'f-rel', 'f-parent', 'f-epic'],
  statuses: ['todo', 'backlog', 'doing', 'done'],
  custom: [
    { id: 'f-parent', label: 'Parent', kind: 'card', linkType: 'task' },
    { id: 'f-epic', label: 'Related', kind: 'card', linkType: 'epic' },
    {
      id: 'f-rel',
      label: ' Related ',
      kind: 'card',
      linkType: 'task',
      linkTypes: ['task', 'epic'],
    },
    { id: 'f-off', label: 'See Also', kind: 'card', linkType: 'task' },
  ],
};
const NAMES = new Map([
  ['todo', 'To Do'],
  ['backlog', 'Icebox'],
  ['doing', 'Doing'],
  ['done', 'Done'],
]);

describe('doneRangeFrom', () => {
  const now = 100 * DAY_MS;
  it('answers each chip', () => {
    expect(doneRangeFrom('all', now, 5)).toBeUndefined();
    expect(doneRangeFrom('since-last', now, 5)).toBe(5);
    expect(doneRangeFrom('since-last', now, null)).toBeUndefined();
    expect(doneRangeFrom('7', now, 5)).toBe(93 * DAY_MS);
    expect(doneRangeFrom('30', now, null)).toBe(70 * DAY_MS);
  });
});

describe('lastReviewAt', () => {
  it('takes the newest decision of another review', () => {
    const sessions: {
      tabId: string;
      sessionKind: string;
      decided?: Record<string, { at: number }>;
    }[] = [
      { tabId: 'a', sessionKind: 'review', decided: { x: { at: 10 }, y: { at: 40 } } },
      { tabId: 'b', sessionKind: 'review', decided: { x: { at: 90 } } },
      { tabId: 'c', sessionKind: 'planning', decided: { x: { at: 99 } } },
      { tabId: 'd', sessionKind: 'review' },
      { tabId: 'e', sessionKind: 'review', decided: { z: { at: 5 } } },
    ];
    expect(lastReviewAt(sessions)).toBe(90);
    expect(lastReviewAt(sessions, 'b')).toBe(40);
    expect(lastReviewAt([])).toBeNull();
  });
});

describe('followUpFieldOf', () => {
  it('picks a Related-like Card field on the type that links to the card’s type', () => {
    expect(followUpFieldOf(task, 'task')?.id).toBe('f-rel');
    expect(followUpFieldOf(task, 'epic')?.id).toBe('f-epic');
    // See Also is not on the type's fields.
    expect(followUpFieldOf(task, 'bug')).toBeUndefined();
    expect(followUpFieldOf({ ...task, custom: undefined }, 'task')).toBeUndefined();
  });
});

describe('followUpStatus', () => {
  it('finds the first Backlog-like stage by its plan name, else null', () => {
    expect(followUpStatus(task, NAMES)).toBe('backlog');
    expect(followUpStatus({ ...task, statuses: ['todo', 'done'] }, NAMES)).toBeNull();
    // A stage the plan does not name reads by its id.
    expect(
      followUpStatus(
        { ...task, statuses: ['inbox'] },
        new Map([['inbox', undefined as unknown as string]]),
      ),
    ).toBe('inbox');
    expect(followUpStatus({ ...task, statuses: ['ideas'] }, new Map([['ideas', 'Ideas']]))).toBe(
      'ideas',
    );
  });
});

describe('followUpTitle', () => {
  it('keeps one trimmed line within the cap', () => {
    expect(followUpTitle('  Dark\n tooltips  ')).toBe('Dark tooltips');
    expect(followUpTitle('x'.repeat(300))).toHaveLength(FOLLOW_UP_TITLE_MAX);
    expect(followUpTitle('   ')).toBe('');
  });
});
