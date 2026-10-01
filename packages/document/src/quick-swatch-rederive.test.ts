import { describe, expect, it } from 'vitest';
import { rederiveQuickSwatches } from './quick-swatch-rederive';
import { quickSwatchColor } from './quick-swatches';
import {
  recolourElementsForTheme,
  resetArrowsToTheme,
  resetThemeElementsToTheme,
  switchThemeElements,
} from './theme-graph';
import { THEMES } from './themes-data';
import type { ArrowElement, ShapeElement, TextElement } from './index';
import type { ThemeDefinition } from './themes';

// docs/specs/008-canvas/quick-style-panel.md "Colours": a bound colour follows a theme change.

const theme = (id: string): ThemeDefinition => THEMES.find((t) => t.id === id)!;
const forest = theme('forest');
const ocean = theme('ocean');

const shape = (extra: Partial<ShapeElement> = {}): ShapeElement => ({
  id: 's',
  type: 'shape',
  shape: 'circle',
  x: 0,
  y: 0,
  width: 100,
  height: 100,
  ...extra,
});
const arrow = (extra: Partial<ArrowElement> = {}): ArrowElement => ({
  id: 'a',
  type: 'arrow',
  from: { kind: 'free', x: 0, y: 0 },
  to: { kind: 'free', x: 50, y: 0 },
  ...extra,
});

const greenShape = shape({
  strokeColor: quickSwatchColor(forest, 'stroke', 4),
  strokeSwatch: 4,
  fillColor: quickSwatchColor(forest, 'fill', 4),
  fillSwatch: 4,
});

describe('rederiveQuickSwatches', () => {
  it('re-reads a bound stroke and background from the same slot of the new theme', () => {
    const next = rederiveQuickSwatches(greenShape, ocean) as ShapeElement;
    expect(next.strokeColor).toBe(quickSwatchColor(ocean, 'stroke', 4));
    expect(next.fillColor).toBe(quickSwatchColor(ocean, 'fill', 4));
    expect(next.strokeSwatch).toBe(4);
  });

  it('leaves an unbound element untouched, by reference', () => {
    const plain = shape({ strokeColor: '#123456' });
    expect(rederiveQuickSwatches(plain, ocean)).toBe(plain);
  });

  it('ignores a slot outside 1 to 6 rather than guessing', () => {
    const junk = shape({ strokeColor: '#123456', strokeSwatch: 9 as never });
    expect(rederiveQuickSwatches(junk, ocean)).toBe(junk);
  });

  it('re-reads an arrow’s bound stroke', () => {
    const a = arrow({ strokeColor: quickSwatchColor(forest, 'stroke', 1), strokeSwatch: 1 });
    expect((rederiveQuickSwatches(a, ocean) as ArrowElement).strokeColor).toBe(
      quickSwatchColor(ocean, 'stroke', 1),
    );
  });
});

describe('the theme walks honour swatch bindings', () => {
  it('switching the theme moves a bound shape to the new theme’s slot', () => {
    const [next] = switchThemeElements([greenShape], forest, ocean) as ShapeElement[];
    expect(next!.fillColor).toBe(quickSwatchColor(ocean, 'fill', 4));
  });

  it('switching the theme keeps a bound arrow’s colour instead of resetting it', () => {
    const a = arrow({ strokeColor: quickSwatchColor(forest, 'stroke', 2), strokeSwatch: 2 });
    const [next] = resetArrowsToTheme([a], ocean) as ArrowElement[];
    expect(next!.strokeColor).toBe(quickSwatchColor(ocean, 'stroke', 2));
  });

  it('reset to theme and recolour keep the binding, like a preset', () => {
    const [reset] = resetThemeElementsToTheme([greenShape], ocean) as ShapeElement[];
    expect(reset!.strokeColor).toBe(quickSwatchColor(ocean, 'stroke', 4));
    const [recoloured] = recolourElementsForTheme([greenShape], ocean) as ShapeElement[];
    expect(recoloured!.fillColor).toBe(quickSwatchColor(ocean, 'fill', 4));
  });
});

describe('rederiveQuickSwatches: text elements', () => {
  const text = (extra: Partial<TextElement> = {}): TextElement => ({
    id: 't',
    type: 'text',
    x: 0,
    y: 0,
    width: 220,
    height: 64,
    ...extra,
  });

  it("re-reads a bound text colour from the new theme's slot", () => {
    const el = text({ textColor: quickSwatchColor(forest, 'text', 4), textSwatch: 4 });
    expect(rederiveQuickSwatches(el, ocean)).toMatchObject({
      textColor: quickSwatchColor(ocean, 'text', 4),
      textSwatch: 4,
    });
  });

  it('leaves an unbound text colour alone', () => {
    const el = text({ textColor: '#aa0000' });
    expect(rederiveQuickSwatches(el, ocean)).toBe(el);
  });

  it('keeps the binding through a theme switch', () => {
    const el = text({ textColor: quickSwatchColor(forest, 'text', 2), textSwatch: 2 });
    const [next] = switchThemeElements([el], forest, ocean) as TextElement[];
    expect(next!.textColor).toBe(quickSwatchColor(ocean, 'text', 2));
  });
});
