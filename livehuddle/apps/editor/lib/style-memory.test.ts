import {
  THEMES,
  quickSwatchColor,
  shapeColorPresets,
  type Element,
  type ShapeElement,
  type StickyElement,
} from '@livehuddle/document';
import { describe, expect, it } from 'vitest';
import type { ThemeDefinition } from '@livehuddle/document';
import {
  applyStyleMemory,
  forgetStyleKinds,
  parseStyleMemory,
  recordStyleEdit,
  styleKindOf,
  styleMemoryKey,
  type StyleMemory,
} from './style-memory';
import { storedArrow, storedPath } from '@/test/retired-elements';

// docs/specs/008-canvas/quick-style-panel.md "Style memory".

const presetOf = (t: ThemeDefinition, id: string) => shapeColorPresets(t).find((p) => p.id === id)!;
const forest = THEMES.find((t) => t.id === 'forest')!;
const ocean = THEMES.find((t) => t.id === 'ocean')!;

const shape = (id: string, kind: ShapeElement['shape'], extra: Partial<ShapeElement> = {}) =>
  ({ id, type: 'shape', shape: kind, x: 0, y: 0, width: 50, height: 50, ...extra }) as ShapeElement;
// A stored arrow is retired (docs/specs/002-project-scope/not-in-livehuddle.md "The element engine", part 4).
const arrow = (id: string) => storedArrow(id, { x: 0, y: 0 }, { x: 10, y: 0 });

const edit = (
  memory: StyleMemory,
  before: Element[],
  change: (el: Element) => Element,
  theme = forest,
) => recordStyleEdit(memory, before, before.map(change), theme);

describe('recordStyleEdit', () => {
  it('remembers a changed field under the element’s kind', () => {
    const m = edit({}, [shape('a', 'room')], (el) => ({ ...el, strokeColor: '#ff0000' }));
    expect(m).toEqual({ 'shape:room': { strokeColor: '#ff0000' } });
  });

  it('remembers nothing for a stored arrow or path', () => {
    const path = storedPath('p', { x: 0, y: 0, width: 40, height: 40 });
    const m = edit({}, [arrow('a'), path], (el) => ({ ...el, strokeColor: '#ff0000' }) as Element);
    expect(m).toEqual({});
    expect(styleKindOf(arrow('a'))).toBeNull();
    expect(styleKindOf(path)).toBeNull();
  });

  it('remembers each kind of a mixed selection separately', () => {
    const before = [shape('a', 'room'), shape('b', 'rug'), arrow('c')];
    const m = edit({}, before, (el) => ({ ...el, strokeColor: '#00ff00' }));
    expect(Object.keys(m).sort()).toEqual(['shape:room', 'shape:rug']);
  });

  it('remembers field by field, keeping what was chosen before', () => {
    const first = edit(
      {},
      [shape('a', 'room')],
      (el) => ({ ...el, strokeWidth: 'thick' }) as Element,
    );
    const second = edit(first, [shape('b', 'room')], (el) => ({ ...el, fillColor: '#eeeeee' }));
    expect(second['shape:room']).toEqual({ strokeWidth: 'thick', fillColor: '#eeeeee' });
  });

  it('forgets a field set back to the theme default, or cleared', () => {
    const m = { 'shape:room': { fillColor: '#eeeeee', strokeWidth: 'thick' } };
    const next = edit(
      m,
      [shape('a', 'room', { fillColor: '#eeeeee', strokeWidth: 'thick' })],
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
    expect(edit(m, [shape('a', 'room')], (el) => ({ ...el, rotation: 45 }))).toBe(m);
  });

  it('ignores elements that are not shapes or text', () => {
    const note: StickyElement = { id: 'n', type: 'sticky', x: 0, y: 0, width: 5, height: 5 };
    expect(edit({}, [note], (el) => ({ ...el, fillColor: '#ff0000' }))).toEqual({});
  });
});

describe('applyStyleMemory', () => {
  const memory: StyleMemory = {
    'shape:room': { strokeColor: '#ff0000', strokeWidth: 'thick', textAlignX: 'left' },
  };

  it('dresses the next element of a remembered kind', () => {
    expect(applyStyleMemory(shape('n', 'room'), memory, forest)).toMatchObject({
      strokeColor: '#ff0000',
      strokeWidth: 'thick',
      textAlignX: 'left',
    });
  });

  it('leaves another kind, and a stored arrow, alone by reference', () => {
    const square = shape('n', 'rug');
    expect(applyStyleMemory(square, memory, forest)).toBe(square);
    const stored = arrow('n');
    expect(applyStyleMemory(stored, memory, forest)).toBe(stored);
  });

  it('re-derives a remembered swatch for the tab’s theme', () => {
    const m: StyleMemory = {
      'shape:room': { fillSwatch: 4, fillColor: quickSwatchColor(forest, 'fill', 4) },
    };
    expect(applyStyleMemory(shape('n', 'room'), m, ocean)).toMatchObject({
      fillSwatch: 4,
      fillColor: quickSwatchColor(ocean, 'fill', 4),
    });
  });

  it('re-derives a remembered preset for the tab’s theme', () => {
    const bold = presetOf(forest, 'bold');
    const m: StyleMemory = {
      'shape:room': { colorPreset: 'bold', fillColor: bold.fill, textColor: bold.text },
    };
    expect(applyStyleMemory(shape('n', 'room'), m, ocean)).toMatchObject({
      colorPreset: 'bold',
      fillColor: presetOf(ocean, 'bold').fill,
    });
  });
});

describe('forgetStyleKinds', () => {
  it('drops the named kinds only', () => {
    const m: StyleMemory = {
      text: { textColor: '#aa0000' },
      'shape:room': { strokeWidth: 'thin' },
    };
    expect(forgetStyleKinds(m, ['text'])).toEqual({ 'shape:room': { strokeWidth: 'thin' } });
  });
});

describe('parseStyleMemory', () => {
  it('keeps known kinds and fields of the right type, and drops the rest', () => {
    const raw = JSON.stringify({
      'shape:room': { strokeColor: '#ff0000', rotation: 90, strokeWidth: 3 },
      'shape:nonsense': { strokeColor: '#ff0000' },
      arrow: { strokeWidth: 4, flow: 7 },
      path: { strokeColor: '#ff0000' },
      junk: 1,
    });
    expect(parseStyleMemory(raw)).toEqual({
      'shape:room': { strokeColor: '#ff0000' },
    });
  });

  it('keeps a stock colour by name, never an unknown name', () => {
    const raw = JSON.stringify({
      'shape:rug': { penColour: 'blue' },
      arrow: { penColour: 'nope' },
      text: { penTextColour: 'green' },
    });
    expect(parseStyleMemory(raw)).toEqual({
      'shape:rug': { penColour: 'blue' },
      text: { penTextColour: 'green' },
    });
  });

  // Work Tracker #329: livediagram's whiteboard memory and its corners are not read back.
  it('drops a stored whiteboard memory and a remembered corner', () => {
    const raw = JSON.stringify({
      'board:shape:square': { strokeColor: '#ff0000' },
      'shape:rug': { borderRadius: 'lg', strokeColor: '#00ff00' },
    });
    expect(parseStyleMemory(raw)).toEqual({ 'shape:rug': { strokeColor: '#00ff00' } });
  });

  it('reads garbage as empty', () => {
    expect(parseStyleMemory(null)).toEqual({});
    expect(parseStyleMemory('{nope')).toEqual({});
    expect(parseStyleMemory('[1,2]')).toEqual({});
  });
});

describe('keys', () => {
  it('names a kind and a storage key', () => {
    expect(styleKindOf(shape('a', 'desk'))).toBe('shape:desk');
    expect(styleMemoryKey('d1')).toBe('livehuddle:v2:style-memory:d1');
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
