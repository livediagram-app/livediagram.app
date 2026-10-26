import type { StatusHistory } from '@liveworkspace/status';
import { describe, expect, it } from 'vitest';
import {
  dayView,
  formatDay,
  formatDuration,
  formatUptime,
  hasRuns,
  incidentsByService,
  loadHistory,
  stripSummary,
} from './history';

// liveworkspace/docs/specs/010-site/site.md "Status": what the page makes of the stored history.

const AT = Date.parse('2026-10-25T09:07:00Z');
const H = 3_600_000;

function sampleHistory(): StatusHistory {
  return {
    v: 1,
    at: AT,
    from: '2026-10-21',
    days: 5,
    latest: { 'livediagram:api': ['u', 200, 120] },
    services: {
      'livediagram:api': { p: 99.17, w: 'ud-uu', u: [[1, 958]] },
    },
    incidents: [
      [
        'livediagram:api',
        Date.parse('2026-10-22T03:07:00Z'),
        Date.parse('2026-10-22T04:07:00Z'),
        'd',
        1,
        'timeout',
      ],
    ],
  };
}

const respond =
  (body: unknown, type = 'application/json'): typeof fetch =>
  async () =>
    new Response(typeof body === 'string' ? body : JSON.stringify(body), {
      headers: { 'Content-Type': type },
    });

describe('loadHistory', () => {
  it('reads the history from this origin, in one request', async () => {
    const seen: string[] = [];
    const fetchImpl: typeof fetch = async (input) => {
      seen.push(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
      return new Response(JSON.stringify(sampleHistory()), {
        headers: { 'Content-Type': 'application/json' },
      });
    };
    expect(await loadHistory(fetchImpl)).toEqual(sampleHistory());
    expect(seen).toEqual(['/api/status/history']);
  });

  it('is null without a Worker behind the path, on a failure, or for the wrong shape', async () => {
    expect(await loadHistory(respond('<!doctype html>', 'text/html'))).toBeNull();
    expect(await loadHistory(respond({}))).toBeNull();
    const offline: typeof fetch = async () => {
      throw new TypeError('Failed to fetch');
    };
    expect(await loadHistory(offline)).toBeNull();
    expect(hasRuns({ ...sampleHistory(), at: null })).toBe(false);
    expect(hasRuns(sampleHistory())).toBe(true);
  });
});

describe('a day of the strip', () => {
  const h = sampleHistory();
  const incidents = incidentsByService(h).get('livediagram:api')!;

  it('gives the date, uptime, worst state and the incidents that touched it', () => {
    expect(dayView(h, 'livediagram:api', 1, incidents)).toEqual({
      day: '2026-10-22',
      uptime: 95.8,
      worst: 'down',
      incidents,
    });
    expect(dayView(h, 'livediagram:api', 2, incidents)).toMatchObject({
      uptime: null,
      worst: null,
      incidents: [],
    });
  });

  it('counts an ongoing incident on every day since it began', () => {
    const open = {
      ...h,
      incidents: [['livediagram:api', AT - 30 * H, null, 's', 30, null]],
    } as StatusHistory;
    const list = incidentsByService(open).get('livediagram:api')!;
    expect(dayView(open, 'livediagram:api', 3, list).incidents).toHaveLength(1);
    expect(dayView(open, 'livediagram:api', 4, list).incidents).toHaveLength(1);
    expect(dayView(open, 'livediagram:api', 1, list).incidents).toHaveLength(0);
  });

  it('says the strip in words', () => {
    expect(stripSummary(h, 'livediagram:api')).toBe(
      '99.17% up over 5 days; 1 day with incidents, the last on 22 October.',
    );
    expect(stripSummary(h, 'nope')).toBe('No checks stored for the last 5 days yet.');
  });

  it('never calls a slow day an incident in the strip’s words', () => {
    const slow = {
      ...h,
      services: { 'livediagram:api': { p: 100, w: 'us-uu', u: [] } },
      incidents: [],
    } as StatusHistory;
    expect(stripSummary(slow, 'livediagram:api')).toBe(
      '100% up over 5 days; every day with checks fully up.',
    );
    const both = {
      ...h,
      services: { 'livediagram:api': { p: 99.17, w: 'ud-us', u: [[1, 958]] } },
    } as StatusHistory;
    expect(stripSummary(both, 'livediagram:api')).toBe(
      '99.17% up over 5 days; 1 day with incidents, the last on 22 October.',
    );
  });
});

describe('formatting', () => {
  it('writes days, uptimes and durations briefly', () => {
    expect(formatDay('2026-10-25')).toBe('Sun 25 Oct');
    expect(formatUptime(100)).toBe('100%');
    expect(formatUptime(99.9812)).toBe('99.98%');
    expect(formatDuration(45 * 60_000)).toBe('45 min');
    expect(formatDuration(2 * H + 5 * 60_000)).toBe('2 h 5 min');
    expect(formatDuration(76 * H)).toBe('3 d 4 h');
  });
});
