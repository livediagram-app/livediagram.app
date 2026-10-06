import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ShareLink } from '@livediagram/api-schema';
import type { Env } from '../types';

// The share-side rules the REST gates, the share-code resolve, and the room
// upgrade all compose. `../db` is stubbed so each case drives the link and
// password state directly.
const getShareLinkMock = vi.fn<(env: Env, code: string) => Promise<ShareLink | null>>();
const getSharePasswordMock = vi.fn<(env: Env, id: string) => Promise<string | null>>();
const upgradeMock = vi.fn<(env: Env, id: string, from: string, to: string) => Promise<void>>();
vi.mock('../db', () => ({
  getShareLink: (env: Env, code: string) => getShareLinkMock(env, code),
  getDocumentSharePassword: (env: Env, id: string) => getSharePasswordMock(env, id),
  upgradeDocumentSharePassword: (env: Env, id: string, from: string, to: string) =>
    upgradeMock(env, id, from, to),
}));

import {
  clearVerifiedSharePasswords,
  isPersonalOwner,
  shareLinkForDocument,
  sharePasswordOk,
  sharePasswordStatus,
  VERIFIED_MAX,
  VERIFIED_TTL_MS,
} from './share-access';
import { hashSharePassword, verifySharePassword } from './share-password-hash';

// A cheap iteration count keeps the suite fast; the stored value names its
// own count, so the check reads it back exactly as it would 100,000.
const FAST = 1_000;
const attempt = (value: string, rateKey = 'net-1') => ({ value, rateKey });

const ENV = {} as Env;
const link = (documentId: string, role: 'edit' | 'view') => ({ documentId, role }) as ShareLink;

beforeEach(() => {
  clearVerifiedSharePasswords();
  vi.useRealTimers();
  getShareLinkMock.mockReset();
  getSharePasswordMock.mockReset();
  getSharePasswordMock.mockResolvedValue(null);
  upgradeMock.mockReset();
  upgradeMock.mockResolvedValue(undefined);
});

describe('isPersonalOwner', () => {
  it('accepts a matching owner on a personal document', () => {
    expect(isPersonalOwner('a', 'a', null)).toBe(true);
  });
  it('never accepts the bare owner id on a team document', () => {
    expect(isPersonalOwner('a', 'a', 'team-1')).toBe(false);
  });
  it('rejects a missing or different owner', () => {
    expect(isPersonalOwner(null, 'a', null)).toBe(false);
    expect(isPersonalOwner('b', 'a', null)).toBe(false);
  });
});

describe('shareLinkForDocument', () => {
  it('returns the link when it belongs to the document', async () => {
    getShareLinkMock.mockResolvedValue(link('d1', 'view'));
    expect(await shareLinkForDocument(ENV, 'code', 'd1')).toEqual(link('d1', 'view'));
  });
  it('refuses a code for a different document', async () => {
    getShareLinkMock.mockResolvedValue(link('d2', 'edit'));
    expect(await shareLinkForDocument(ENV, 'code', 'd1')).toBeNull();
  });
  it('skips the lookup for a missing or empty code', async () => {
    expect(await shareLinkForDocument(ENV, null, 'd1')).toBeNull();
    expect(await shareLinkForDocument(ENV, '', 'd1')).toBeNull();
    expect(getShareLinkMock).not.toHaveBeenCalled();
  });
});

describe('sharePasswordStatus', () => {
  it('is ok when the document has no password', async () => {
    expect(await sharePasswordStatus(ENV, 'd1', null)).toBe('ok');
  });

  it('tells a missing password apart from a wrong one, against a hash', async () => {
    getSharePasswordMock.mockResolvedValue(await hashSharePassword('hunter2', FAST));
    expect(await sharePasswordStatus(ENV, 'd1', null)).toBe('missing');
    expect(await sharePasswordStatus(ENV, 'd1', attempt(''))).toBe('invalid');
    expect(await sharePasswordStatus(ENV, 'd1', attempt('wrong'))).toBe('invalid');
    expect(await sharePasswordStatus(ENV, 'd1', attempt('hunter2'))).toBe('ok');
    expect(upgradeMock).not.toHaveBeenCalled();
  });

  it('sharePasswordOk is true only for ok', async () => {
    getSharePasswordMock.mockResolvedValue(await hashSharePassword('hunter2', FAST));
    expect(await sharePasswordOk(ENV, 'd1', null)).toBe(false);
    expect(await sharePasswordOk(ENV, 'd1', attempt('hunter2'))).toBe(true);
  });

  // A password saved before hashing shipped keeps working, and its first
  // correct entry stores the hash in its place.
  it('accepts a legacy plain-text value and upgrades it on the first correct entry', async () => {
    getSharePasswordMock.mockResolvedValue('hunter2');
    expect(await sharePasswordStatus(ENV, 'd1', attempt('wrong'))).toBe('invalid');
    expect(upgradeMock).not.toHaveBeenCalled();
    expect(await sharePasswordStatus(ENV, 'd1', attempt('hunter2'))).toBe('ok');
    expect(upgradeMock).toHaveBeenCalledTimes(1);
    const [, id, from, to] = upgradeMock.mock.calls[0]!;
    expect([id, from]).toEqual(['d1', 'hunter2']);
    expect(to).toMatch(/^pbkdf2-sha256\$100000\$/);
    expect((await verifySharePassword(to, 'hunter2')).ok).toBe(true);
  });

  it('still answers ok when the legacy upgrade write fails', async () => {
    getSharePasswordMock.mockResolvedValue('hunter2');
    upgradeMock.mockRejectedValue(new Error('d1 down'));
    expect(await sharePasswordStatus(ENV, 'd1', attempt('hunter2'))).toBe('ok');
  });
});

describe('the verified cache', () => {
  const limiter = (success = true) => {
    const limit = vi.fn(async () => ({ success }));
    return { env: { SHARE_RATE_LIMITER: { limit } } as unknown as Env, limit };
  };

  it('answers a repeat correct password without another derivation or budget', async () => {
    getSharePasswordMock.mockResolvedValue(await hashSharePassword('hunter2', FAST));
    const { env, limit } = limiter();
    for (let i = 0; i < 5; i++)
      expect(await sharePasswordStatus(env, 'd1', attempt('hunter2'))).toBe('ok');
    expect(limit).toHaveBeenCalledTimes(1);
  });

  it('misses once the password changes, and once the entry expires', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    getSharePasswordMock.mockResolvedValue(await hashSharePassword('hunter2', FAST));
    const { env, limit } = limiter();
    await sharePasswordStatus(env, 'd1', attempt('hunter2'));
    getSharePasswordMock.mockResolvedValue(await hashSharePassword('hunter2', FAST));
    expect(await sharePasswordStatus(env, 'd1', attempt('hunter2'))).toBe('ok');
    expect(limit).toHaveBeenCalledTimes(2);
    vi.setSystemTime(Date.now() + VERIFIED_TTL_MS + 1);
    expect(await sharePasswordStatus(env, 'd1', attempt('hunter2'))).toBe('ok');
    expect(limit).toHaveBeenCalledTimes(3);
  });

  it('never caches a wrong password', async () => {
    getSharePasswordMock.mockResolvedValue(await hashSharePassword('hunter2', FAST));
    const { env, limit } = limiter();
    await sharePasswordStatus(env, 'd1', attempt('wrong'));
    await sharePasswordStatus(env, 'd1', attempt('wrong'));
    expect(limit).toHaveBeenCalledTimes(2);
  });

  it('stays bounded, evicting the oldest entry', async () => {
    const { env, limit } = limiter();
    // One cheap hash per entry: distinct stored values make distinct keys.
    const stored = await Promise.all(
      Array.from({ length: VERIFIED_MAX + 1 }, () => hashSharePassword('pw', FAST)),
    );
    for (const value of stored) {
      getSharePasswordMock.mockResolvedValueOnce(value);
      await sharePasswordStatus(env, 'd1', attempt('pw'));
    }
    const before = limit.mock.calls.length;
    // The newest entry is still held...
    getSharePasswordMock.mockResolvedValueOnce(stored[VERIFIED_MAX]!);
    await sharePasswordStatus(env, 'd1', attempt('pw'));
    expect(limit.mock.calls.length).toBe(before);
    // ...and the oldest was evicted to make room for it.
    getSharePasswordMock.mockResolvedValueOnce(stored[0]!);
    await sharePasswordStatus(env, 'd1', attempt('pw'));
    expect(limit.mock.calls.length).toBe(before + 1);
  });
});

describe('the guess budget', () => {
  it('spends one unit per check under the caller network', async () => {
    getSharePasswordMock.mockResolvedValue(await hashSharePassword('hunter2', FAST));
    const limit = vi.fn(async () => ({ success: true }));
    const env = { SHARE_RATE_LIMITER: { limit } } as unknown as Env;
    await sharePasswordStatus(env, 'd1', attempt('wrong', '2001:0db8:0000:0001::/64'));
    expect(limit).toHaveBeenCalledWith({ key: 'share-pw:2001:0db8:0000:0001::/64' });
  });

  // Over the limit the answer is the same whether the guess was right or not,
  // so a caller who has spent the budget learns nothing more.
  it('answers invalid without checking once the budget is spent, even for the right password', async () => {
    getSharePasswordMock.mockResolvedValue(await hashSharePassword('hunter2', FAST));
    const env = {
      SHARE_RATE_LIMITER: { limit: vi.fn(async () => ({ success: false })) },
    } as unknown as Env;
    expect(await sharePasswordStatus(env, 'd1', attempt('hunter2'))).toBe('invalid');
    expect(await sharePasswordStatus(env, 'd1', attempt('wrong'))).toBe('invalid');
  });

  it('does not spend budget on a document with no password, or a missing one', async () => {
    const limit = vi.fn(async () => ({ success: true }));
    const env = { SHARE_RATE_LIMITER: { limit } } as unknown as Env;
    await sharePasswordStatus(env, 'd1', attempt('anything'));
    getSharePasswordMock.mockResolvedValue(await hashSharePassword('hunter2', FAST));
    await sharePasswordStatus(env, 'd1', null);
    expect(limit).not.toHaveBeenCalled();
  });
});
