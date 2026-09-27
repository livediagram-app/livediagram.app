import { describe, expect, it } from 'vitest';
import { DEFAULT_SCHEME_ID, getBuiltInTheme, THEMES } from './themes';

// The Default colour scheme (docs/specs/008-canvas/canvas-and-palette.md): one scheme, two appearances. It used to
// be two separate entries — "Basic" leading the catalogue and "Charcoal"
// leading the Dark category — which forced anyone working in dark chrome to
// pick a second, differently-named scheme to get a canvas that matched, and
// then left that pick baked into the diagram for every other viewer.
//
// Now the same scheme answers both: the viewer's Appearance decides which half
// they see (docs/specs/007-editor/live-app.md). Neither half paints an element — the Default scheme is
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
    expect(dark.backgroundColor).toBe('#0d121a');
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
    expect(getBuiltInTheme(undefined, 'dark').backgroundColor).toBe('#0d121a');
    expect(getBuiltInTheme('not-a-scheme', 'light').backgroundColor).toBe('#ffffff');
  });
});

// Charcoal was merged into Default. Diagrams saved against it are migrated to
// Default on read (docs/specs/011-theme/retired-schemes.md), so the catalogue no longer carries it at all.
describe('the Charcoal scheme it replaced', () => {
  it('is no longer offered in the catalogue', () => {
    expect(THEMES.map((t) => t.id)).not.toContain('charcoal');
  });

  it('no longer resolves as a scheme of its own', () => {
    expect(getBuiltInTheme('charcoal', 'dark')).toEqual(getBuiltInTheme(DEFAULT_SCHEME_ID, 'dark'));
    expect(getBuiltInTheme('charcoal', 'light')).toEqual(
      getBuiltInTheme(DEFAULT_SCHEME_ID, 'light'),
    );
  });
});
