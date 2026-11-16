// Share-password storage (password-hash.ts): a stored value checks the right password and no other, a malformed value
// is refused whatever is typed, and a right password is remembered per isolate, oldest out first.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { hashSharePassword, isRememberedSharePassword, verifySharePassword } from './password-hash';

vi.mock('./config', async (original) => ({
  ...(await original<typeof import('./config')>()),
  PASSWORD_MEMORY_MAX: 2,
}));

afterEach(() => vi.restoreAllMocks());

// Cheap iterations: the format and the checks are what is under test, not the cost.
const ITERATIONS = 1_000;

describe('share passwords', () => {
  it('stores pbkdf2-sha256, a salt of its own each time, and checks only the right password', async () => {
    const a = await hashSharePassword('open sesame', ITERATIONS);
    const b = await hashSharePassword('open sesame', ITERATIONS);
    expect(a).toMatch(/^pbkdf2-sha256\$1000\$[\w-]+\$[\w-]+$/);
    expect(a).not.toBe(b);
    expect(await verifySharePassword(a, 'open sesame')).toBe(true);
    expect(await verifySharePassword(a, 'open sesame!')).toBe(false);
  });

  it('refuses a malformed stored value whatever is typed', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const good = await hashSharePassword('pw', ITERATIONS);
    const [, , salt, hash] = good.split('$');
    const bad = [
      '',
      'plain-text-password',
      `md5$${ITERATIONS}$${salt}$${hash}`,
      `pbkdf2-sha256$many$${salt}$${hash}`,
      `pbkdf2-sha256$1.5$${salt}$${hash}`,
      `pbkdf2-sha256$999$${salt}$${hash}`,
      `pbkdf2-sha256$1000001$${salt}$${hash}`,
      `pbkdf2-sha256$${ITERATIONS}$$${hash}`,
      `pbkdf2-sha256$${ITERATIONS}$***$${hash}`,
      `pbkdf2-sha256$${ITERATIONS}$${salt}$`,
    ];
    for (const stored of bad) expect(await verifySharePassword(stored, 'pw')).toBe(false);
    expect(warn).toHaveBeenCalledTimes(bad.length);
  });

  it('refuses a salt that decodes to nothing', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const decode = vi.spyOn(globalThis, 'atob').mockReturnValueOnce('');
    expect(await verifySharePassword(`pbkdf2-sha256$${ITERATIONS}$AA$hash`, 'pw')).toBe(false);
    expect(decode).toHaveBeenCalled();
  });

  it('remembers a right password, and only a right one, the oldest forgotten first', async () => {
    const stored = await Promise.all(
      ['a', 'b', 'c'].map((pw) => hashSharePassword(pw, ITERATIONS)),
    );
    expect(await isRememberedSharePassword(stored[0]!, 'a')).toBe(false);
    expect(await verifySharePassword(stored[0]!, 'wrong')).toBe(false);
    expect(await isRememberedSharePassword(stored[0]!, 'wrong')).toBe(false);
    expect(await verifySharePassword(stored[0]!, 'a')).toBe(true);
    expect(await isRememberedSharePassword(stored[0]!, 'a')).toBe(true);
    expect(await verifySharePassword(stored[1]!, 'b')).toBe(true);
    // A third pushes the first out (the memory holds two here).
    expect(await verifySharePassword(stored[2]!, 'c')).toBe(true);
    expect(await isRememberedSharePassword(stored[0]!, 'a')).toBe(false);
    expect(await isRememberedSharePassword(stored[1]!, 'b')).toBe(true);
    expect(await isRememberedSharePassword(stored[2]!, 'c')).toBe(true);
  });

  it('copes with a memory that gives nothing back when full', async () => {
    const stored = await Promise.all(
      ['x', 'y', 'z'].map((pw) => hashSharePassword(pw, ITERATIONS)),
    );
    await verifySharePassword(stored[0]!, 'x');
    await verifySharePassword(stored[1]!, 'y');
    const values = vi.spyOn(Set.prototype, 'values').mockReturnValueOnce([][Symbol.iterator]());
    expect(await verifySharePassword(stored[2]!, 'z')).toBe(true);
    expect(values).toHaveBeenCalled();
  });
});
