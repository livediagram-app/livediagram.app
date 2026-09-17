import { describe, expect, it } from 'vitest';
import { DEFAULT_SCHEME_ID, getBuiltInTheme, THEMES } from './themes';

// The Default colour scheme (spec/09): one scheme, two appearances. It used to
// be two separate entries — "Basic" leading the catalogue and "Charcoal"
// leading the Dark category — which forced anyone working in dark chrome to
// pick a second, differently-named scheme to get a canvas that matched, and
// then left that pick baked into the diagram for every other viewer.
//
// Now the same scheme answers both: the viewer's Appearance decides which half
// they see (spec/07). Neither half paints an element — the Default scheme is
// still the un-themed default, so element ink comes from the canvas underneath
// rather than from stored colours, which is what lets one tab look right to a
// light viewer and a dark one at the same time.
describe('the Default colour scheme', () => {
  it('leads the catalogue, under its own name', () => {
    expect(THEMES[0]?.id).toBe(DEFAULT_SCHEME_ID);
    expect(THEMES[0]?.label).toBe('Default');
  });

  it('is one scheme in two appearances, not two schemes', () => {
    const light = getBuiltInTheme(DEFAULT_SCHEME_ID, 'light');
    const dark = getBuiltInTheme(DEFAULT_SCHEME_ID, 'dark');
    // Same identity, so a tab stores one id whichever appearance applied it.
    expect(light.id).toBe(dark.id);
    expect(light.label).toBe(dark.label);
    // Different canvas.
    expect(light.backgroundColor).toBe('#ffffff');
    expect(dark.backgroundColor).toBe('#2b2b33');
    expect(light.patternColor).not.toBe(dark.patternColor);
  });

  it('defaults to the light half when no appearance is given', () => {
    // Every pure caller (exports, the MCP worker, a node test) has no viewer
    // to ask, and must land somewhere predictable.
    expect(getBuiltInTheme(DEFAULT_SCHEME_ID)).toEqual(getBuiltInTheme(DEFAULT_SCHEME_ID, 'light'));
  });

  it('paints no element colours in either appearance', () => {
    for (const appearance of ['light', 'dark'] as const) {
      const scheme = getBuiltInTheme(DEFAULT_SCHEME_ID, appearance);
      expect(scheme.elementFill).toBeNull();
      expect(scheme.elementStroke).toBeNull();
      expect(scheme.elementText).toBeNull();
    }
  });

  it('answers an unknown id with the Default scheme for that appearance', () => {
    expect(getBuiltInTheme(undefined, 'dark').backgroundColor).toBe('#2b2b33');
    expect(getBuiltInTheme('not-a-scheme', 'light').backgroundColor).toBe('#ffffff');
  });
});

// Charcoal was merged into Default, but diagrams saved against it are still out
// there. Dropping the id would silently repaint someone's board, so it stays
// resolvable — just not offered.
describe('the Charcoal scheme it replaced', () => {
  it('is no longer offered in the catalogue', () => {
    expect(THEMES.map((t) => t.id)).not.toContain('charcoal');
  });

  it('still resolves, with the colours it always had', () => {
    const charcoal = getBuiltInTheme('charcoal');
    expect(charcoal.id).toBe('charcoal');
    expect(charcoal.backgroundColor).toBe('#2b2b33');
    // Its element colours are BAKED into those diagrams' elements, so the
    // scheme has to keep matching them.
    expect(charcoal.elementFill).toBe('#2c2c33');
    expect(charcoal.elementStroke).toBe('#a1a1aa');
    expect(charcoal.elementText).toBe('#e4e4e7');
  });

  it('ignores the appearance, unlike Default', () => {
    expect(getBuiltInTheme('charcoal', 'light')).toEqual(getBuiltInTheme('charcoal', 'dark'));
  });
});
