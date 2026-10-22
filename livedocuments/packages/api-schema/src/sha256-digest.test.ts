import { afterEach, describe, expect, it, vi } from 'vitest';
import { sha256, sha256Fallback } from './sha256-digest';

// docs/specs/016-platform/secure-context.md: the plain-code digest must equal Web Crypto's byte for byte, since
// a client outside a secure context and the server (or another client) compare the same hashes.

// The runtime's own Web Crypto, held before any test stubs the global.
const webcrypto = globalThis.crypto;
const hex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
const enc = (s: string) => new TextEncoder().encode(s);

describe('sha256Fallback', () => {
  it('matches the FIPS 180-4 test vectors', () => {
    expect(hex(sha256Fallback(enc('')))).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    );
    expect(hex(sha256Fallback(enc('abc')))).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
    expect(
      hex(sha256Fallback(enc('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq'))),
    ).toBe('248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1');
  });

  it('equals Web Crypto at every length across the padding boundaries', async () => {
    for (const n of [1, 55, 56, 57, 63, 64, 65, 119, 120, 128, 1000, 4096]) {
      const bytes = webcrypto.getRandomValues(new Uint8Array(n));
      const real = new Uint8Array(await webcrypto.subtle.digest('SHA-256', bytes));
      expect(hex(sha256Fallback(bytes))).toBe(hex(real));
    }
  });
});

describe('sha256', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('uses the plain-code digest where the context has no crypto.subtle', async () => {
    vi.stubGlobal('crypto', { getRandomValues: webcrypto.getRandomValues.bind(webcrypto) });
    expect(hex(await sha256(enc('abc')))).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
    // An ArrayBuffer and a view of part of one hash the same bytes.
    const buf = enc('xxabcxx');
    expect(hex(await sha256(buf.subarray(2, 5)))).toBe(hex(await sha256(enc('abc'))));
    expect(hex(await sha256(enc('abc').buffer))).toBe(hex(await sha256(enc('abc'))));
  });

  it('uses Web Crypto where it is there', async () => {
    const digest = vi.fn(async () => new Uint8Array(32).buffer);
    vi.stubGlobal('crypto', { subtle: { digest } });
    await sha256(enc('abc'));
    expect(digest).toHaveBeenCalledWith('SHA-256', enc('abc'));
  });
});
