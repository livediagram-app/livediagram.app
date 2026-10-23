import { describe, expect, it } from 'vitest';
import { penColourHex } from '@livedocuments/document';
import { tagColourHex, tagWash } from './tag-colour';

describe('tagColourHex', () => {
  it('draws a standard colour in its version for the appearance', () => {
    expect(tagColourHex('blue', 'light')).toBe(penColourHex('blue', 'light'));
    expect(tagColourHex('blue', 'dark')).toBe(penColourHex('blue', 'dark'));
    expect(tagColourHex('blue', 'light')).not.toBe(tagColourHex('blue', 'dark'));
  });

  it('keeps a custom colour the same on both, lower-cased', () => {
    expect(tagColourHex('#AABBCC', 'dark')).toBe('#aabbcc');
  });

  it('draws an unknown value as grey', () => {
    expect(tagColourHex('chartreuse', 'light')).toBe(penColourHex('grey', 'light'));
  });
});

describe('tagWash', () => {
  it('washes the colour at low alpha', () => {
    expect(tagWash('#112233')).toEqual({ background: '#1122331f', borderColor: '#11223359' });
  });
});
