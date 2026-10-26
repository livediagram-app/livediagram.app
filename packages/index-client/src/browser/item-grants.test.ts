import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IndexError } from '../client';
import {
  createItemGrants,
  GRANT_RENEW_BEFORE_MS,
  GRANT_RETRY_MS,
  GRANTS_HELD_MAX,
} from './item-grants';
import { fakeWindow } from './fake-window';

// The index's grant on an item (liveworkspace/docs/specs/004-index/one-explorer-contracts.md "Grants"), as an editor holds it: one
// request per item per ten minutes however many ask, renewed a minute before it lapses, sent as X-Index-Grant.

const TEN_MIN = 10 * 60_000;
const grantOf = (name: string, life = TEN_MIN) => ({
  grant: name,
  level: 'edit' as const,
  tabId: null,
  expiresAt: Date.now() + life,
});
const index = { grant: vi.fn() };
const grants = createItemGrants({
  client: () => index,
  bootGlobal: '__testGrant',
  itemsSegment: 'designs',
});

beforeEach(() => {
  grants.resetForTests();
  fakeWindow();
});
afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe('grant', () => {
  it('asks once for concurrent callers and keeps the answer', async () => {
    index.grant.mockResolvedValue(grantOf('g1'));
    const [a, b] = await Promise.all([grants.grant('d1'), grants.grant('d1')]);
    expect([a?.grant, b?.grant]).toEqual(['g1', 'g1']);
    await grants.grant('d1');
    expect(index.grant).toHaveBeenCalledOnce();
    expect(grants.held('d1')).toBe('g1');
  });

  it("keeps a grant per link, and sends the link's code and password", async () => {
    index.grant.mockResolvedValue(grantOf('g-link'));
    await grants.grant('d1', { code: 'C1', password: 'pw' });
    expect(index.grant).toHaveBeenCalledWith('d1', { code: 'C1', password: 'pw' });
    expect(grants.held('d1')).toBeNull();
    expect(grants.held('d1', { code: 'C1' })).toBe('g-link');
  });

  it('asks again once the grant is within a minute of lapsing', async () => {
    index.grant.mockResolvedValueOnce(grantOf('old', GRANT_RENEW_BEFORE_MS - 1));
    index.grant.mockResolvedValueOnce(grantOf('new'));
    await grants.grant('d1');
    expect((await grants.grant('d1'))?.grant).toBe('new');
  });

  it('remembers why the index refused, and does not ask again straight away', async () => {
    index.grant.mockRejectedValue(new IndexError(401, 'password_required'));
    expect(await grants.grant('d1', { code: 'C' })).toBeNull();
    expect(grants.refusal('d1', { code: 'C' })).toBe('password_required');
    await grants.grant('d1', { code: 'C' });
    expect(index.grant).toHaveBeenCalledOnce();
  });

  it('a request with a password never joins one in flight without it, and the older refusal does not win', async () => {
    let refuse!: (e: unknown) => void;
    index.grant.mockImplementationOnce(
      () => new Promise((_, reject) => (refuse = reject)), // the link's first ask, with no password
    );
    index.grant.mockResolvedValueOnce(grantOf('with-pw'));
    const first = grants.grant('d1', { code: 'C' });
    const typed = grants.grant('d1', { code: 'C', password: 'pw' }, { fresh: true });
    expect((await typed)?.grant).toBe('with-pw');
    expect(index.grant).toHaveBeenLastCalledWith('d1', { code: 'C', password: 'pw' });
    refuse(new IndexError(401, 'password_required'));
    expect(await first).toBeNull();
    // The newer answer stands: the grant is held and no refusal is remembered over it.
    expect(grants.held('d1', { code: 'C' })).toBe('with-pw');
    expect(grants.refusal('d1', { code: 'C' })).toBeNull();
    expect((await grants.grant('d1', { code: 'C' }))?.grant).toBe('with-pw');
  });

  it('asks again after a network failure', async () => {
    index.grant.mockRejectedValueOnce(new TypeError('offline'));
    index.grant.mockResolvedValueOnce(grantOf('g'));
    expect(await grants.grant('d1')).toBeNull();
    expect((await grants.grant('d1'))?.grant).toBe('g');
  });

  it("takes a seeded grant (the create's), and the one the page asked for before its code loaded", async () => {
    grants.seed('d1', grantOf('seeded'));
    expect((await grants.grant('d1'))?.grant).toBe('seeded');
    const w = window as unknown as Record<string, unknown>;
    w.__testGrant = { id: 'd2', share: '', p: Promise.resolve(grantOf('early')) };
    expect((await grants.grant('d2'))?.grant).toBe('early');
    expect(w.__testGrant).toBeUndefined();
    expect(index.grant).not.toHaveBeenCalled();
  });

  it(`holds at most ${GRANTS_HELD_MAX} items, dropping the oldest`, async () => {
    for (let i = 0; i <= GRANTS_HELD_MAX; i++) grants.seed(`d${i}`, grantOf(`g${i}`));
    expect(grants.held('d0')).toBeNull();
    expect(grants.held(`d${GRANTS_HELD_MAX}`)).toBe(`g${GRANTS_HELD_MAX}`);
  });
});

it('keepFresh renews a minute before expiry, and stops when told', async () => {
  vi.useFakeTimers();
  let n = 0;
  index.grant.mockImplementation(async () => grantOf(`g${++n}`));
  const stop = grants.keepFresh('d1');
  await vi.advanceTimersByTimeAsync(0);
  expect(index.grant).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(TEN_MIN - GRANT_RENEW_BEFORE_MS - 1_000);
  expect(index.grant).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(2_000);
  expect(index.grant).toHaveBeenCalledTimes(2);
  expect(grants.held('d1')).toBe('g2');
  stop();
  await vi.advanceTimersByTimeAsync(TEN_MIN);
  expect(index.grant).toHaveBeenCalledTimes(2);
});

it('keepFresh tries a renewal the network failed again, and stops on a refusal', async () => {
  vi.useFakeTimers();
  index.grant
    .mockResolvedValueOnce(grantOf('g1'))
    .mockRejectedValueOnce(new TypeError('offline'))
    .mockResolvedValueOnce(grantOf('g2'))
    .mockRejectedValueOnce(new IndexError(403, 'forbidden'));
  const stop = grants.keepFresh('d1');
  await vi.advanceTimersByTimeAsync(TEN_MIN - GRANT_RENEW_BEFORE_MS);
  expect(index.grant).toHaveBeenCalledTimes(2);
  await vi.advanceTimersByTimeAsync(GRANT_RETRY_MS);
  expect(index.grant).toHaveBeenCalledTimes(3);
  expect(grants.held('d1')).toBe('g2');
  await vi.advanceTimersByTimeAsync(TEN_MIN);
  expect(index.grant).toHaveBeenCalledTimes(4);
  await vi.advanceTimersByTimeAsync(TEN_MIN);
  expect(index.grant).toHaveBeenCalledTimes(4);
  stop();
});

it('keepFresh renews while any caller keeps the item fresh', async () => {
  vi.useFakeTimers();
  let n = 0;
  index.grant.mockImplementation(async () => grantOf(`g${++n}`));
  const stopA = grants.keepFresh('d1');
  const stopB = grants.keepFresh('d1');
  await vi.advanceTimersByTimeAsync(0);
  expect(index.grant).toHaveBeenCalledTimes(1);
  stopA();
  stopA();
  await vi.advanceTimersByTimeAsync(TEN_MIN);
  expect(index.grant).toHaveBeenCalledTimes(2);
  stopB();
  await vi.advanceTimersByTimeAsync(TEN_MIN);
  expect(index.grant).toHaveBeenCalledTimes(2);
});

describe('withGrant', () => {
  it('names the item of an item path, and nothing else', () => {
    expect(grants.itemIdOfPath('/api', '/api/designs/d%201/tabs/t')).toBe('d 1');
    expect(grants.itemIdOfPath('/api', '/api/designs')).toBeNull();
    expect(grants.itemIdOfPath('/api', '/api/self')).toBeNull();
  });

  it('names the item a read carries in its query, for the segments the app says', () => {
    const withImages = createItemGrants({
      client: () => index,
      bootGlobal: null,
      itemsSegment: 'documents',
      queryItems: [{ segment: 'images', param: 'd' }],
    });
    expect(withImages.itemIdOfPath('/api', '/api/images/i1?d=doc%201')).toBe('doc 1');
    expect(withImages.itemIdOfPath('/api', '/api/images/i1?w=200&d=d2#x')).toBe('d2');
    expect(withImages.itemIdOfPath('/api', '/api/images/i1')).toBeNull();
    expect(withImages.itemIdOfPath('/api', '/api/documents/d3/tabs')).toBe('d3');
    // Without the option an image read names nothing.
    expect(grants.itemIdOfPath('/api', '/api/images/i1?d=d1')).toBeNull();
  });

  it('adds the grant for the item and link the request names', async () => {
    index.grant.mockResolvedValue(grantOf('g-share'));
    const init = await grants.withGrant('/api', '/api/designs/d1/tabs/t1', {
      headers: { 'X-Share-Code': 'C9' },
    });
    expect(new Headers(init?.headers).get('X-Index-Grant')).toBe('g-share');
    expect(index.grant).toHaveBeenCalledWith('d1', { code: 'C9', password: null });
  });

  it('leaves a request that already carries one, or names no item, alone', async () => {
    const carried = { headers: { 'X-Index-Grant': 'mine' } };
    expect(await grants.withGrant('/api', '/api/designs/d1', carried)).toBe(carried);
    const other = { method: 'POST' };
    expect(await grants.withGrant('/api', '/api/designs', other)).toBe(other);
    expect(index.grant).not.toHaveBeenCalled();
  });
});
