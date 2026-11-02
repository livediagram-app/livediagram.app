import { describe, expect, it } from 'vitest';
import { contrastRatio } from './colors';
import { labelOn, reachContrast, THEME_TEXT_CONTRAST } from './readable-colour';

describe('reachContrast', () => {
  it('returns a colour that already reads as it is', () => {
    expect(reachContrast('#0f172a', '#ffffff', THEME_TEXT_CONTRAST)).toBe('#0f172a');
  });

  it('walks a colour away from its background until it reads', () => {
    // Pine's accent on white is 1.4:1.
    const out = reachContrast('#86efac', '#ffffff', THEME_TEXT_CONTRAST);
    expect(contrastRatio(out, '#ffffff')).toBeGreaterThanOrEqual(THEME_TEXT_CONTRAST);
  });

  it('walks lighter on a dark background', () => {
    const out = reachContrast('#334155', '#0f172a', THEME_TEXT_CONTRAST);
    expect(contrastRatio(out, '#0f172a')).toBeGreaterThanOrEqual(THEME_TEXT_CONTRAST);
  });

  it('turns back when the first way runs out of range before it reads', () => {
    // #777777 sits just under the turn, so white was walked lighter, where it cannot go, and stayed at 4.48:1.
    for (const fg of ['#ffffff', '#333333']) {
      const out = reachContrast(fg, '#777777', THEME_TEXT_CONTRAST);
      expect(contrastRatio(out, '#777777')).toBeGreaterThanOrEqual(THEME_TEXT_CONTRAST);
    }
  });

  it('leaves an unparseable colour alone', () => {
    expect(reachContrast('transparent', '#ffffff', THEME_TEXT_CONTRAST)).toBe('transparent');
  });
});

describe('labelOn', () => {
  // Agents write `#fff` and `red` (docs/specs/011-theme/light-and-dark.md "Colours an agent writes").
  it('reads a shorthand or named fill, and the label it picks reads on it', () => {
    for (const fill of ['#fff', '#fc0', '#0a58', 'red', 'navy', 'gold', 'cornflowerblue', 'teal']) {
      const label = labelOn(fill);
      expect(label).toMatch(/^#[0-9a-f]{6}$/);
      expect(contrastRatio(label, fill)).toBeGreaterThanOrEqual(THEME_TEXT_CONTRAST);
    }
    expect(labelOn('navy')).toBe('#ffffff');
    expect(labelOn('#fff')).not.toBe('#ffffff');
  });

  it('keeps white on a fill dark enough for it', () => {
    expect(labelOn('#0f172a')).toBe('#ffffff');
  });

  it('keeps a deep shade on a light fill', () => {
    expect(contrastRatio(labelOn('#e0f2fe'), '#e0f2fe')).toBeGreaterThanOrEqual(
      THEME_TEXT_CONTRAST,
    );
    expect(labelOn('#e0f2fe')).not.toBe('#ffffff');
  });

  it('reaches the floor on a mid-tone fill that neither first choice reads on', () => {
    // White on the brand sky blue is 2.8:1.
    const label = labelOn('#0ea5e9');
    expect(contrastRatio(label, '#0ea5e9')).toBeGreaterThanOrEqual(THEME_TEXT_CONTRAST);
  });

  it('reaches the floor on a mid grey just darker than the turn', () => {
    for (const fill of ['#777777', '#787878', '#767676']) {
      expect(contrastRatio(labelOn(fill), fill), fill).toBeGreaterThanOrEqual(THEME_TEXT_CONTRAST);
    }
  });
});
