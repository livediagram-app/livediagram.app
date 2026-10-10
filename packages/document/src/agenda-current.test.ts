import { describe, expect, it } from 'vitest';
import {
  agendaOwnsTimer,
  agendaRemainingMs,
  followAgendaCurrent,
  moveAgendaCurrent,
  removeAgendaCurrent,
  type TabTimer,
} from './index';

// docs/specs/012-collaboration/agenda.md "The current segment".
describe('agenda current segment', () => {
  it('travels with its row when rows move', () => {
    // Rows A B C D, C (2) current.
    expect(moveAgendaCurrent(2, 2, 0)).toBe(0); // C moved up to the top
    expect(moveAgendaCurrent(2, 3, 2)).toBe(3); // D moved above C
    expect(moveAgendaCurrent(2, 1, 2)).toBe(1); // B moved below C
    expect(moveAgendaCurrent(2, 0, 1)).toBe(2); // A and B swap, above C
    expect(moveAgendaCurrent(undefined, 0, 1)).toBeUndefined();
  });

  it('is cleared when its row is removed, and shifts when a row above goes', () => {
    expect(removeAgendaCurrent(2, 2)).toBeUndefined();
    expect(removeAgendaCurrent(2, 0)).toBe(1);
    expect(removeAgendaCurrent(2, 3)).toBe(2);
  });

  it('follows its row into another list of rows, or clears', () => {
    const a = { label: 'A', minutes: 5 };
    const b = { label: 'B', minutes: 10 };
    const c = { label: 'C', minutes: 5 };
    expect(followAgendaCurrent(1, [a, b, c], [a, b])).toBe(1);
    expect(followAgendaCurrent(1, [a, b, c], [b, a, c])).toBe(0);
    expect(followAgendaCurrent(2, [a, b, c], [a, b])).toBeUndefined();
    expect(followAgendaCurrent(1, [a, b], [a, { label: 'B', minutes: 15 }])).toBeUndefined();
  });

  it('owns the tab timer only while it is the countdown the segment started', () => {
    const el = { agendaCurrent: 0, agendaTimerStartedAt: 100 };
    const timer: TabTimer = {
      mode: 'countdown',
      running: true,
      durationMs: 60_000,
      anchorAt: 60_100,
      startedAt: 100,
    };
    expect(agendaOwnsTimer(el, timer)).toBe(true);
    expect(agendaRemainingMs(el, timer, 30_100)).toBe(30_000);
    expect(agendaRemainingMs(el, { ...timer, startedAt: 200 }, 30_100)).toBeNull();
    expect(agendaRemainingMs(el, { ...timer, mode: 'stopwatch' }, 30_100)).toBeNull();
    // A timer from before startedAt existed, or a segment from before the stamp.
    expect(agendaRemainingMs(el, { ...timer, startedAt: undefined }, 30_100)).toBeNull();
    expect(agendaRemainingMs({ agendaCurrent: 0 }, timer, 30_100)).toBeNull();
    expect(agendaRemainingMs(el, undefined, 30_100)).toBeNull();
  });
});
