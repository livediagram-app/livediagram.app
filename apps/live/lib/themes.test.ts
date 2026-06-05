import type {
  ArrowElement,
  Element,
  FreehandElement,
  ShapeElement,
  StickyElement,
  TextElement,
} from '@livediagram/diagram';
import { describe, expect, it } from 'vitest';
import {
  THEMES,
  deriveNewBoxedColours,
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

  // spec/16-marketing-site.md claims "18 themes (12 default + 6
  // extra)". The marketing site cites the number directly in its
  // copy and the welcome picker gates the extras behind a "Show
  // more" toggle (apps/live/components/TemplatePicker.tsx +
  // hooks/useShowMoreList.ts). If the catalogue drifts from those
  // counts the spec stops being accurate and the picker's two-row
  // visual cadence breaks (the extras row currently fills cleanly
  // with 6 entries). Mirrors the equivalent assertions in
  // templates.test.ts.
  it('lists exactly 18 themes (matches spec/16)', () => {
    expect(THEMES).toHaveLength(18);
  });

  it('splits cleanly into 12 default + 6 extra (the picker uses `extra` to gate behind "Show more")', () => {
    const defaults = THEMES.filter((t) => !t.extra);
    const extras = THEMES.filter((t) => t.extra);
    expect(defaults).toHaveLength(12);
    expect(extras).toHaveLength(6);
  });

  it('keeps the brand theme out of the "extras" bucket (it must be visible without expanding)', () => {
    // The default picker view always shows brand on its first row,
    // since the un-themed default is the most common pick. Hiding
    // it behind "Show more" would be a visible regression.
    const brand = THEMES.find((t) => t.id === 'brand');
    expect(brand?.extra).toBeFalsy();
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
  const freehand: FreehandElement = {
    id: 'f',
    type: 'freehand',
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    points: [
      { nx: 0, ny: 0 },
      { nx: 1, ny: 1 },
    ],
    closed: true,
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

  it('writes fill + stroke on freehand sketches so they follow the theme like shapes', () => {
    // Regression: all three theme transforms used to skip freehand,
    // leaving sketches stuck at their creation-time colours when the
    // user themed the tab. Sketches carry fill + stroke (no text).
    const out = recolourElementForTheme(freehand, themed) as FreehandElement;
    expect(out.fillColor).toBe('#e2e8f0');
    expect(out.strokeColor).toBe('#475569');
    // No text colour: freehand renders no inline label.
    expect((out as unknown as Record<string, unknown>).textColor).toBeUndefined();
  });

  it('no-ops every type when the theme has no element-colour overrides (Brand)', () => {
    const inputs: Element[] = [shape, text, arrow, sticky, freehand];
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

  it('flips uncustomised fill + stroke on freehand sketches but keeps a customised one', () => {
    const f: FreehandElement = {
      id: 'f',
      type: 'freehand',
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      points: [
        { nx: 0, ny: 0 },
        { nx: 1, ny: 1 },
      ],
      closed: true,
      fillColor: '#ff00ff', // customised: must survive
      strokeColor: prev.elementStroke ?? undefined, // on old theme: must flip
    };
    const out = switchThemeElement(f, prev, next) as FreehandElement;
    expect(out.fillColor).toBe('#ff00ff');
    expect(out.strokeColor).toBe(next.elementStroke);
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

  it('overwrites fill + stroke on freehand sketches, blanking them on a null theme', () => {
    const f: FreehandElement = {
      id: 'f',
      type: 'freehand',
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      points: [
        { nx: 0, ny: 0 },
        { nx: 1, ny: 1 },
      ],
      closed: true,
      fillColor: '#ff00ff',
      strokeColor: '#003366',
    };
    const themed = resetThemeElement(f, theme) as FreehandElement;
    expect(themed.fillColor).toBe(theme.elementFill);
    expect(themed.strokeColor).toBe(theme.elementStroke);
    const blanked = resetThemeElement(f, passthrough) as FreehandElement;
    expect(blanked.fillColor).toBeUndefined();
    expect(blanked.strokeColor).toBeUndefined();
  });

  it('leaves sticky notes alone so the iconic amber palette survives a reset', () => {
    const sNote: StickyElement = { id: 'n', type: 'sticky', x: 0, y: 0, width: 200, height: 200 };
    expect(resetThemeElement(sNote, theme)).toEqual(sNote);
  });
});

describe('deriveNewBoxedColours', () => {
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
    label: 'hi',
  };
  const sticky: StickyElement = { id: 'n', type: 'sticky', x: 0, y: 0, width: 200, height: 200 };

  it('returns no colours when the backdrop is at design defaults and the theme is brand', () => {
    // Brand theme has all three element fields null; the design-
    // default backdrop returns null from deriveShapeColours. Net:
    // empty projection means the shape paints with its built-in
    // defaults (brand-50 fill etc).
    const out = deriveNewBoxedColours(shape, { theme: 'brand' });
    expect(out).toEqual({});
  });

  it('writes background-derived fill / stroke / text on shapes for a customised backdrop', () => {
    const out = deriveNewBoxedColours(shape, {
      patternColor: '#0ea5e9',
      backgroundColor: '#f0f9ff',
      theme: 'brand',
    });
    expect(typeof out.fillColor).toBe('string');
    expect(typeof out.strokeColor).toBe('string');
    expect(typeof out.textColor).toBe('string');
  });

  it('theme overrides win over the background-derived guess (a Slate theme stays Slate even on cyan)', () => {
    const out = deriveNewBoxedColours(shape, {
      patternColor: '#0ea5e9',
      backgroundColor: '#f0f9ff',
      theme: 'slate',
    });
    const slate = THEMES.find((t) => t.id === 'slate')!;
    expect(out.fillColor).toBe(slate.elementFill);
    expect(out.strokeColor).toBe(slate.elementStroke);
    expect(out.textColor).toBe(slate.elementText);
  });

  it('text elements get a backdrop-tuned text colour for a dark canvas', () => {
    const out = deriveNewBoxedColours(text, {
      backgroundColor: '#0f172a',
      theme: 'brand',
    });
    // Dark canvas + brand theme: no theme override on text, so the
    // backdrop-derived light-on-dark text colour lands.
    expect(typeof out.textColor).toBe('string');
    // No fill / stroke on text elements.
    expect((out as { fillColor?: unknown }).fillColor).toBeUndefined();
    expect((out as { strokeColor?: unknown }).strokeColor).toBeUndefined();
  });

  it('text elements get NO override when the backdrop is the design default', () => {
    const out = deriveNewBoxedColours(text, { theme: 'brand' });
    expect(out).toEqual({});
  });

  it('text elements still pick up a theme text colour over the default backdrop', () => {
    const out = deriveNewBoxedColours(text, { theme: 'slate' });
    const slate = THEMES.find((t) => t.id === 'slate')!;
    expect(out.textColor).toBe(slate.elementText);
  });

  it('returns NO colours for sticky notes so the iconic amber palette survives', () => {
    expect(deriveNewBoxedColours(sticky, { theme: 'brand' })).toEqual({});
    expect(deriveNewBoxedColours(sticky, { theme: 'slate' })).toEqual({});
    expect(
      deriveNewBoxedColours(sticky, {
        patternColor: '#0ea5e9',
        backgroundColor: '#0f172a',
        theme: 'midnight',
      }),
    ).toEqual({});
  });

  it('treats undefined tab fields as design defaults (no NPE on a fresh tab)', () => {
    expect(deriveNewBoxedColours(shape, {})).toEqual({});
    expect(deriveNewBoxedColours(text, {})).toEqual({});
  });
});
