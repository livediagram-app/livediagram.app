import { describe, expect, it } from 'vitest';
import {
  appendHistory,
  type CheckResult,
  HISTORY_MAX,
  median,
  runProbe,
  summarise,
  viewServices,
} from './probe';
import { allServices, statusGroups, type Probe } from '@liveworkspace/status';

// liveworkspace/docs/site.md "Status": what each answer means.

const READ: Probe = { kind: 'read', url: '/x', method: 'GET', ok: [200], json: true };
const REACH: Probe = {
  kind: 'reach',
  url: 'https://livediagram-router.liveworkspace-easing509.workers.dev/robots.txt',
  method: 'HEAD',
};

const answer =
  (status: number, type = 'application/json', calls: RequestInit[] = []): typeof fetch =>
  async (_url, init) => {
    calls.push(init ?? {});
    return new Response(status === 204 ? null : '{}', {
      status,
      headers: { 'Content-Type': type },
    });
  };

// A clock that says each check took `ms`.
const took = (ms: number) => {
  let t = 0;
  return () => {
    const now = t;
    t += ms;
    return now;
  };
};

describe('runProbe', () => {
  it('is up when a readable answer is the one expected, and says what it was', async () => {
    const r = await runProbe(READ, answer(200), took(80), () => 1);
    expect(r).toEqual({ state: 'up', ms: 80, at: 1, detail: 'HTTP 200' });
  });

  it('is down on any other status, or a non-JSON answer where JSON was due', async () => {
    expect((await runProbe(READ, answer(500), took(5))).state).toBe('down');
    expect((await runProbe(READ, answer(500), took(5))).detail).toBe('HTTP 500');
    const html = await runProbe(READ, answer(200, 'text/html'), took(5));
    expect(html).toMatchObject({ state: 'down', detail: 'HTTP 200, not JSON' });
  });

  it('is slow when the expected answer took more than 1.5 seconds', async () => {
    expect((await runProbe(READ, answer(200), took(1600))).state).toBe('slow');
  });

  it('is down, never throwing, when the request fails', async () => {
    const failing: typeof fetch = async () => {
      throw new TypeError('Failed to fetch');
    };
    expect(await runProbe(READ, failing, took(3))).toMatchObject({
      state: 'down',
      detail: 'No answer',
    });
  });

  it('only claims Reached for another site, asked without CORS and without cookies', async () => {
    const calls: RequestInit[] = [];
    const r = await runProbe(REACH, answer(200, '', calls), took(40));
    expect(r).toMatchObject({ state: 'reached', detail: 'Reached' });
    expect(calls[0]).toMatchObject({
      mode: 'no-cors',
      method: 'HEAD',
      cache: 'no-store',
      credentials: 'omit',
    });
  });
});

describe('the page’s reading of the results', () => {
  const groups = statusGroups('production');
  const services = allServices(groups);
  const result = (state: CheckResult['state'], ms = 50): CheckResult => ({
    state,
    ms,
    at: 1,
    detail: '',
  });
  const everything = (state: CheckResult['state']) =>
    new Map(
      services.filter((s) => s.check.mode === 'probe').map((s) => [s.id, [result(state)]] as const),
    );

  it('checks everything before the first answers', () => {
    const views = viewServices(services, new Map());
    expect(summarise(services, views).overall).toBe('checking');
    expect(views.get('livediagram:realtime')?.state).toBe('checking');
  });

  it('is operational when everything answered, a reached page counting as answered', () => {
    const history = everything('up');
    history.set('livediagram:editor', [result('reached')]);
    const views = viewServices(services, history);
    const summary = summarise(services, views);
    expect(summary.overall).toBe('operational');
    expect(summary.answered).toBe(summary.total);
    expect(views.get('livediagram:router')?.state).toBe('up');
  });

  it('gives the realtime rooms the API’s state, and the router any check through it', () => {
    const history = everything('up');
    history.set('liveplanner:api', [result('down')]);
    let views = viewServices(services, history);
    expect(views.get('liveplanner:realtime')).toMatchObject({
      state: 'down',
      via: 'Through the API',
    });
    expect(views.get('liveplanner:router')?.state).toBe('up');
    for (const id of ['api', 'editor', 'marketing', 'help'])
      history.set(`liveplanner:${id}`, [result('down')]);
    views = viewServices(services, history);
    expect(views.get('liveplanner:router')?.state).toBe('down');
  });

  it('calls one service down an outage, half of them a major one, and a slow one slow', () => {
    const history = everything('up');
    history.set('liveworkspace:accounts', [result('down')]);
    expect(summarise(services, viewServices(services, history)).overall).toBe('outage');
    expect(summarise(services, viewServices(services, everything('down'))).overall).toBe('major');
    const slow = everything('up');
    slow.set('livedesign:api', [result('slow', 2000)]);
    expect(summarise(services, viewServices(services, slow)).overall).toBe('slow');
  });

  it('keeps at most HISTORY_MAX checks per service', () => {
    let history: Map<string, CheckResult[]> = new Map();
    for (let i = 0; i < HISTORY_MAX + 5; i++)
      history = appendHistory(history, new Map([['a', { ...result('up'), at: i }]]));
    expect(history.get('a')).toHaveLength(HISTORY_MAX);
    expect(history.get('a')?.[0]?.at).toBe(5);
  });

  it('takes the median answer time', () => {
    expect(median([])).toBeNull();
    expect(median([30, 10, 20])).toBe(20);
    expect(median([10, 20, 30, 40])).toBe(25);
  });
});
