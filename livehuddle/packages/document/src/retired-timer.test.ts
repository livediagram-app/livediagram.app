import { describe, expect, it } from 'vitest';
import { dropRetiredTimer } from './retired-timer';
import { migrateStoredTab } from './stored-tab';

// docs/specs/012-collaboration/session-tools.md "A tab saved with a timer": it still opens, without the timer.
const oldTimer = {
  mode: 'countdown',
  running: true,
  durationMs: 300_000,
  anchorAt: 1,
  startedAt: 1,
};

describe('dropRetiredTimer', () => {
  it('hands back the same tab when it carries no timer', () => {
    const tab = { id: 't', name: 'T', elements: [] };
    expect(dropRetiredTimer(tab)).toBe(tab);
  });

  it('drops a stored timer, whatever it holds, and keeps the rest', () => {
    for (const timer of [oldTimer, { mode: 'stopwatch', running: false, frozenMs: 0 }, 'x', null]) {
      expect(dropRetiredTimer({ id: 't', name: 'T', elements: [], timer })).toEqual({
        id: 't',
        name: 'T',
        elements: [],
      });
    }
  });

  it('runs in the stored-tab migration, beside the retired vote', () => {
    const tab = { id: 't', name: 'T', elements: [], timer: oldTimer, vote: { active: true } };
    const out = migrateStoredTab(tab as never) as unknown as Record<string, unknown>;
    expect('timer' in out).toBe(false);
    expect('vote' in out).toBe(false);
  });
});
