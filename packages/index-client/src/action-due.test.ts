import { describe, expect, it } from 'vitest';
import { actionDueWords, dueDayOf } from './action-due';

// Noon on Thursday 26 November 2026, local time.
const NOW = new Date(2026, 10, 26, 12).getTime();

describe('an action’s due day', () => {
  it('reads only a real calendar day', () => {
    expect(dueDayOf('2026-12-03')?.getDate()).toBe(3);
    expect(dueDayOf('2026-02-30')).toBeNull();
    expect(dueDayOf('3 Dec')).toBeNull();
    expect(dueDayOf(undefined)).toBeNull();
    expect(actionDueWords(null, NOW)).toBeNull();
  });

  it('says today and tomorrow, then the day, with the year only when it is another', () => {
    expect(actionDueWords('2026-11-26', NOW)).toEqual({ text: 'Due today', tone: 'soon' });
    expect(actionDueWords('2026-11-27', NOW)).toEqual({ text: 'Due tomorrow', tone: 'soon' });
    expect(actionDueWords('2026-12-03', NOW)).toEqual({ text: 'Due Thu 3 Dec', tone: 'later' });
    expect(actionDueWords('2027-01-05', NOW)?.text).toBe('Due Tue 5 Jan 2027');
  });

  it('marks a day gone by as past', () => {
    expect(actionDueWords('2026-11-20', NOW)).toEqual({ text: 'Due Fri 20 Nov', tone: 'past' });
  });
});
