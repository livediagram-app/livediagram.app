import { describe, expect, it } from 'vitest';
import { type CheckResult, deriveResults, judgeAnswer, SLOW_MS, stateOf, worse } from './judge';
import { allServices, type Probe, statusGroups } from './services';

// liveworkspace/docs/status.md "The hourly run": one set of rules for the browser and the Worker.

const read = (ok: number[], json = false): Probe => ({
  kind: 'read',
  url: '/x',
  method: 'GET',
  ok,
  json,
});
const reach: Probe = {
  kind: 'reach',
  url: 'https://www.livediagram.app/robots.txt',
  method: 'HEAD',
};

describe('judgeAnswer', () => {
  it('takes only the expected codes from a readable check, and JSON where JSON is due', () => {
    expect(judgeAnswer(read([200], true), 200, 'application/json; charset=utf-8')).toBeNull();
    expect(judgeAnswer(read([200], true), 200, 'text/html')).toBe('not_json');
    expect(judgeAnswer(read([200], true), 500, 'application/json')).toBe('status');
    expect(judgeAnswer(read([404], true), 404, 'application/json')).toBeNull();
    expect(judgeAnswer(read([204]), 204, null)).toBeNull();
  });

  it('gives a page the browser can only reach a true state on the server: any 2xx or 3xx is up', () => {
    expect(judgeAnswer(reach, 200, 'text/plain')).toBeNull();
    expect(judgeAnswer(reach, 304, null)).toBeNull();
    expect(judgeAnswer(reach, 404, 'text/html')).toBe('status');
    expect(judgeAnswer(reach, 503, 'text/html')).toBe('status');
  });
});

describe('stateOf', () => {
  it('is down on any error, slow past the threshold, else up', () => {
    expect(stateOf(80, null)).toBe('up');
    expect(stateOf(SLOW_MS, null)).toBe('up');
    expect(stateOf(SLOW_MS + 1, null)).toBe('slow');
    expect(stateOf(20, 'status')).toBe('down');
  });

  it('orders states worst last', () => {
    expect(worse('up', 'slow')).toBe('slow');
    expect(worse('down', 'slow')).toBe('down');
    expect(worse('up', 'up')).toBe('up');
  });
});

describe('deriveResults', () => {
  const services = allServices(statusGroups('production'));
  const up = (ms: number): CheckResult => ({ state: 'up', code: 200, ms, error: null });
  const down: CheckResult = { state: 'down', code: null, ms: 10_000, error: 'timeout' };

  it('gives the realtime rooms the API’s result, and the router its fastest answer', () => {
    const results = new Map<string, CheckResult>([
      ['livediagram:api', up(120)],
      ['livediagram:editor', up(40)],
      ['livediagram:marketing', down],
    ]);
    const derived = deriveResults(services, results);
    expect(derived.get('livediagram:realtime')).toEqual(up(120));
    expect(derived.get('livediagram:router')).toEqual(up(40));
    // No sources checked: nothing derived.
    expect(derived.has('liveplanner:router')).toBe(false);
  });

  it('marks the router down only when nothing through it answered', () => {
    const results = new Map<string, CheckResult>([
      ['liveplanner:api', down],
      ['liveplanner:editor', { ...down, ms: 300, error: 'network' }],
    ]);
    const router = deriveResults(services, results).get('liveplanner:router');
    expect(router?.state).toBe('down');
    expect(router?.error).toBe('network');
  });
});
