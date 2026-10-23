// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IndexError } from '@liveworkspace/index-client';

const index = vi.hoisted(() => ({ grant: vi.fn() }));
vi.mock('../index-client', () => ({ indexClient: index }));
vi.unmock('@/lib/api/plan-grants');

const {
  GRANT_RENEW_BEFORE_MS,
  heldPlanGrant,
  keepPlanGrantFresh,
  planGrant,
  planGrantRefusal,
  planIdOfPath,
  resetPlanGrantsForTests,
  seedPlanGrant,
  withPlanGrant,
} = await import('./plan-grants');

// The index's grant on a plan (liveworkspace/docs/one-explorer-contracts.md "Grants"), as the editor holds it: one
// request per plan per ten minutes however many ask, renewed a minute before it lapses, and sent as X-Index-Grant.

const TEN_MIN = 10 * 60_000;
const grantOf = (name: string, life = TEN_MIN) => ({
  grant: name,
  level: 'edit',
  tabId: null,
  expiresAt: Date.now() + life,
});

beforeEach(() => resetPlanGrantsForTests());
afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe('planGrant', () => {
  it('asks once for concurrent callers and keeps the answer', async () => {
    index.grant.mockResolvedValue(grantOf('g1'));
    const [a, b] = await Promise.all([planGrant('p1'), planGrant('p1')]);
    expect(a?.grant).toBe('g1');
    expect(b?.grant).toBe('g1');
    await planGrant('p1');
    expect(index.grant).toHaveBeenCalledOnce();
    expect(heldPlanGrant('p1')).toBe('g1');
  });

  it('keeps a grant per link, and sends the link’s code and password', async () => {
    index.grant.mockResolvedValue(grantOf('g-link'));
    await planGrant('p1', { code: 'C1', password: 'pw' });
    expect(index.grant).toHaveBeenCalledWith('p1', { code: 'C1', password: 'pw' });
    expect(heldPlanGrant('p1')).toBeNull();
    expect(heldPlanGrant('p1', { code: 'C1' })).toBe('g-link');
  });

  it('asks again once the grant is within a minute of lapsing', async () => {
    index.grant.mockResolvedValueOnce(grantOf('old', GRANT_RENEW_BEFORE_MS - 1));
    index.grant.mockResolvedValueOnce(grantOf('new'));
    await planGrant('p1');
    expect((await planGrant('p1'))?.grant).toBe('new');
  });

  it('remembers why the index refused, and does not ask again straight away', async () => {
    index.grant.mockRejectedValue(new IndexError(401, 'password_required'));
    expect(await planGrant('p1', { code: 'C' })).toBeNull();
    expect(planGrantRefusal('p1', { code: 'C' })).toBe('password_required');
    await planGrant('p1', { code: 'C' });
    expect(index.grant).toHaveBeenCalledOnce();
  });

  it('asks again after a network failure', async () => {
    index.grant.mockRejectedValueOnce(new TypeError('offline'));
    index.grant.mockResolvedValueOnce(grantOf('g'));
    expect(await planGrant('p1')).toBeNull();
    expect((await planGrant('p1'))?.grant).toBe('g');
  });

  it('takes a seeded grant (the create’s) without asking', async () => {
    seedPlanGrant('p1', grantOf('seeded') as never);
    expect((await planGrant('p1'))?.grant).toBe('seeded');
    expect(index.grant).not.toHaveBeenCalled();
  });

  it('takes the grant the page asked for before its code loaded', async () => {
    (window as { __lpGrant?: unknown }).__lpGrant = {
      id: 'p1',
      share: '',
      p: Promise.resolve(grantOf('early')),
    };
    expect((await planGrant('p1'))?.grant).toBe('early');
    expect(index.grant).not.toHaveBeenCalled();
    expect((window as { __lpGrant?: unknown }).__lpGrant).toBeUndefined();
  });
});

describe('keepPlanGrantFresh', () => {
  it('renews a minute before expiry, and stops when told', async () => {
    vi.useFakeTimers();
    let n = 0;
    // Each answer lasts ten minutes from when it is given.
    index.grant.mockImplementation(async () => grantOf(`g${++n}`));
    const stop = keepPlanGrantFresh('p1');
    await vi.advanceTimersByTimeAsync(0);
    expect(index.grant).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(TEN_MIN - GRANT_RENEW_BEFORE_MS - 1_000);
    expect(index.grant).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(2_000);
    expect(index.grant).toHaveBeenCalledTimes(2);
    expect(heldPlanGrant('p1')).toBe('g2');
    stop();
    await vi.advanceTimersByTimeAsync(TEN_MIN);
    expect(index.grant).toHaveBeenCalledTimes(2);
  });
});

describe('withPlanGrant', () => {
  it('names the plan of a plan path, and nothing else', () => {
    expect(planIdOfPath('/api', '/api/projects/p%201/tabs/t')).toBe('p 1');
    expect(planIdOfPath('/api', '/api/projects')).toBeNull();
    expect(planIdOfPath('/api', '/api/self')).toBeNull();
  });

  it('adds the grant for the plan and link the request names', async () => {
    index.grant.mockResolvedValue(grantOf('g-share'));
    const init = await withPlanGrant('/api', '/api/projects/p1/tabs/t1', {
      headers: { 'X-Share-Code': 'C9' },
    });
    expect(new Headers(init?.headers).get('X-Index-Grant')).toBe('g-share');
    expect(index.grant).toHaveBeenCalledWith('p1', { code: 'C9', password: null });
  });

  it('leaves a request that already carries one, or names no plan, alone', async () => {
    const carried = { headers: { 'X-Index-Grant': 'mine' } };
    expect(await withPlanGrant('/api', '/api/projects/p1', carried)).toBe(carried);
    const other = { method: 'POST' };
    expect(await withPlanGrant('/api', '/api/projects', other)).toBe(other);
    expect(index.grant).not.toHaveBeenCalled();
  });
});
