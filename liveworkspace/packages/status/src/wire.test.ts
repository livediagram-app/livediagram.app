import { describe, expect, it } from 'vitest';
import {
  addDays,
  dayOf,
  dayUptime,
  dayStart,
  emptyHistory,
  parseStatusHistory,
  sliceHistory,
  type StatusHistory,
} from './wire';

// liveworkspace/docs/status.md "The read API".

const NOW = Date.parse('2026-10-25T09:07:00Z');

function history(): StatusHistory {
  const days = 5;
  return {
    v: 1,
    at: NOW,
    from: '2026-10-21',
    days,
    latest: { 'liveworkspace:site': ['u', 200, 84] },
    services: {
      'liveworkspace:site': { p: 99.16, w: 'ud-su', u: [[1, 958]] },
    },
    incidents: [
      [
        'liveworkspace:site',
        dayStart('2026-10-22') + 3_600_000,
        dayStart('2026-10-22') + 7_200_000,
        'd',
        1,
        'timeout',
      ],
      ['liveworkspace:site', dayStart('2026-10-24'), null, 's', 3, null],
    ],
  };
}

describe('dayUptime', () => {
  it('is 1000 for a day with checks unless it is listed, and null without checks', () => {
    const s = history().services['liveworkspace:site']!;
    expect([0, 1, 2, 3, 4].map((i) => dayUptime(s, i))).toEqual([1000, 958, null, 1000, 1000]);
    expect(dayUptime(s, 9)).toBeNull();
  });
});

describe('days', () => {
  it('counts UTC days', () => {
    expect(dayOf(NOW)).toBe('2026-10-25');
    expect(addDays('2026-10-25', -89)).toBe('2026-07-28');
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01');
    expect(dayStart('2026-10-25')).toBe(Date.parse('2026-10-25T00:00:00Z'));
  });
});

describe('sliceHistory', () => {
  it('keeps the last days, their uptime and the incidents that touch them', () => {
    const sliced = sliceHistory(history(), 2);
    expect(sliced.from).toBe('2026-10-24');
    expect(sliced.days).toBe(2);
    expect(sliced.services['liveworkspace:site']).toEqual({ p: 100, w: 'su', u: [] });
    // The days under 100% move with the window.
    expect(sliceHistory(history(), 4).services['liveworkspace:site']).toEqual({
      p: 98.6,
      w: 'd-su',
      u: [[0, 958]],
    });
    expect(sliced.incidents).toHaveLength(1);
  });

  it('never widens the window, and keeps at least a day', () => {
    expect(sliceHistory(history(), 400)).toEqual(history());
    expect(sliceHistory(history(), 0).days).toBe(1);
  });

  it('leaves the uptime null over days without checks', () => {
    const h = history();
    h.services['liveworkspace:site'] = { p: null, w: '-----', u: [] };
    expect(sliceHistory(h, 3).services['liveworkspace:site']!.p).toBeNull();
  });
});

describe('parseStatusHistory', () => {
  it('takes an answer of the right shape', () => {
    expect(parseStatusHistory(history())).toEqual(history());
    expect(parseStatusHistory(emptyHistory(NOW))).toEqual(emptyHistory(NOW));
  });

  it('refuses anything else: an HTML page, a wrong version, bars of the wrong length', () => {
    expect(parseStatusHistory(null)).toBeNull();
    expect(parseStatusHistory('<!doctype html>')).toBeNull();
    expect(parseStatusHistory({ ...history(), v: 2 })).toBeNull();
    const h = history();
    h.services['liveworkspace:site']!.w = 'uu';
    expect(parseStatusHistory(h)).toBeNull();
  });

  it('starts an empty window 89 days back, so it holds 90', () => {
    const e = emptyHistory(NOW);
    expect(e.from).toBe('2026-07-28');
    expect(addDays(e.from, e.days - 1)).toBe(dayOf(NOW));
  });
});
