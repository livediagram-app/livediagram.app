import { describe, expect, it } from 'vitest';
import { formLook } from './form-look';
import { getBuiltInTheme } from './themes';
import { themeAccent } from './page-default-background';

// A Form tab's look (docs/specs/030-forms/forms.md "Look").

describe('formLook', () => {
  it('takes the theme’s colour and backdrop for each half, with a readable colour on it', () => {
    const look = formLook({ theme: 'forest' }, {});
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

  it('keeps a colour the form chose, in both halves', () => {
    const look = formLook({ theme: 'forest' }, { accent: '#dc2626' });
    expect(look.accent).toEqual({ light: '#dc2626', dark: '#dc2626' });
  });

  it('carries the tab’s finish and a known font, never an unknown one', () => {
    expect(formLook({ finish: 'sketch', font: 'caveat' }, {})).toMatchObject({
      finish: 'sketch',
      font: 'caveat',
    });
    expect(formLook({ finish: 'nope', font: 'nope' }, {})).not.toHaveProperty('font');
    expect(formLook({ finish: 'nope' }, {}).finish).toBe('flexible');
  });

  it('draws the Default theme in the brand blue of each half', () => {
    expect(formLook({}, {}).accent).toEqual({ light: '#0284c7', dark: '#38bdf8' });
  });

  it('draws a custom or unknown theme as Default', () => {
    expect(formLook({ theme: 'custom-123' }, {})).toEqual(formLook({}, {}));
  });
});
