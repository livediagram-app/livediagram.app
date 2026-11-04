import { describe, expect, it } from 'vitest';
import { contrastRatio, shade } from '@liveworkspace/brand/colour';
import { PRESENCE_COLOURS } from '@liveworkspace/settings/presence';
import { createIdentityFill, IDENTITY_DARK_INK, IDENTITY_FILL } from './identity-fill';

// Text on an identity colour (docs/specs/004-interface-design/color-scheme.md, Dark palette rules): white where it
// reaches AA on the fill, otherwise the dark ink, in light and dark alike (Work Tracker #441).
const { identityDeep, identityInk, identityVars } = createIdentityFill({ shade, contrastRatio });

type Vars = Record<
  '--identity' | '--identity-ink' | '--identity-deep' | '--identity-deep-ink',
  string
>;

describe('identity ink', () => {
  it('reads at AA on every presence colour, in light and in dark', () => {
    for (const { value, name } of PRESENCE_COLOURS) {
      const vars = identityVars(value) as Vars;
      expect(
        contrastRatio(vars['--identity-ink'], vars['--identity']),
        `${name} light`,
      ).toBeGreaterThanOrEqual(4.5);
      expect(
        contrastRatio(vars['--identity-deep-ink'], vars['--identity-deep']),
        `${name} dark`,
      ).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('keeps white wherever white reads, and the deep shades all keep it', () => {
    expect(identityInk('#1e3a8a')).toBe('#ffffff');
    for (const { deep } of PRESENCE_COLOURS) expect(identityInk(deep)).toBe('#ffffff');
  });

  it('takes the dark ink where white falls short, down to indigo at 4.47:1', () => {
    expect(identityInk('#6366f1')).toBe(IDENTITY_DARK_INK);
    expect(identityInk('#84cc16')).toBe(IDENTITY_DARK_INK);
  });

  it('gives a custom colour a deep shade white reads on, and its inks to match', () => {
    const vars = identityVars('#fde047') as Vars;
    expect(contrastRatio('#ffffff', vars['--identity-deep'])).toBeGreaterThanOrEqual(4.5);
    expect(vars['--identity-ink']).toBe(IDENTITY_DARK_INK);
    expect(vars['--identity-deep-ink']).toBe('#ffffff');
    expect(identityDeep('#1e3a8a')).toBe('#1e3a8a');
  });

  it('falls back to black where no shade reaches AA', () => {
    const stubborn = createIdentityFill({ shade: (hex) => hex, contrastRatio: () => 1 });
    expect(stubborn.identityDeep('#fde047')).toBe('#000000');
  });

  it('keeps white on a colour it cannot read', () => {
    expect(identityDeep('hsl(10 50% 50%)')).toBe('hsl(10 50% 50%)');
    expect(identityInk('hsl(10 50% 50%)')).toBe('#ffffff');
  });

  it('paints both inks over any text colour a caller set, falling back to white', () => {
    expect(IDENTITY_FILL).toContain('text-[color:var(--identity-ink,#fff)]!');
    expect(IDENTITY_FILL).toContain('dark:text-[color:var(--identity-deep-ink,#fff)]!');
  });
});
