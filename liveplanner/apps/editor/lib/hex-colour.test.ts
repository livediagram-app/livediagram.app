import { describe, expect, it } from 'vitest';
import { normaliseHex } from './hex-colour';

describe('normaliseHex', () => {
  it('accepts #RGB and #RRGGBB, with or without the hash, as lower case', () => {
    expect(normaliseHex('#F80')).toBe('#ff8800');
    expect(normaliseHex('1A2B3C')).toBe('#1a2b3c');
    expect(normaliseHex(' #abcdef ')).toBe('#abcdef');
  });

  it('rejects anything else', () => {
    for (const bad of ['', '#12', '#12345', 'red', '#gggggg', 'rgb(0,0,0)']) {
      expect(normaliseHex(bad)).toBeNull();
    }
  });
});
