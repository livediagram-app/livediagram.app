import { describe, expect, it } from 'vitest';
import {
  addDays,
  dayOf,
  dayUptime,
  dayStart,
  emptyHistory,
  groupOfService,
  parseStatusHistory,
  poolUptime,
  sliceHistory,
  type StatusHistory,
  uptimePercent,
} from './wire';

// liveworkspace/docs/specs/009-status/status.md "The read API".

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

describe('uptimePercent', () => {
  it('is null without checks, never a default 100', () => {
    expect(uptimePercent(0, 0)).toBeNull();
  });

  it('is 100 only when every check answered', () => {
    expect(uptimePercent(2160, 2160)).toBe(100);
    // One down check in 75,600 (every service, 90 days) would round to 100.00; it reads 99.99.
    expect(uptimePercent(75_599, 75_600)).toBe(99.99);
    expect(uptimePercent(15_119, 15_120)).toBe(99.99);
  });

  it('rounds to two places below 100', () => {
    expect(uptimePercent(2159, 2160)).toBe(99.95);
    expect(uptimePercent(199, 200)).toBe(99.5);
    expect(uptimePercent(2, 3)).toBe(66.67);
    expect(uptimePercent(0, 24)).toBe(0);
  });
});

describe('poolUptime', () => {
  it('pools each group’s checks, and every service’s for the page', () => {
    const u = poolUptime([
      ['livediagram:api', { checks: 100, answered: 90 }],
      ['livediagram:editor', { checks: 300, answered: 300 }],
      ['liveplanner:api', { checks: 100, answered: 100 }],
      ['liveplanner:mcp', { checks: 0, answered: 0 }],
      ['livedesign:api', { checks: 0, answered: 0 }],
    ]);
    // Weighted by checks: 390 of 400, not the mean of 90% and 100%.
    expect(u.groups).toEqual({ livediagram: 97.5, liveplanner: 100, livedesign: null });
    expect(u.all).toBe(98);
  });

  it('is null throughout with no checks at all', () => {
    expect(poolUptime([])).toEqual({ all: null, groups: {} });
  });

  it('takes a service’s group from its id', () => {
    expect(groupOfService('liveworkspace:site')).toBe('liveworkspace');
    expect(groupOfService('odd')).toBe('odd');
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

  it('works each group’s uptime out again from the days it keeps', () => {
    const h = history();
    h.services['liveworkspace:accounts'] = { p: 100, w: 'uuuuu', u: [] };
    h.services['livediagram:api'] = { p: null, w: '-----', u: [] };
    // Days 1 to 4: site 958, -, 1000, 1000; accounts 1000 four times. 6958 of 7000 tenths.
    expect(sliceHistory(h, 4).uptime).toEqual({
      all: 99.4,
      groups: { liveworkspace: 99.4, livediagram: null },
    });
    expect(sliceHistory(h, 2).uptime).toEqual({
      all: 100,
      groups: { liveworkspace: 100, livediagram: null },
    });
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

  it('keeps a good uptime, and drops a bad one without losing the bars', () => {
    const good = { ...history(), uptime: { all: 99.5, groups: { liveworkspace: 99.5, x: null } } };
    expect(parseStatusHistory(good)).toEqual(good);
    for (const uptime of [
      null,
      'x',
      { all: 101, groups: {} },
      { all: 1 },
      { all: 1, groups: [] },
    ]) {
      const parsed = parseStatusHistory({ ...history(), uptime });
      expect(parsed).toEqual(history());
      expect(parsed && 'uptime' in parsed).toBe(false);
    }
    expect(
      parseStatusHistory({ ...history(), uptime: { all: null, groups: { a: Number.NaN } } }),
    ).toEqual(history());
  });

  it('starts an empty window 89 days back, so it holds 90', () => {
    const e = emptyHistory(NOW);
    expect(e.from).toBe('2026-07-28');
    expect(addDays(e.from, e.days - 1)).toBe(dayOf(NOW));
  });
});
