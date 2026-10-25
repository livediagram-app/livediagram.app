import { describe, expect, it } from 'vitest';
import { base64ToBytes, bytesToBase64Url, randomBase64Url } from './base64';

const every = Uint8Array.from({ length: 256 }, (_, i) => i);

describe('bytesToBase64Url / base64ToBytes', () => {
  it('round-trips every byte value', () => {
    const text = bytesToBase64Url(every);
    expect(text).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(base64ToBytes(text)).toEqual(every);
  });

  it('round-trips every length around the padding boundary, unpadded', () => {
    for (let n = 0; n <= 9; n++) {
      const bytes = every.slice(250 - n, 250);
      const text = bytesToBase64Url(bytes);
      expect(text).not.toContain('=');
      expect(base64ToBytes(text)).toEqual(bytes);
    }
  });

  it('takes an ArrayBuffer as well as a Uint8Array', () => {
    const bytes = new Uint8Array([251, 255, 0, 62, 63]);
    expect(bytesToBase64Url(bytes.buffer)).toBe(bytesToBase64Url(bytes));
  });

  it('writes the url-safe alphabet', () => {
    // 0xfb 0xff encodes to "+/8=" in plain base64.
    expect(bytesToBase64Url(new Uint8Array([0xfb, 0xff]))).toBe('-_8');
  });

  it('reads plain, padded base64 too (the key secret)', () => {
    const bytes = new Uint8Array([0xfb, 0xff]);
    expect(base64ToBytes('+/8=')).toEqual(bytes);
    expect(base64ToBytes('-_8')).toEqual(bytes);
    expect(base64ToBytes(btoa('hello'))).toEqual(new TextEncoder().encode('hello'));
  });

  it('answers null for text that is neither', () => {
    expect(base64ToBytes('not base64!')).toBeNull();
    expect(base64ToBytes('a b')).toBeNull();
    expect(base64ToBytes('abc===')).toBeNull();
    expect(base64ToBytes('a')).toBeNull();
    expect(base64ToBytes('ab=c')).toBeNull();
  });

  it('reads the empty string as no bytes', () => {
    expect(base64ToBytes('')).toEqual(new Uint8Array(0));
  });
});

describe('randomBase64Url', () => {
  it('encodes that many random bytes, different each time', () => {
    const a = randomBase64Url(16);
    const b = randomBase64Url(16);
    expect(base64ToBytes(a)).toHaveLength(16);
    expect(a).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(a).not.toBe(b);
  });
});
