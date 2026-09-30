import {
  ARROW_THICKNESS_PX,
  THEMES,
  createPath,
  quickSwatchColor,
  type ArrowElement,
  type Element,
  type ShapeElement,
  type StickyElement,
  type TextElement,
} from '@livediagram/document';
import { describe, expect, it } from 'vitest';
import {
  applyQuickFill,
  applyQuickIconAlign,
  applyQuickStroke,
  applyQuickStrokeStyle,
  applyQuickTextAlign,
  applyQuickTextColour,
  applyQuickWidth,
  clearQuickStyle,
  quickStyleView,
} from './quick-style';

// docs/specs/008-canvas/quick-style-panel.md

const forest = THEMES.find((t) => t.id === 'forest')!;

const shape = (id: string, extra: Partial<ShapeElement> = {}): ShapeElement => ({
  id,
  type: 'shape',
  shape: 'square',
  x: 0,
  y: 0,
  width: 100,
  height: 100,
  ...extra,
});
const arrow = (id: string, extra: Partial<ArrowElement> = {}): ArrowElement => ({
  id,
  type: 'arrow',
  from: { kind: 'free', x: 0, y: 0 },
  to: { kind: 'free', x: 50, y: 0 },
  ...extra,
});
const sticky: StickyElement = { id: 'n', type: 'sticky', x: 0, y: 0, width: 50, height: 50 };

const sections = (els: Element[]) => Object.keys(quickStyleView(els, forest)?.sections ?? {});

describe('quickStyleView: which sections show', () => {
  it('shows nothing without a shape or an arrow', () => {
    expect(quickStyleView([], forest)).toBeNull();
    expect(quickStyleView([sticky], forest)).toBeNull();
  });

  it('gives a plain shape every section but icon alignment', () => {
    expect(sections([shape('a')])).toEqual(['stroke', 'background', 'width', 'style', 'textAlign']);
  });

  it('offers no text alignment on a kind with its own face, but keeps it on a web component', () => {
    for (const kind of ['qa-board', 'agenda', 'session-button', 'comment-pin'] as const) {
      expect(sections([shape('a', { shape: kind })]), kind).not.toContain('textAlign');
    }
    expect(sections([shape('a', { shape: 'banner' })])).toContain('textAlign');
  });

  it('adds icon alignment only when a shape carries an inline icon', () => {
    expect(sections([shape('a', { iconId: 'server' })])).toContain('iconAlign');
  });

  it('gives an arrow stroke, width and style', () => {
    expect(sections([arrow('a')])).toEqual(['stroke', 'width', 'style']);
  });

  it('shows a section when ANY selected element supports it', () => {
    expect(sections([arrow('a'), shape('b')])).toEqual([
      'stroke',
      'background',
      'width',
      'style',
      'textAlign',
    ]);
  });

  it('leaves locked elements alone, and shows nothing when all are locked', () => {
    expect(quickStyleView([shape('a', { locked: true })], forest)).toBeNull();
    expect(quickStyleView([shape('a', { locked: true }), arrow('b')], forest)?.targetIds).toEqual([
      'b',
    ]);
  });

  it('ignores non-shape elements in a mixed selection', () => {
    expect(quickStyleView([sticky, arrow('a')], forest)?.targetIds).toEqual(['a']);
  });
});

describe('quickStyleView: the highlighted value', () => {
  it('is the shared value when every supporting element agrees', () => {
    const view = quickStyleView(
      [shape('a', { strokeWidth: 'thick' }), arrow('b', { strokeWidth: ARROW_THICKNESS_PX.thick })],
      forest,
    )!;
    expect(view.sections.width?.value).toBe('thick');
  });

  it('is nothing when they disagree', () => {
    const view = quickStyleView([shape('a', { strokeWidth: 'thin' }), shape('b')], forest)!;
    expect(view.sections.width?.value).toBeNull();
  });

  it('reads defaults as their option: medium, solid, centre, before', () => {
    const view = quickStyleView([shape('a', { iconId: 'x' })], forest)!;
    expect(view.sections.width?.value).toBe('medium');
    expect(view.sections.style?.value).toBe('solid');
    expect(view.sections.textAlign?.value).toBe('center');
    expect(view.sections.iconAlign?.value).toBe('left');
  });

  it('reads a colour by its binding, by its value, or as the theme default', () => {
    const green = quickSwatchColor(forest, 'stroke', 4);
    expect(
      quickStyleView([shape('a', { strokeColor: green, strokeSwatch: 4 })], forest)!.sections.stroke
        ?.value,
    ).toBe(4);
    expect(
      quickStyleView([shape('a', { strokeColor: green })], forest)!.sections.stroke?.value,
    ).toBe(4);
    expect(quickStyleView([shape('a')], forest)!.sections.stroke?.value).toBe(0);
    expect(
      quickStyleView([shape('a', { strokeColor: forest.elementStroke! })], forest)!.sections.stroke
        ?.value,
    ).toBe(0);
    expect(
      quickStyleView([shape('a', { strokeColor: '#123456' })], forest)!.sections.stroke?.value,
    ).toBeNull();
  });

  it('reads an arrow’s dashed flow as Flowing, and any other flow as nothing', () => {
    const flowing = arrow('a', { strokeStyle: 'dashed', flow: 'dashes' });
    expect(quickStyleView([flowing], forest)!.sections.style?.value).toBe('flowing');
    expect(
      quickStyleView([arrow('a', { flow: 'comet' })], forest)!.sections.style?.value,
    ).toBeNull();
  });
});

describe('quickStyleView: stroke style options', () => {
  it('offers Flowing when every styled element is an arrow', () => {
    expect(quickStyleView([arrow('a')], forest)!.sections.style?.options).toEqual([
      'solid',
      'dashed',
      'flowing',
    ]);
  });

  it('offers Dotted for shapes and for a mixed selection', () => {
    expect(quickStyleView([shape('a')], forest)!.sections.style?.options).toEqual([
      'solid',
      'dashed',
      'dotted',
    ]);
    expect(quickStyleView([shape('a'), arrow('b')], forest)!.sections.style?.options).toEqual([
      'solid',
      'dashed',
      'dotted',
    ]);
  });
});

describe('apply transforms', () => {
  it('binds a picked colour to its slot and clears a preset', () => {
    const next = applyQuickFill(shape('a', { colorPreset: 'bold' }), forest, 3) as ShapeElement;
    expect(next).toMatchObject({ fillColor: quickSwatchColor(forest, 'fill', 3), fillSwatch: 3 });
    expect(next.colorPreset).toBeUndefined();
  });

  it('writes the theme value for the default and drops the binding', () => {
    const next = applyQuickStroke(shape('a', { strokeSwatch: 2 }), forest, 0) as ShapeElement;
    expect(next.strokeColor).toBe(forest.elementStroke);
    expect(next.strokeSwatch).toBeUndefined();
  });

  it('colours an arrow’s stroke but never gives it a background', () => {
    const a = arrow('a');
    expect(applyQuickStroke(a, forest, 1)).toMatchObject({ strokeSwatch: 1 });
    expect(applyQuickFill(a, forest, 1)).toBe(a);
  });

  it('maps width onto each kind’s own scale', () => {
    expect(applyQuickWidth(shape('a'), 'thick')).toMatchObject({ strokeWidth: 'thick' });
    expect(applyQuickWidth(arrow('a'), 'thin')).toMatchObject({
      strokeWidth: ARROW_THICKNESS_PX.thin,
    });
  });

  it('makes a flowing arrow in one choice, and a plain one in another', () => {
    const flowing = applyQuickStrokeStyle(arrow('a'), 'flowing') as ArrowElement;
    expect(flowing).toMatchObject({ strokeStyle: 'dashed', flow: 'dashes' });
    expect(flowing.flowSpeed).toBeDefined();
    const plain = applyQuickStrokeStyle(flowing, 'solid') as ArrowElement;
    expect(plain.strokeStyle).toBe('solid');
    expect(plain.flow).toBeUndefined();
  });

  it('applies alignment to shapes only', () => {
    expect(applyQuickTextAlign(shape('a'), 'left')).toMatchObject({ textAlignX: 'left' });
    const a = arrow('a');
    expect(applyQuickTextAlign(a, 'left')).toBe(a);
    expect(applyQuickIconAlign(shape('a', { iconId: 'x' }), 'above')).toMatchObject({
      iconPosition: 'above',
    });
    const bare = shape('b');
    expect(applyQuickIconAlign(bare, 'above')).toBe(bare);
  });
});

describe('clearQuickStyle', () => {
  it('returns a shape’s quick-style fields to the theme default', () => {
    const styled = shape('a', {
      strokeColor: '#111111',
      strokeSwatch: 1,
      fillColor: '#222222',
      fillSwatch: 2,
      textColor: '#ffffff',
      colorPreset: 'bold',
      strokeWidth: 'thick',
      strokeStyle: 'dashed',
      textAlignX: 'left',
      iconPosition: 'above',
      borderRadius: 'lg',
    });
    const cleared = clearQuickStyle(styled, forest) as ShapeElement;
    expect(cleared).toMatchObject({
      strokeColor: forest.elementStroke,
      fillColor: forest.elementFill,
      textColor: forest.elementText,
      borderRadius: 'lg',
    });
    for (const f of [
      'strokeSwatch',
      'fillSwatch',
      'colorPreset',
      'strokeWidth',
      'strokeStyle',
      'textAlignX',
      'iconPosition',
    ])
      expect(cleared).not.toHaveProperty(f);
  });

  it('returns an arrow to a plain theme line', () => {
    const styled = arrow('a', {
      strokeColor: '#111111',
      strokeSwatch: 1,
      strokeWidth: 7,
      strokeStyle: 'dashed',
      flow: 'dashes',
      flowSpeed: 'fast',
    });
    const cleared = clearQuickStyle(styled, forest) as ArrowElement;
    expect(cleared.strokeColor).toBe(forest.elementStroke);
    for (const f of ['strokeSwatch', 'strokeWidth', 'strokeStyle', 'flow', 'flowSpeed'])
      expect(cleared).not.toHaveProperty(f);
  });
});

describe('custom swatches (docs/specs/008-canvas/quick-style-panel.md "Custom swatches")', () => {
  const custom = { stroke: { 4: '#ff5500' }, fill: { 2: '#123456' } };

  it('shows the custom colour in the overridden slot of its row', () => {
    const view = quickStyleView([shape('a')], forest, custom)!;
    expect(view.sections.stroke?.swatches[4]).toMatchObject({ color: '#ff5500' });
    expect(view.sections.stroke?.swatches[4]?.override?.themeName).toBe('Green');
    expect(view.sections.background?.swatches[2]).toMatchObject({ color: '#123456' });
  });

  it('applies the custom colour itself and binds no slot, so it never follows the theme', () => {
    const next = applyQuickStroke(
      shape('a', { strokeSwatch: 1 }),
      forest,
      4,
      custom,
    ) as ShapeElement;
    expect(next.strokeColor).toBe('#ff5500');
    expect(next.strokeSwatch).toBeUndefined();
    const filled = applyQuickFill(shape('a'), forest, 2, custom) as ShapeElement;
    expect(filled).toMatchObject({ fillColor: '#123456' });
    expect(filled.fillSwatch).toBeUndefined();
  });

  it('highlights the custom swatch for an element painted with it', () => {
    const view = quickStyleView([shape('a', { strokeColor: '#FF5500' })], forest, custom)!;
    expect(view.sections.stroke?.value).toBe(4);
  });

  it('stops claiming a slot whose theme colour has been replaced', () => {
    const green = quickSwatchColor(forest, 'stroke', 4);
    const view = quickStyleView(
      [shape('a', { strokeColor: green, strokeSwatch: 4 })],
      forest,
      custom,
    )!;
    expect(view.sections.stroke?.value).toBeNull();
  });
});

describe('Text colour: text elements', () => {
  const text = (id: string, extra: Partial<TextElement> = {}): TextElement => ({
    id,
    type: 'text',
    x: 0,
    y: 0,
    width: 220,
    height: 64,
    label: 'Hello',
    ...extra,
  });

  it('gives a text element only the Text colour row', () => {
    expect(sections([text('t')])).toEqual(['textColour']);
  });

  it('adds the row beside a shape without giving the shape one', () => {
    expect(sections([shape('a'), text('t')])).toEqual([
      'stroke',
      'background',
      'textColour',
      'width',
      'style',
      'textAlign',
    ]);
    expect(sections([shape('a')])).not.toContain('textColour');
  });

  it('leaves a locked text element alone', () => {
    expect(quickStyleView([text('t', { locked: true })], forest)).toBeNull();
  });

  it('binds a slot, and reads it back as the row value', () => {
    const next = applyQuickTextColour(text('t'), forest, 4) as TextElement;
    expect(next.textSwatch).toBe(4);
    expect(next.textColor).toBe(quickSwatchColor(forest, 'text', 4));
    expect(quickStyleView([next], forest)?.sections.textColour?.value).toBe(4);
  });

  it('slot 0 writes the theme label colour and unbinds', () => {
    const bound = text('t', { textColor: '#123456', textSwatch: 2 });
    const next = applyQuickTextColour(bound, forest, 0) as TextElement;
    expect(next.textSwatch).toBeUndefined();
    expect(next.textColor).toBe(forest.elementText ?? undefined);
    expect(quickStyleView([text('u')], forest)?.sections.textColour?.value).toBe(0);
  });

  it('an overridden slot writes the custom colour unbound', () => {
    const next = applyQuickTextColour(text('t'), forest, 3, {
      text: { 3: '#aa0000' },
    }) as TextElement;
    expect(next).toMatchObject({ textColor: '#aa0000', textSwatch: undefined });
  });

  it('is a no-op on other elements, and the other rows skip text', () => {
    const s = shape('a');
    expect(applyQuickTextColour(s, forest, 4)).toBe(s);
    const t = text('t');
    expect(applyQuickStroke(t, forest, 4)).toBe(t);
    expect(applyQuickWidth(t, 'thick')).toBe(t);
    expect(applyQuickStrokeStyle(t, 'dashed')).toBe(t);
  });

  it('Clear styles returns the text colour to the theme and drops the binding', () => {
    const next = clearQuickStyle(
      text('t', { textColor: '#aa0000', textSwatch: 1 }),
      forest,
    ) as TextElement;
    expect(next.textSwatch).toBeUndefined();
    expect(next.textColor).toBe(forest.elementText ?? undefined);
  });
});

describe('a path (docs/specs/023-whiteboard/path-tool.md "Style")', () => {
  const open = createPath(
    [
      { x: 0, y: 0, mode: 'corner' },
      { x: 40, y: 0, mode: 'corner' },
      { x: 40, y: 40, mode: 'corner' },
    ],
    false,
  );
  const closed = { ...open, id: 'closed', closed: true };

  it('styles its line, and its fill only when closed', () => {
    expect(sections([open])).toEqual(['stroke', 'width', 'style']);
    expect(sections([closed])).toEqual(['stroke', 'background', 'width', 'style']);
    expect(quickStyleView([open], forest)!.sections.style!.options).toEqual([
      'solid',
      'dashed',
      'dotted',
    ]);
  });

  it('writes stroke, width and style, and a fill on a closed path only', () => {
    expect(applyQuickWidth(open, 'thick')).toMatchObject({ strokeWidth: 'thick' });
    expect(applyQuickStrokeStyle(open, 'dotted')).toMatchObject({ strokeStyle: 'dotted' });
    expect(applyQuickStroke(open, forest, 2)).toMatchObject({
      strokeColor: quickSwatchColor(forest, 'stroke', 2),
      strokeSwatch: 2,
    });
    expect(applyQuickFill(open, forest, 2)).toBe(open);
    expect(applyQuickFill(closed, forest, 2)).toMatchObject({ fillSwatch: 2 });
  });

  it('clears back to plain ink', () => {
    const styled = {
      ...closed,
      strokeColor: '#f00',
      fillColor: '#0f0',
      strokeWidth: 'thick' as const,
    };
    const cleared = clearQuickStyle(styled, { ...forest, elementStroke: null, elementFill: null });
    expect(cleared).not.toHaveProperty('strokeColor');
    expect(cleared).not.toHaveProperty('fillColor');
    expect(cleared).not.toHaveProperty('strokeWidth');
  });

  it('is left alone when locked', () => {
    expect(quickStyleView([{ ...open, locked: true }], forest)).toBeNull();
  });
});
