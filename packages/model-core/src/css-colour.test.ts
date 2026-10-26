import { describe, expect, it } from 'vitest';
import { cssColourNames, parseCssColour, parseCssColourAlpha } from './css-colour';

describe('parseCssColour', () => {
  it('reads every hex length CSS allows, with or without the #, in either case', () => {
    expect(parseCssColour('#0ea5E9')).toEqual({ r: 14, g: 165, b: 233 });
    expect(parseCssColour('0ea5e9')).toEqual({ r: 14, g: 165, b: 233 });
    expect(parseCssColour('#fff')).toEqual({ r: 255, g: 255, b: 255 });
    expect(parseCssColour('#F0a')).toEqual({ r: 255, g: 0, b: 170 });
    // Alpha is read past: callers mix and compare solid colours.
    expect(parseCssColour('#f0a8')).toEqual({ r: 255, g: 0, b: 170 });
    expect(parseCssColour('#0ea5e980')).toEqual({ r: 14, g: 165, b: 233 });
  });

  it('reads CSS named colours in any case', () => {
    expect(parseCssColour('red')).toEqual({ r: 255, g: 0, b: 0 });
    expect(parseCssColour('RebeccaPurple')).toEqual({ r: 102, g: 51, b: 153 });
    expect(parseCssColour(' white ')).toEqual({ r: 255, g: 255, b: 255 });
  });

  it('knows all 148 names, each a six-digit hex', () => {
    const names = cssColourNames();
    expect(names).toHaveLength(148);
    for (const name of names) expect(parseCssColour(name)).not.toBeNull();
  });

  it('is null for anything else', () => {
    for (const bad of [
      '',
      '#',
      '#ff',
      '#fffff',
      '#1234567',
      'rgb(1,2,3)',
      'transparent',
      'not a colour',
      '#ggg',
      // A shorthand needs its #, as in CSS.
      'fff',
      'bad',
      'cafe',
    ]) {
      expect(parseCssColour(bad)).toBeNull();
    }
  });
});

describe('parseCssColourAlpha', () => {
  it('keeps the alpha a colour gives, and is opaque when it gives none', () => {
    expect(parseCssColourAlpha('#f0a8')).toEqual({ r: 255, g: 0, b: 170, a: 136 });
    expect(parseCssColourAlpha('#0ea5e980')).toEqual({ r: 14, g: 165, b: 233, a: 128 });
    expect(parseCssColourAlpha('#fff')).toEqual({ r: 255, g: 255, b: 255, a: 255 });
    expect(parseCssColourAlpha('0ea5e9')).toEqual({ r: 14, g: 165, b: 233, a: 255 });
    expect(parseCssColourAlpha('Red')).toEqual({ r: 255, g: 0, b: 0, a: 255 });
    expect(parseCssColourAlpha('transparent')).toBeNull();
  });
});
