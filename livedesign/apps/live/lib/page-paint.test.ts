import { describe, expect, it } from 'vitest';
import { pageIsDark, type Page } from '@livedesign/document';
import {
  fillCss,
  gradientFill,
  PAGE_GRADIENT_PRESETS,
  pageSheetStyle,
  sameFill,
  themeBackgroundPresets,
  withBackgroundPatch,
} from './page-paint';

// docs/specs/007-editor/pages-mode.md "Backgrounds".
const page = (background?: Page['background']): Page => ({
  id: 'p',
  orientation: 'portrait',
  ...(background ? { background } : {}),
});

describe('page paint', () => {
  it('leaves the paper to the sheet, and paints a fill with its pattern over it', () => {
    expect(pageSheetStyle(undefined)).toEqual({});
    const style = pageSheetStyle({ fill: { kind: 'solid', color: '#0f172a' }, pattern: 'dots' });
    expect(style.backgroundColor).toBe('#0f172a');
    expect(style.backgroundImage).toContain('radial-gradient');
    // Light ink on a dark page.
    expect(style.color).toContain('255');
  });

  it('lays the pattern over a gradient', () => {
    const style = pageSheetStyle({
      fill: gradientFill(PAGE_GRADIENT_PRESETS[0]!),
      pattern: 'grid',
    });
    const layers = String(style.backgroundImage);
    expect(layers.indexOf('linear-gradient(160deg')).toBeGreaterThan(layers.indexOf('90deg'));
  });

  it('patches a background, dropping it once empty', () => {
    const solid = { kind: 'solid', color: '#e0f2fe' } as const;
    expect(withBackgroundPatch(page(), { fill: solid })).toEqual({ fill: solid });
    expect(withBackgroundPatch(page({ fill: solid }), { fill: undefined })).toBeUndefined();
    expect(withBackgroundPatch(page({ fill: solid }), { pattern: 'lines' })).toEqual({
      fill: solid,
      pattern: 'lines',
    });
  });

  it('compares fills by value', () => {
    const g = gradientFill(PAGE_GRADIENT_PRESETS.find((p) => p.id === 'ocean')!);
    expect(sameFill(g, { ...g })).toBe(true);
    expect(sameFill({ kind: 'solid', color: '#ABCDEF' }, { kind: 'solid', color: '#abcdef' })).toBe(
      true,
    );
    expect(sameFill(undefined, undefined)).toBe(true);
    expect(sameFill(g, undefined)).toBe(false);
    expect(fillCss(g)).toBe('linear-gradient(160deg, #bae6fd, #c7d2fe)');
  });

  it('draws fourteen gradients from the theme: seven light, then bold and deep', () => {
    const presets = themeBackgroundPresets({ elementStroke: '#7c3aed', palette: undefined });
    expect(presets).toHaveLength(14);
    expect(new Set(presets.map((p) => p.id)).size).toBe(14);
    expect(presets.every((p) => p.fill.kind === 'gradient')).toBe(true);
    // The first row is light paper for dark ink; the row ends in the deep ones.
    for (const p of presets.slice(0, 7))
      expect(pageIsDark({ background: { fill: p.fill } })).toBe(false);
    for (const p of presets.slice(-3))
      expect(pageIsDark({ background: { fill: p.fill } })).toBe(true);
    // No colours of its own: the brand accent still draws them.
    expect(themeBackgroundPresets({ elementStroke: null })).toHaveLength(14);
  });

  it('offers thirteen preset gradients, so they and Custom fill two rows of seven', () => {
    expect(PAGE_GRADIENT_PRESETS).toHaveLength(13);
    expect(new Set(PAGE_GRADIENT_PRESETS.map((p) => p.id)).size).toBe(13);
  });
});
