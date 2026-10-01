import { describe, expect, it } from 'vitest';
import { base64ToBytes, bytesToBase64, bytesToBase64Url } from './bytes';

// Vectors from RFC 4648 §10, plus the bytes that differ between the standard
// and URL-safe alphabets (0xfb 0xff encodes to `+/8` / `-_8`).
const text = (s: string) => new TextEncoder().encode(s);

describe('bytesToBase64', () => {
  it('matches the RFC 4648 vectors, padding included', () => {
    expect(bytesToBase64(text(''))).toBe('');
    expect(bytesToBase64(text('f'))).toBe('Zg==');
    expect(bytesToBase64(text('fo'))).toBe('Zm8=');
    expect(bytesToBase64(text('foobar'))).toBe('Zm9vYmFy');
  });

  it('accepts an ArrayBuffer as well as a Uint8Array', () => {
    expect(bytesToBase64(text('foo').buffer as ArrayBuffer)).toBe('Zm9v');
  });

  it('keeps the standard alphabet', () => {
    expect(bytesToBase64(new Uint8Array([0xfb, 0xff]))).toBe('+/8=');
  });

  it('encodes a buffer larger than one chunk without overflowing the call stack', () => {
    // 3 * 0x10000 bytes: several chunks, and a multiple of 3 so no padding.
    const big = new Uint8Array(3 * 0x10000).map((_, i) => i % 256);
    const out = bytesToBase64(big);
    expect(out.length).toBe(4 * 0x10000);
    // Round-trips through the platform decoder byte for byte.
    const back = Uint8Array.from(atob(out), (c) => c.charCodeAt(0));
    expect(back).toEqual(big);
  });
});

describe('bytesToBase64Url', () => {
  it('swaps to the URL-safe alphabet and drops the padding', () => {
    expect(bytesToBase64Url(new Uint8Array([0xfb, 0xff]))).toBe('-_8');
    expect(bytesToBase64Url(text('f'))).toBe('Zg');
  });

  it('matches the RFC 7636 PKCE S256 example challenge', async () => {
    const digest = await crypto.subtle.digest(
      'SHA-256',
      text('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk'),
    );
    expect(bytesToBase64Url(digest)).toBe('E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');
  });
});

describe('base64ToBytes', () => {
  it('decodes both alphabets, with or without padding', () => {
    expect([...base64ToBytes('+/8=')!]).toEqual([0xfb, 0xff]);
    expect([...base64ToBytes('-_8')!]).toEqual([0xfb, 0xff]);
    expect(new TextDecoder().decode(base64ToBytes('Zm9vYmFy')!)).toBe('foobar');
  });

  it('answers null for text that is not base64', () => {
    expect(base64ToBytes('not base64!')).toBeNull();
  });

  it('round-trips bytesToBase64Url', () => {
    const bytes = new Uint8Array(40).map((_, i) => (i * 37) % 256);
    expect([...base64ToBytes(bytesToBase64Url(bytes))!]).toEqual([...bytes]);
  });
});
