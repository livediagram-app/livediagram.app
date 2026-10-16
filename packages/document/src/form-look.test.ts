import { describe, expect, it } from 'vitest';
import { formLook } from './form-look';
import { getBuiltInTheme } from './themes';
import { themeAccent } from './page-default-background';

// A Form tab's look (docs/specs/030-forms/forms.md "Look").

describe('formLook', () => {
  it('takes the theme’s colour and backdrop for each half, with a readable colour on it', () => {
    const look = formLook({ theme: 'forest' });
    expect(look.accent).toEqual({
      light: themeAccent(getBuiltInTheme('forest', 'light')),
      dark: themeAccent(getBuiltInTheme('forest', 'dark')),
    });
    expect(look.backdrop).toEqual({
      light: getBuiltInTheme('forest', 'light').backgroundColor,
      dark: getBuiltInTheme('forest', 'dark').backgroundColor,
    });
    expect(look.onAccent.light).toMatch(/^#/);
    expect(look.finish).toBe('flexible');
    expect(look.font).toBeUndefined();
  });

  it('carries the tab’s finish and a known font, never an unknown one', () => {
    expect(formLook({ finish: 'sketch', font: 'caveat' })).toMatchObject({
      finish: 'sketch',
      font: 'caveat',
    });
    expect(formLook({ finish: 'nope', font: 'nope' })).not.toHaveProperty('font');
    expect(formLook({ finish: 'nope' }).finish).toBe('flexible');
  });

  it('draws the Default theme in the brand blue of each half', () => {
    expect(formLook({}).accent).toEqual({ light: '#0284c7', dark: '#38bdf8' });
  });

  it('draws a custom or unknown theme as Default', () => {
    expect(formLook({ theme: 'custom-123' })).toEqual(formLook({}));
  });

  describe('canvas', () => {
    it('is left out while the tab keeps its theme’s pattern, none, a plain one or an unknown one', () => {
      expect(formLook({})).not.toHaveProperty('canvas');
      const own = getBuiltInTheme('forest', 'light').backgroundPattern;
      expect(formLook({ theme: 'forest', backgroundPattern: own })).not.toHaveProperty('canvas');
      expect(formLook({ backgroundPattern: 'blank' })).not.toHaveProperty('canvas');
      // Stored data a newer or older editor wrote: never sent on.
      expect(formLook({ backgroundPattern: 'nope' as never })).not.toHaveProperty('canvas');
    });

    it('carries a picked pattern, its theme-painted colour following each half', () => {
      // A theme writes its pattern colour onto the tab when it is applied.
      const patternColor = getBuiltInTheme('forest', 'light').patternColor;
      const look = formLook({ theme: 'forest', backgroundPattern: 'aurora', patternColor });
      expect(look.canvas).toEqual({
        pattern: 'aurora',
        color: {
          light: getBuiltInTheme('forest', 'light').patternColor,
          dark: getBuiltInTheme('forest', 'dark').patternColor,
        },
      });
    });

    it('keeps a picked colour in both halves, and the sliders within their ranges', () => {
      const look = formLook({
        backgroundPattern: 'graph',
        patternColor: '#ff0000',
        backgroundPatternScale: 9,
        backgroundAnimationSpeed: 0.1,
        backgroundOpacity: 0.4,
      });
      expect(look.canvas).toEqual({
        pattern: 'graph',
        color: { light: '#ff0000', dark: '#ff0000' },
        scale: 2,
        speed: 0.25,
        opacity: 0.4,
      });
      expect(
        formLook({ backgroundPattern: 'graph', backgroundPatternScale: Number.NaN }).canvas,
      ).not.toHaveProperty('scale');
    });
  });
});
