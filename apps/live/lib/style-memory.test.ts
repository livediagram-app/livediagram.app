import {
  THEMES,
  quickSwatchColor,
  shapeColorPresets,
  type ArrowElement,
  type Element,
  type ShapeElement,
  type StickyElement,
} from '@livediagram/document';
import { describe, expect, it } from 'vitest';
import type { ThemeDefinition } from '@livediagram/document';
import {
  applyStyleMemory,
  forgetStyleKinds,
  parseStyleMemory,
  recordStyleEdit,
  styleKindOf,
  styleMemoryKey,
  type StyleMemory,
} from './style-memory';

// docs/specs/008-canvas/quick-style-panel.md "Style memory".

const presetOf = (t: ThemeDefinition, id: string) => shapeColorPresets(t).find((p) => p.id === id)!;
const forest = THEMES.find((t) => t.id === 'forest')!;
const ocean = THEMES.find((t) => t.id === 'ocean')!;

const shape = (id: string, kind: ShapeElement['shape'], extra: Partial<ShapeElement> = {}) =>
  ({ id, type: 'shape', shape: kind, x: 0, y: 0, width: 50, height: 50, ...extra }) as ShapeElement;
const arrow = (id: string, extra: Partial<ArrowElement> = {}): ArrowElement => ({
  id,
  type: 'arrow',
  from: { kind: 'free', x: 0, y: 0 },
  to: { kind: 'free', x: 10, y: 0 },
  ...extra,
});

const edit = (
  memory: StyleMemory,
  before: Element[],
  change: (el: Element) => Element,
  theme = forest,
) => recordStyleEdit(memory, before, before.map(change), theme);

describe('recordStyleEdit', () => {
  it('remembers a changed field under the element’s kind', () => {
    const m = edit({}, [shape('a', 'circle')], (el) => ({ ...el, strokeColor: '#ff0000' }));
    expect(m).toEqual({ 'shape:circle': { strokeColor: '#ff0000' } });
  });

  it('keeps arrows in their own bucket', () => {
    const m = edit({}, [arrow('a')], (el) => ({ ...el, strokeWidth: 4 }) as Element);
    expect(m).toEqual({ arrow: { strokeWidth: 4 } });
  });

  it('remembers each kind of a mixed selection separately', () => {
    const before = [shape('a', 'circle'), shape('b', 'square'), arrow('c')];
    const m = edit({}, before, (el) => ({ ...el, strokeColor: '#00ff00' }));
    expect(Object.keys(m).sort()).toEqual(['arrow', 'shape:circle', 'shape:square']);
  });

  it('remembers field by field, keeping what was chosen before', () => {
    const first = edit(
      {},
      [shape('a', 'circle')],
      (el) => ({ ...el, strokeWidth: 'thick' }) as Element,
    );
    const second = edit(first, [shape('b', 'circle')], (el) => ({ ...el, fillColor: '#eeeeee' }));
    expect(second['shape:circle']).toEqual({ strokeWidth: 'thick', fillColor: '#eeeeee' });
  });

  it('forgets a field set back to the theme default, or cleared', () => {
    const m = { 'shape:circle': { fillColor: '#eeeeee', strokeWidth: 'thick' } };
    const next = edit(
      m,
      [shape('a', 'circle', { fillColor: '#eeeeee', strokeWidth: 'thick' })],
      (el) => ({
        ...el,
        fillColor: forest.elementFill!,
        strokeWidth: undefined,
      }),
    );
    expect(next).toEqual({});
  });

  it('ignores fields it does not remember, and returns the same object', () => {
    const m: StyleMemory = {};
    expect(edit(m, [shape('a', 'circle')], (el) => ({ ...el, rotation: 45 }))).toBe(m);
  });

  it('ignores elements that are not shapes or arrows', () => {
    const note: StickyElement = { id: 'n', type: 'sticky', x: 0, y: 0, width: 5, height: 5 };
    expect(edit({}, [note], (el) => ({ ...el, fillColor: '#ff0000' }))).toEqual({});
  });
});

describe('applyStyleMemory', () => {
  const memory: StyleMemory = {
    'shape:circle': { strokeColor: '#ff0000', strokeWidth: 'thick', textAlignX: 'left' },
    arrow: { strokeStyle: 'dashed', flow: 'dashes' },
  };

  it('dresses the next element of a remembered kind', () => {
    expect(applyStyleMemory(shape('n', 'circle'), memory, forest)).toMatchObject({
      strokeColor: '#ff0000',
      strokeWidth: 'thick',
      textAlignX: 'left',
    });
    expect(applyStyleMemory(arrow('n'), memory, forest)).toMatchObject({
      strokeStyle: 'dashed',
      flow: 'dashes',
    });
  });

  it('leaves another kind alone, by reference', () => {
    const square = shape('n', 'square');
    expect(applyStyleMemory(square, memory, forest)).toBe(square);
  });

  it('re-derives a remembered swatch for the tab’s theme', () => {
    const m: StyleMemory = {
      'shape:circle': { fillSwatch: 4, fillColor: quickSwatchColor(forest, 'fill', 4) },
    };
    expect(applyStyleMemory(shape('n', 'circle'), m, ocean)).toMatchObject({
      fillSwatch: 4,
      fillColor: quickSwatchColor(ocean, 'fill', 4),
    });
  });

  it('re-derives a remembered preset for the tab’s theme', () => {
    const bold = presetOf(forest, 'bold');
    const m: StyleMemory = {
      'shape:circle': { colorPreset: 'bold', fillColor: bold.fill, textColor: bold.text },
    };
    expect(applyStyleMemory(shape('n', 'circle'), m, ocean)).toMatchObject({
      colorPreset: 'bold',
      fillColor: presetOf(ocean, 'bold').fill,
    });
  });
});

describe('forgetStyleKinds', () => {
  it('drops the named kinds only', () => {
    const m: StyleMemory = { arrow: { flow: 'dashes' }, 'shape:circle': { strokeWidth: 'thin' } };
    expect(forgetStyleKinds(m, ['arrow'])).toEqual({ 'shape:circle': { strokeWidth: 'thin' } });
  });
});

describe('parseStyleMemory', () => {
  it('keeps known kinds and fields of the right type, and drops the rest', () => {
    const raw = JSON.stringify({
      'shape:circle': { strokeColor: '#ff0000', rotation: 90, strokeWidth: 3 },
      'shape:nonsense': { strokeColor: '#ff0000' },
      arrow: { strokeWidth: 4, flow: 7 },
      junk: 1,
    });
    expect(parseStyleMemory(raw)).toEqual({
      'shape:circle': { strokeColor: '#ff0000' },
      arrow: { strokeWidth: 4 },
    });
  });

  it('reads garbage as empty', () => {
    expect(parseStyleMemory(null)).toEqual({});
    expect(parseStyleMemory('{nope')).toEqual({});
    expect(parseStyleMemory('[1,2]')).toEqual({});
  });
});

describe('keys', () => {
  it('names a kind and a storage key', () => {
    expect(styleKindOf(shape('a', 'diamond'))).toBe('shape:diamond');
    expect(styleKindOf(arrow('a'))).toBe('arrow');
    expect(styleMemoryKey('d1')).toBe('livediagram:v2:style-memory:d1');
  });
});

describe('text elements', () => {
  const text = (id: string, extra: Record<string, unknown> = {}) =>
    ({ id, type: 'text', x: 0, y: 0, width: 220, height: 64, ...extra }) as Element;

  it('remember their text colour in one bucket, and dress the next one', () => {
    const colour = quickSwatchColor(forest, 'text', 4);
    const memory = edit({}, [text('a')], (el) => ({ ...el, textColor: colour, textSwatch: 4 }));
    expect(memory).toEqual({ text: { textColor: colour, textSwatch: 4 } });
    expect(styleKindOf(text('b'))).toBe('text');
    expect(applyStyleMemory(text('b'), memory, ocean)).toMatchObject({
      textColor: quickSwatchColor(ocean, 'text', 4),
      textSwatch: 4,
    });
  });

  it('survive a parse round trip', () => {
    const memory = { text: { textColor: '#aa0000' } };
    expect(parseStyleMemory(JSON.stringify(memory))).toEqual(memory);
  });
});
