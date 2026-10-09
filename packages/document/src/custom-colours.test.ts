import { describe, expect, it } from 'vitest';
import { CUSTOM_COLOURS_MAX, customColoursOf, withCustomColour } from './custom-colours';

// docs/specs/004-interface-design/colour-picker.md "Custom colours"
describe('a tab’s custom colours', () => {
  it('reads stored colours lower-cased and deduped, dropping anything not #rrggbb', () => {
    expect(customColoursOf({ customColours: ['#ABCDEF', '#abcdef', 'red', '#abc'] })).toEqual([
      '#abcdef',
    ]);
    expect(customColoursOf({})).toEqual([]);
    expect(customColoursOf({ customColours: 'nope' as never })).toEqual([]);
  });

  it('puts a pick first, moving it if already there, and caps the list', () => {
    const tab = { customColours: ['#111111', '#222222'] };
    expect(withCustomColour(tab, '#222222').customColours).toEqual(['#222222', '#111111']);
    expect(withCustomColour(tab, '#ABCDEF').customColours).toEqual([
      '#abcdef',
      '#111111',
      '#222222',
    ]);
    const full = {
      customColours: Array.from(
        { length: CUSTOM_COLOURS_MAX },
        (_, i) => `#0000${(16 + i).toString(16)}`,
      ),
    };
    const next = withCustomColour(full, '#ffffff').customColours!;
    expect(next).toHaveLength(CUSTOM_COLOURS_MAX);
    expect(next[0]).toBe('#ffffff');
  });

  it('returns the same tab for a non-colour or the colour already newest', () => {
    const tab = { customColours: ['#111111'] };
    expect(withCustomColour(tab, '#111111')).toBe(tab);
    expect(withCustomColour(tab, 'transparent')).toBe(tab);
  });
});
