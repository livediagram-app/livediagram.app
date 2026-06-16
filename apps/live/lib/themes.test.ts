import type {
  ArrowElement,
  Element,
  FreehandElement,
  ShapeElement,
  StickyElement,
  TableElement,
  TextElement,
} from '@livediagram/diagram';
import { describe, expect, it } from 'vitest';
import { createPinnedArrow, createShape } from '@livediagram/diagram';
import {
  THEMES,
  THEME_CATEGORIES,
  deriveNewBoxedColours,
  getTheme,
  themeCategory,
  recolourElementForTheme,
  recolourElementsForTheme,
  resetArrowsToTheme,
  resetThemeElement,
  resetThemeElementsToTheme,
  switchThemeBackdrop,
  switchThemeElement,
  switchThemeElements,
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

  // spec/16-marketing-site.md cites the theme count directly in its
  // copy. If the catalogue drifts from this the spec stops being
  // accurate. The extras include the multi-colour themes from spec/29.
  // Mirrors the equivalent assertions in templates.test.ts.
  it('lists exactly 27 themes (matches spec/16)', () => {
    expect(THEMES).toHaveLength(27);
  });

  it('splits cleanly into 12 default + 15 extra (retained as catalogue metadata)', () => {
    const defaults = THEMES.filter((t) => !t.extra);
    const extras = THEMES.filter((t) => t.extra);
    expect(defaults).toHaveLength(12);
    expect(extras).toHaveLength(15);
  });

  it('leads with the brand theme (the un-themed default is the most common pick)', () => {
    const brand = THEMES.find((t) => t.id === 'brand');
    expect(brand?.extra).toBeFalsy();
  });

  it('assigns every theme to a known category (the picker groups themes by category)', () => {
    const known = new Set(THEME_CATEGORIES.map((c) => c.id));
    for (const t of THEMES) {
      expect(known.has(themeCategory(t.id))).toBe(true);
    }
  });
});

describe('UML theme (per-shape colours, spec/41)', () => {
  const uml = getTheme('uml');

  it('sits in the Formal category', () => {
    expect(themeCategory('uml')).toBe('formal');
    expect(THEME_CATEGORIES.some((c) => c.id === 'formal')).toBe(true);
  });

  it('paints a new diamond its decision colour, not the base element colour', () => {
    const diamond = createShape('diamond', 0, 0);
    const colours = deriveNewBoxedColours(diamond, { theme: 'uml' });
    expect(colours.fillColor).toBe(uml.shapeColors!.diamond!.fill);
    expect(colours.strokeColor).toBe(uml.shapeColors!.diamond!.stroke);
    expect(colours.textColor).toBe(uml.shapeColors!.diamond!.text);
  });

  it('paints a cylinder its datastore colour, distinct from the diamond', () => {
    const cyl = deriveNewBoxedColours(createShape('cylinder', 0, 0), { theme: 'uml' });
    expect(cyl.strokeColor).toBe(uml.shapeColors!.cylinder!.stroke);
    expect(cyl.strokeColor).not.toBe(uml.shapeColors!.diamond!.stroke);
  });

  it('falls back to the base element colour for a kind with no override', () => {
    // No `actor` override, so it should take the theme's element stroke.
    const actor = deriveNewBoxedColours(createShape('actor', 0, 0), { theme: 'uml' });
    expect(actor.strokeColor).toBe(uml.elementStroke);
  });

  it('recolours existing shapes per-kind when applied to a scaffold', () => {
    const out = recolourElementsForTheme(
      [createShape('diamond', 0, 0), createShape('cylinder', 0, 0)],
      uml,
    ) as ShapeElement[];
    expect(out[0]!.strokeColor).toBe(uml.shapeColors!.diamond!.stroke);
    expect(out[1]!.strokeColor).toBe(uml.shapeColors!.cylinder!.stroke);
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

  it('keeps the fill on a themeLockFill shape but still themes its stroke + text', () => {
    // The Gantt milestone bars rely on this: a single themed element-fill
    // would merge all six distinct bars into one block, so the bar fill is
    // pinned while stroke + text still follow the theme.
    const locked: ShapeElement = { ...shape, fillColor: '#bdc8d6', themeLockFill: true };
    const out = recolourElementForTheme(locked, themed) as ShapeElement;
    expect(out.fillColor).toBe('#bdc8d6');
    expect(out.strokeColor).toBe('#475569');
    expect(out.textColor).toBe('#0f172a');
  });
});

describe('switchThemeBackdrop', () => {
  const prev: ThemeDefinition = {
    id: 'brand',
    label: 'Brand',
    backgroundColor: '#ffffff',
    backgroundPattern: 'grid',
    patternColor: '#cbd5e1',
    elementFill: null,
    elementStroke: null,
    elementText: null,
  };
  const next: ThemeDefinition = {
    id: 'mono',
    label: 'Mono',
    backgroundColor: '#0f172a',
    backgroundPattern: 'blank',
    patternColor: '#334155',
    elementFill: null,
    elementStroke: null,
    elementText: null,
  };

  it('adopts the new theme backdrop when fields are unset', () => {
    expect(switchThemeBackdrop({}, prev, next)).toEqual({
      backgroundColor: next.backgroundColor,
      backgroundPattern: next.backgroundPattern,
      patternColor: next.patternColor,
      // Unset theme opacity resolves to fully opaque.
      backgroundOpacity: 1,
    });
  });

  it('adopts the new theme pattern opacity, and preserves a custom one', () => {
    const fadedNext: ThemeDefinition = { ...next, backgroundOpacity: 0.4 };
    // Unset on the tab → adopt the new theme's opacity.
    expect(switchThemeBackdrop({}, prev, fadedNext).backgroundOpacity).toBe(0.4);
    // A custom tab opacity (differs from prev's implicit 1) survives.
    expect(switchThemeBackdrop({ backgroundOpacity: 0.7 }, prev, fadedNext).backgroundOpacity).toBe(
      0.7,
    );
  });

  it('adopts the new theme backdrop when fields still match the previous theme', () => {
    const out = switchThemeBackdrop(
      {
        backgroundColor: prev.backgroundColor,
        backgroundPattern: prev.backgroundPattern,
        patternColor: prev.patternColor,
      },
      prev,
      next,
    );
    expect(out.backgroundPattern).toBe('blank');
    expect(out.backgroundColor).toBe(next.backgroundColor);
  });

  it('preserves a custom pattern across a theme change (the bug fix)', () => {
    // User chose Graph, then switches theme: the pattern must survive,
    // not get clobbered back to the new theme's backdrop.
    const out = switchThemeBackdrop({ backgroundPattern: 'graph' }, prev, next);
    expect(out.backgroundPattern).toBe('graph');
  });

  it('preserves a custom background + pattern colour while still unset fields adopt the theme', () => {
    const out = switchThemeBackdrop({ patternColor: '#ff0000' }, prev, next);
    expect(out.patternColor).toBe('#ff0000');
    // backgroundColor/pattern were unset → adopt the new theme.
    expect(out.backgroundColor).toBe(next.backgroundColor);
    expect(out.backgroundPattern).toBe(next.backgroundPattern);
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

  it('keeps a themeLockFill bar fill across a theme switch but flips its stroke', () => {
    const bar: ShapeElement = {
      id: 's',
      type: 'shape',
      shape: 'square',
      x: 0,
      y: 0,
      width: 100,
      height: 50,
      fillColor: '#bdc8d6',
      strokeColor: prev.elementStroke ?? undefined,
      themeLockFill: true,
    };
    const out = switchThemeElement(bar, prev, next) as ShapeElement;
    expect(out.fillColor).toBe('#bdc8d6');
    expect(out.strokeColor).toBe(next.elementStroke);
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

  // Tables track the canvas BACKDROP: cells = the canvas colour, text
  // contrasts with it (deriveNewBoxedColours). Switching to a dark theme
  // must re-derive both; the generic rule would compare the backdrop-
  // derived text against the light theme's `elementText` (null), mistake
  // it for a user override, and strand dark text on the dark theme.
  const table = (over: Partial<TableElement> = {}): TableElement => ({
    id: 't',
    type: 'table',
    x: 0,
    y: 0,
    width: 360,
    height: 150,
    cells: [
      ['', ''],
      ['', ''],
    ],
    ...over,
  });

  it('re-derives a backdrop-driven table to a dark theme (dark cells, light text)', () => {
    const brand = getTheme('brand'); // white bg, elementText null
    const midnight = getTheme('midnight'); // dark bg, light elementText
    // As deriveNewBoxedColours leaves it on brand: fill = bg, text = contrast.
    const el = table({ fillColor: brand.backgroundColor, textColor: '#1e293b' });
    const out = switchThemeElement(el, brand, midnight) as TableElement;
    expect(out.fillColor).toBe(midnight.backgroundColor); // cells follow the dark canvas
    expect(out.textColor).toBe(midnight.elementText); // light, readable
  });

  it('preserves a user-customised table fill + text across the switch', () => {
    const brand = getTheme('brand');
    const midnight = getTheme('midnight');
    const el = table({ fillColor: '#ff0000', textColor: '#ffff00' });
    const out = switchThemeElement(el, brand, midnight) as TableElement;
    expect(out.fillColor).toBe('#ff0000');
    expect(out.textColor).toBe('#ffff00');
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

  it('keeps a themeLockFill fill even on a hard reset, but still resets stroke + text', () => {
    // "Reset elements to theme" is the most aggressive transform (it
    // overwrites user customisations), yet a pinned fill must still
    // survive or the Gantt bars would merge under a reset.
    const bar: ShapeElement = {
      id: 's',
      type: 'shape',
      shape: 'square',
      x: 0,
      y: 0,
      width: 100,
      height: 50,
      fillColor: '#bdc8d6',
      strokeColor: '#003366',
      textColor: '#222222',
      themeLockFill: true,
    };
    const out = resetThemeElement(bar, theme) as ShapeElement;
    expect(out.fillColor).toBe('#bdc8d6');
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

describe('resetArrowsToTheme (spec/42: arrows always track the theme)', () => {
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

  it('overwrites a hand-coloured arrow stroke with the theme stroke', () => {
    const arrow: ArrowElement = {
      id: 'a',
      type: 'arrow',
      from: { kind: 'free', x: 0, y: 0 },
      to: { kind: 'free', x: 10, y: 10 },
      strokeColor: '#ff00ff', // user override
    };
    const [out] = resetArrowsToTheme([arrow], theme) as ArrowElement[];
    expect(out!.strokeColor).toBe(theme.elementStroke);
  });

  it('leaves non-arrow elements untouched, including their custom colours', () => {
    const shape: ShapeElement = {
      id: 's',
      type: 'shape',
      shape: 'square',
      x: 0,
      y: 0,
      width: 100,
      height: 50,
      fillColor: '#ff00ff',
      strokeColor: '#00ff00',
      textColor: '#0000ff',
    };
    const [out] = resetArrowsToTheme([shape], theme) as ShapeElement[];
    expect(out).toBe(shape); // referentially unchanged
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

  it('gives a new element the trunk (rootColor) under a multi-colour theme', () => {
    // A brand-new element isn't in the arrow graph yet, so it should
    // pick up the palette theme's neutral trunk (mirrored into the
    // single-colour element fields). See spec/29.
    const rainbow = THEMES.find((t) => t.id === 'rainbow')!;
    const out = deriveNewBoxedColours(shape, { theme: 'rainbow' });
    expect(out.fillColor).toBe(rainbow.rootColor!.fill);
    expect(out.strokeColor).toBe(rainbow.rootColor!.stroke);
    expect(out.textColor).toBe(rainbow.rootColor!.text);
  });
});

describe('multi-colour (rainbow) themes', () => {
  it('ships five palette themes (all in the Multi-colour category, all extra)', () => {
    const palettes = THEMES.filter((t) => themeCategory(t.id) === 'multicolour');
    expect(palettes).toHaveLength(5);
    for (const t of palettes) {
      expect(t.extra).toBe(true);
      expect(t.palette && t.palette.length).toBeGreaterThan(0);
      expect(t.rootColor).toBeTruthy();
    }
  });

  it('mirrors rootColor into the single-colour element fields (non-hierarchy fallback)', () => {
    // Code paths that read elementFill/Stroke/Text directly (e.g.
    // deriveNewBoxedColours) must still get a sensible neutral.
    const rainbow = THEMES.find((t) => t.id === 'rainbow')!;
    expect(rainbow.elementFill).toBe(rainbow.rootColor!.fill);
    expect(rainbow.elementStroke).toBe(rainbow.rootColor!.stroke);
    expect(rainbow.elementText).toBe(rainbow.rootColor!.text);
  });

  it('gives each multi-colour theme a backdrop that visibly differs from the default white canvas', () => {
    // Regression guard: the first cut shipped white/near-white grid
    // backdrops, so picking a multi-colour theme left the canvas looking
    // unchanged (and did nothing visible on an empty diagram). Each must
    // shift the canvas colour and/or pattern away from the brand default.
    const brand = THEMES.find((t) => t.id === 'brand')!;
    for (const t of THEMES.filter((x) => themeCategory(x.id) === 'multicolour')) {
      const changed =
        t.backgroundColor !== brand.backgroundColor ||
        t.backgroundPattern !== brand.backgroundPattern;
      expect(changed).toBe(true);
    }
  });

  // A minimal mind map: centre → two topics. Centre is the trunk; the
  // two topics are distinct branches.
  function miniMap() {
    const center = { ...createShape('circle', 0, 0), id: 'center' };
    const t1 = { ...createShape('square', 300, 0), id: 't1' };
    const t2 = { ...createShape('square', -300, 0), id: 't2' };
    return [
      center,
      t1,
      t2,
      createPinnedArrow('center', 'e', 't1', 'w'),
      createPinnedArrow('center', 'w', 't2', 'e'),
    ];
  }

  it('recolourElementsForTheme paints each branch a distinct palette hue', () => {
    const rainbow = THEMES.find((t) => t.id === 'rainbow')!;
    const out = recolourElementsForTheme(miniMap(), rainbow);
    const byId = Object.fromEntries(out.map((el) => [el.id, el]));
    // Trunk gets the rootColor stroke.
    expect((byId.center as { strokeColor?: string }).strokeColor).toBe(rainbow.rootColor!.stroke);
    // The two topics get the first two palette entries, and they differ.
    expect((byId.t1 as { strokeColor?: string }).strokeColor).toBe(rainbow.palette![0]!.stroke);
    expect((byId.t2 as { strokeColor?: string }).strokeColor).toBe(rainbow.palette![1]!.stroke);
  });

  it('colours a connector arrow by the branch it feeds into', () => {
    const rainbow = THEMES.find((t) => t.id === 'rainbow')!;
    const out = recolourElementsForTheme(miniMap(), rainbow);
    const arrowToT1 = out.find(
      (el) => el.type === 'arrow' && el.to.kind === 'pinned' && el.to.elementId === 't1',
    ) as { strokeColor?: string };
    expect(arrowToT1.strokeColor).toBe(rainbow.palette![0]!.stroke);
  });

  it('still recolours single-colour themes through the graph-aware path', () => {
    const slate = THEMES.find((t) => t.id === 'slate')!;
    const out = recolourElementsForTheme(miniMap(), slate);
    for (const el of out) {
      if (el.type === 'shape') {
        expect((el as { strokeColor?: string }).strokeColor).toBe(slate.elementStroke);
      }
    }
  });

  it('switchThemeElements rainbows the branches when switching to a palette theme', () => {
    const brand = THEMES.find((t) => t.id === 'brand')!;
    const rainbow = THEMES.find((t) => t.id === 'rainbow')!;
    const out = switchThemeElements(miniMap(), brand, rainbow);
    const byId = Object.fromEntries(out.map((el) => [el.id, el]));
    expect((byId.t1 as { strokeColor?: string }).strokeColor).toBe(rainbow.palette![0]!.stroke);
    expect((byId.t2 as { strokeColor?: string }).strokeColor).toBe(rainbow.palette![1]!.stroke);
  });

  it('resetThemeElementsToTheme force-repaints every branch from the palette', () => {
    const rainbow = THEMES.find((t) => t.id === 'rainbow')!;
    // Hand-colour a topic, then reset: the override is overwritten.
    const els = miniMap().map((el) => (el.id === 't1' ? { ...el, strokeColor: '#123456' } : el));
    const out = resetThemeElementsToTheme(els, rainbow);
    const byId = Object.fromEntries(out.map((el) => [el.id, el]));
    expect((byId.t1 as { strokeColor?: string }).strokeColor).toBe(rainbow.palette![0]!.stroke);
  });
});
