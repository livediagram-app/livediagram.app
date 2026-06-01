import type {
  ArrowElement,
  Element,
  ShapeElement,
  StickyElement,
  TextElement,
} from '@livediagram/diagram';
import { describe, expect, it } from 'vitest';
import {
  THEMES,
  getTheme,
  recolourElementForTheme,
  resetThemeElement,
  switchThemeElement,
  type ThemeDefinition,
} from './themes';

describe('THEMES catalogue', () => {
  it('has a unique id per theme', () => {
    const ids = THEMES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('leads with the brand theme (the un-themed default)', () => {
    expect(THEMES[0]?.id).toBe('brand');
  });

  it('gives every theme a label and a backdrop', () => {
    for (const t of THEMES) {
      expect(t.label.length).toBeGreaterThan(0);
      expect(t.backgroundColor).toMatch(/^#[0-9a-f]{3,8}$/i);
      expect(t.patternColor).toMatch(/^#[0-9a-f]{3,8}$/i);
      expect(t.backgroundPattern).toBeTruthy();
    }
  });
});

describe('getTheme', () => {
  it('returns the matching theme by id', () => {
    const slate = getTheme('slate');
    expect(slate.id).toBe('slate');
  });

  it('falls back to the brand theme for an unknown id', () => {
    expect(getTheme('does-not-exist').id).toBe('brand');
  });

  it('falls back to the brand theme for undefined', () => {
    expect(getTheme(undefined).id).toBe('brand');
  });

  it('returns the exact catalogue object (referential, not a copy)', () => {
    expect(getTheme('forest')).toBe(THEMES.find((t) => t.id === 'forest'));
  });
});

describe('recolourElementForTheme', () => {
  const themed: ThemeDefinition = {
    id: 'slate',
    label: 'Slate',
    backgroundColor: '#f1f5f9',
    backgroundPattern: 'grid',
    patternColor: '#cbd5e1',
    elementFill: '#e2e8f0',
    elementStroke: '#475569',
    elementText: '#0f172a',
  };
  const passthrough: ThemeDefinition = {
    id: 'brand',
    label: 'Brand',
    backgroundColor: '#ffffff',
    backgroundPattern: 'grid',
    patternColor: '#e0f2fe',
    elementFill: null,
    elementStroke: null,
    elementText: null,
  };
  const shape: ShapeElement = {
    id: 's',
    type: 'shape',
    shape: 'square',
    x: 0,
    y: 0,
    width: 100,
    height: 50,
  };
  const text: TextElement = {
    id: 't',
    type: 'text',
    x: 0,
    y: 0,
    width: 100,
    height: 30,
    label: 'hello',
  };
  const arrow: ArrowElement = {
    id: 'a',
    type: 'arrow',
    from: { kind: 'free', x: 0, y: 0 },
    to: { kind: 'free', x: 50, y: 50 },
  };
  const sticky: StickyElement = {
    id: 'n',
    type: 'sticky',
    x: 0,
    y: 0,
    width: 200,
    height: 200,
  };

  it('writes fill, stroke, and text on shapes when the theme overrides each', () => {
    const out = recolourElementForTheme(shape, themed) as ShapeElement;
    expect(out.fillColor).toBe('#e2e8f0');
    expect(out.strokeColor).toBe('#475569');
    expect(out.textColor).toBe('#0f172a');
  });

  it('writes only the text colour on text elements', () => {
    const out = recolourElementForTheme(text, themed) as TextElement;
    expect(out.textColor).toBe('#0f172a');
    // Spot-check: no rogue fill / stroke fields appear on a text element.
    expect((out as unknown as Record<string, unknown>).fillColor).toBeUndefined();
    expect((out as unknown as Record<string, unknown>).strokeColor).toBeUndefined();
  });

  it('writes the stroke colour on arrows so themed templates have themed connectors', () => {
    // This is the path that the in-editor "Browse templates" picker
    // previously skipped, leaving arrows in mindmap / flowchart /
    // flywheel templates stuck at the brand default.
    const out = recolourElementForTheme(arrow, themed) as ArrowElement;
    expect(out.strokeColor).toBe('#475569');
  });

  it('leaves sticky notes untouched so the iconic amber palette survives', () => {
    const out = recolourElementForTheme(sticky, themed);
    expect(out).toEqual(sticky);
  });

  it('no-ops every type when the theme has no element-colour overrides (Brand)', () => {
    const inputs: Element[] = [shape, text, arrow, sticky];
    for (const el of inputs) {
      const out = recolourElementForTheme(el, passthrough);
      expect(out).toEqual(el);
    }
  });
});

describe('switchThemeElement', () => {
  const prev: ThemeDefinition = {
    id: 'brand',
    label: 'Brand',
    backgroundColor: '#fff',
    backgroundPattern: 'grid',
    patternColor: '#e0f2fe',
    elementFill: '#bae6fd',
    elementStroke: '#0284c7',
    elementText: '#0c4a6e',
  };
  const next: ThemeDefinition = {
    id: 'slate',
    label: 'Slate',
    backgroundColor: '#f1f5f9',
    backgroundPattern: 'grid',
    patternColor: '#cbd5e1',
    elementFill: '#e2e8f0',
    elementStroke: '#475569',
    elementText: '#0f172a',
  };

  it('replaces a field that still matches the previous theme', () => {
    const el: ShapeElement = {
      id: 's',
      type: 'shape',
      shape: 'square',
      x: 0,
      y: 0,
      width: 100,
      height: 50,
      fillColor: prev.elementFill ?? undefined,
      strokeColor: prev.elementStroke ?? undefined,
      textColor: prev.elementText ?? undefined,
    };
    const out = switchThemeElement(el, prev, next) as ShapeElement;
    expect(out.fillColor).toBe(next.elementFill);
    expect(out.strokeColor).toBe(next.elementStroke);
    expect(out.textColor).toBe(next.elementText);
  });

  it('keeps a field the user has customised (does not match previous theme)', () => {
    const el: ShapeElement = {
      id: 's',
      type: 'shape',
      shape: 'square',
      x: 0,
      y: 0,
      width: 100,
      height: 50,
      fillColor: '#ff00ff',
      strokeColor: prev.elementStroke ?? undefined,
      textColor: prev.elementText ?? undefined,
    };
    const out = switchThemeElement(el, prev, next) as ShapeElement;
    // Custom fill is kept.
    expect(out.fillColor).toBe('#ff00ff');
    // The two un-customised fields still flip.
    expect(out.strokeColor).toBe(next.elementStroke);
    expect(out.textColor).toBe(next.elementText);
  });

  it('replaces an undefined field with the next theme value', () => {
    const el: ShapeElement = {
      id: 's',
      type: 'shape',
      shape: 'square',
      x: 0,
      y: 0,
      width: 100,
      height: 50,
    };
    const out = switchThemeElement(el, prev, next) as ShapeElement;
    expect(out.fillColor).toBe(next.elementFill);
    expect(out.strokeColor).toBe(next.elementStroke);
    expect(out.textColor).toBe(next.elementText);
  });

  it('switches text colour on text elements but leaves stickies alone', () => {
    const tEl: TextElement = {
      id: 't',
      type: 'text',
      x: 0,
      y: 0,
      width: 100,
      height: 30,
      label: 'x',
      textColor: prev.elementText ?? undefined,
    };
    expect((switchThemeElement(tEl, prev, next) as TextElement).textColor).toBe(next.elementText);
    const sNote: StickyElement = { id: 'n', type: 'sticky', x: 0, y: 0, width: 200, height: 200 };
    expect(switchThemeElement(sNote, prev, next)).toEqual(sNote);
  });

  it('switches stroke on arrows so themed connectors flip with the diagram', () => {
    const a: ArrowElement = {
      id: 'a',
      type: 'arrow',
      from: { kind: 'free', x: 0, y: 0 },
      to: { kind: 'free', x: 10, y: 10 },
      strokeColor: prev.elementStroke ?? undefined,
    };
    expect((switchThemeElement(a, prev, next) as ArrowElement).strokeColor).toBe(
      next.elementStroke,
    );
  });
});

describe('resetThemeElement', () => {
  const theme: ThemeDefinition = {
    id: 'slate',
    label: 'Slate',
    backgroundColor: '#f1f5f9',
    backgroundPattern: 'grid',
    patternColor: '#cbd5e1',
    elementFill: '#e2e8f0',
    elementStroke: '#475569',
    elementText: '#0f172a',
  };
  const passthrough: ThemeDefinition = {
    id: 'brand',
    label: 'Brand',
    backgroundColor: '#fff',
    backgroundPattern: 'grid',
    patternColor: '#e0f2fe',
    elementFill: null,
    elementStroke: null,
    elementText: null,
  };

  it('overwrites every field on a shape with the theme values, even when the user customised', () => {
    const el: ShapeElement = {
      id: 's',
      type: 'shape',
      shape: 'square',
      x: 0,
      y: 0,
      width: 100,
      height: 50,
      fillColor: '#ff00ff',
      strokeColor: '#003366',
      textColor: '#222222',
    };
    const out = resetThemeElement(el, theme) as ShapeElement;
    expect(out.fillColor).toBe(theme.elementFill);
    expect(out.strokeColor).toBe(theme.elementStroke);
    expect(out.textColor).toBe(theme.elementText);
  });

  it('blanks a field when the theme value is null (Brand passthrough)', () => {
    const el: ShapeElement = {
      id: 's',
      type: 'shape',
      shape: 'square',
      x: 0,
      y: 0,
      width: 100,
      height: 50,
      fillColor: '#ff00ff',
      strokeColor: '#003366',
      textColor: '#222222',
    };
    const out = resetThemeElement(el, passthrough) as ShapeElement;
    expect(out.fillColor).toBeUndefined();
    expect(out.strokeColor).toBeUndefined();
    expect(out.textColor).toBeUndefined();
  });

  it('overwrites text colour on text elements and stroke on arrows', () => {
    const tEl: TextElement = {
      id: 't',
      type: 'text',
      x: 0,
      y: 0,
      width: 100,
      height: 30,
      label: 'x',
      textColor: '#222',
    };
    expect((resetThemeElement(tEl, theme) as TextElement).textColor).toBe(theme.elementText);
    const a: ArrowElement = {
      id: 'a',
      type: 'arrow',
      from: { kind: 'free', x: 0, y: 0 },
      to: { kind: 'free', x: 10, y: 10 },
      strokeColor: '#abc',
    };
    expect((resetThemeElement(a, theme) as ArrowElement).strokeColor).toBe(theme.elementStroke);
  });

  it('leaves sticky notes alone so the iconic amber palette survives a reset', () => {
    const sNote: StickyElement = { id: 'n', type: 'sticky', x: 0, y: 0, width: 200, height: 200 };
    expect(resetThemeElement(sNote, theme)).toEqual(sNote);
  });
});
