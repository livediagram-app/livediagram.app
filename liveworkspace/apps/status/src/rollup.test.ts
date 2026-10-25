import type { CheckResult } from '@liveworkspace/status';
import { describe, expect, it } from 'vitest';
import { type Incident, stepIncidents } from './incidents';
import { percentile, rollupDay, uptimeTenths } from './rollup';

// liveworkspace/docs/status.md "The hourly run": a day's rollup, and incidents from consecutive checks.

describe('rollupDay', () => {
  it('counts each state, takes percentiles over the answers, and keeps the worst', () => {
    const day = rollupDay([
      { state: 'up', ms: 80 },
      { state: 'up', ms: 100 },
      { state: 'slow', ms: 1800 },
      { state: 'down', ms: 10_000 },
      { state: 'up', ms: 90 },
    ]);
    expect(day).toEqual({ checks: 5, up: 3, slow: 1, down: 1, p50: 90, p95: 1800, worst: 'down' });
    expect(uptimeTenths(day)).toBe(800);
  });

  it('has no times for a day that never answered, and is up for an empty one', () => {
    expect(rollupDay([{ state: 'down', ms: 10_000 }])).toMatchObject({
      p50: null,
      p95: null,
      worst: 'down',
    });
    expect(rollupDay([])).toMatchObject({ checks: 0, worst: 'up' });
    expect(uptimeTenths({ checks: 0, up: 0, slow: 0 })).toBeNull();
    expect(uptimeTenths({ checks: 24, up: 23, slow: 0 })).toBe(958);
  });

  it('takes nearest-rank percentiles', () => {
    const sorted = Array.from({ length: 24 }, (_, i) => (i + 1) * 10);
    expect(percentile(sorted, 0.5)).toBe(120);
    expect(percentile(sorted, 0.95)).toBe(230);
    expect(percentile([], 0.5)).toBeNull();
  });

  it('rolls up a worst-case day quickly: 24 checks for 35 services, a thousand times', () => {
    const checks = Array.from({ length: 24 }, (_, i) => ({ state: 'up' as const, ms: 50 + i }));
    const started = performance.now();
    for (let i = 0; i < 1000; i++) for (let s = 0; s < 35; s++) rollupDay(checks);
    expect(performance.now() - started).toBeLessThan(1000);
  });
});

describe('stepIncidents', () => {
  const up = { state: 'up' as const, code: 200, ms: 50, error: null };
  const down = { state: 'down' as const, code: null, ms: 10_000, error: 'timeout' as const };
  const slow = { state: 'slow' as const, code: 200, ms: 2000, error: null };

  it('opens one on the first down check, and none for a slow one', () => {
    const step = stepIncidents(
      [],
      new Map<string, CheckResult>([
        ['a', down],
        ['b', slow],
        ['c', up],
      ]),
      100,
    );
    expect(step.opened).toEqual([
      {
        id: null,
        service: 'a',
        startedAt: 100,
        lastAt: 100,
        endedAt: null,
        worst: 'down',
        checks: 1,
        error: 'timeout',
      },
    ]);
    expect(step.changed).toEqual([]);
  });

  it('extends an open one while it is down, keeping the first error', () => {
    const open: Incident = {
      id: 7,
      service: 'a',
      startedAt: 100,
      lastAt: 100,
      endedAt: null,
      worst: 'down',
      checks: 1,
      error: 'timeout',
    };
    const step = stepIncidents(
      [open],
      new Map([['a', { ...down, error: 'network' as const }]]),
      200,
    );
    expect(step.changed).toEqual([{ ...open, lastAt: 200, checks: 2 }]);
  });

  it('closes one at the first check that answers, slow or up', () => {
    const open: Incident = {
      id: 7,
      service: 'a',
      startedAt: 100,
      lastAt: 200,
      endedAt: null,
      worst: 'down',
      checks: 2,
      error: 'timeout',
    };
    expect(stepIncidents([open], new Map([['a', slow]]), 300).changed).toEqual([
      { ...open, endedAt: 300 },
    ]);
  });

  it('closes it at the first up check, and leaves one for a service not checked this run', () => {
    const a: Incident = {
      id: 1,
      service: 'a',
      startedAt: 100,
      lastAt: 200,
      endedAt: null,
      worst: 'down',
      checks: 2,
      error: 'network',
    };
    const b: Incident = { ...a, id: 2, service: 'b' };
    const step = stepIncidents([a, b], new Map([['a', up]]), 300);
    expect(step.changed).toEqual([{ ...a, endedAt: 300 }]);
    expect(step.after).toEqual([{ ...a, endedAt: 300 }, b]);
    expect(step.opened).toEqual([]);
  });
});
