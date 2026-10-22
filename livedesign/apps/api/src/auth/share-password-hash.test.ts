import { describe, expect, it, vi } from 'vitest';
import {
  hashSharePassword,
  isHashedSharePassword,
  MAX_STORED_ITERATIONS,
  SHARE_PASSWORD_ITERATIONS,
  verifySharePassword,
} from './share-password-hash';

// Share-password storage (docs/specs/013-workspace/share-password.md "Stored hashed").
const FAST = 1_000;

describe('hashSharePassword', () => {
  it('writes the self-describing format with the default iteration count', async () => {
    const stored = await hashSharePassword('hunter2');
    expect(stored).toMatch(/^pbkdf2-sha256\$100000\$[A-Za-z0-9_-]{22}\$[A-Za-z0-9_-]{43}$/);
    expect(SHARE_PASSWORD_ITERATIONS).toBe(100_000);
    expect(isHashedSharePassword(stored)).toBe(true);
  });

  it('salts every hash, so one password never stores the same value twice', async () => {
    expect(await hashSharePassword('hunter2', FAST)).not.toBe(
      await hashSharePassword('hunter2', FAST),
    );
  });

  it('never stores the password itself', async () => {
    expect(await hashSharePassword('hunter2', FAST)).not.toContain('hunter2');
  });
});

describe('verifySharePassword', () => {
  it('accepts the right password and refuses any other', async () => {
    const stored = await hashSharePassword('Hunter2', FAST);
    expect(await verifySharePassword(stored, 'Hunter2')).toEqual({ ok: true, legacy: false });
    expect(await verifySharePassword(stored, 'hunter2')).toEqual({ ok: false, legacy: false });
    expect(await verifySharePassword(stored, '')).toEqual({ ok: false, legacy: false });
  });

  it('reads the iteration count from the stored value', async () => {
    const stored = await hashSharePassword('pw', 2_000);
    expect(stored.split('$')[1]).toBe('2000');
    expect((await verifySharePassword(stored, 'pw')).ok).toBe(true);
  });

  it('treats a value without the prefix as legacy plain text', async () => {
    expect(await verifySharePassword('hunter2', 'hunter2')).toEqual({ ok: true, legacy: true });
    expect(await verifySharePassword('hunter2', 'nope')).toEqual({ ok: false, legacy: true });
  });

  // A corrupt or hostile row must neither match nor make a check burn CPU.
  it.each([
    'pbkdf2-sha256$',
    'pbkdf2-sha256$abc$c2FsdA$aGFzaA',
    'pbkdf2-sha256$10$c2FsdA$aGFzaA',
    `pbkdf2-sha256$${MAX_STORED_ITERATIONS + 1}$c2FsdA$aGFzaA`,
    'pbkdf2-sha256$100000$!!!$aGFzaA',
    'pbkdf2-sha256$100000$c2FsdA$',
  ])('refuses the malformed stored value %s', async (stored) => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const started = performance.now();
    expect(await verifySharePassword(stored, 'anything')).toEqual({ ok: false, legacy: false });
    expect(performance.now() - started).toBeLessThan(50);
    expect(warn).toHaveBeenCalledWith('[share-password] malformed stored hash refused');
    warn.mockRestore();
  });

  // The cost budget behind the spec's iteration count: a real derivation at
  // 100,000 iterations stays well inside what a request can spend. Generous
  // so a loaded CI machine never flakes it.
  it('derives at the default cost within budget', async () => {
    const stored = await hashSharePassword('hunter2');
    const started = performance.now();
    expect((await verifySharePassword(stored, 'hunter2')).ok).toBe(true);
    expect(performance.now() - started).toBeLessThan(1_000);
  });
});
