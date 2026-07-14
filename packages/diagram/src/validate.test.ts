import { describe, it, expect } from 'vitest';
import {
  coerceShapeKind,
  isValidElement,
  isValidTab,
  MAX_ELEMENTS_PER_TAB,
  MAX_FREEHAND_POINTS,
} from './validate';

const box = { x: 0, y: 0, width: 100, height: 60 };

describe('isValidElement', () => {
  it('accepts a well-formed shape', () => {
    expect(isValidElement({ id: 'a', type: 'shape', shape: 'square', ...box })).toBe(true);
  });

  it('accepts a pinned arrow', () => {
    expect(
      isValidElement({
        id: 'a',
        type: 'arrow',
        from: { kind: 'pinned', elementId: 'b', anchor: 'e' },
        to: { kind: 'free', x: 10, y: 20 },
      }),
    ).toBe(true);
  });

  it('accepts table / image / freehand / text', () => {
    expect(isValidElement({ id: 't', type: 'table', cells: [['a', 'b']], ...box })).toBe(true);
    expect(isValidElement({ id: 'i', type: 'image', imageId: null, ...box })).toBe(true);
    expect(
      isValidElement({
        id: 'f',
        type: 'freehand',
        closed: false,
        points: [{ nx: 0, ny: 0 }],
        ...box,
      }),
    ).toBe(true);
    expect(isValidElement({ id: 'x', type: 'text', ...box })).toBe(true);
  });

  it('bounds the code block + checklist fields (spec/82, spec/83)', () => {
    const shape = (o: object) => ({ id: 's', type: 'shape', shape: 'code-block', ...box, ...o });
    expect(isValidElement(shape({ code: 'const x = 1;', codeLanguage: 'ts' }))).toBe(true);
    expect(isValidElement(shape({ code: 'x'.repeat(4001) }))).toBe(false);
    expect(isValidElement(shape({ codeLanguage: 'brainfuck' }))).toBe(false);
    const list = (items: unknown) =>
      isValidElement({ id: 'c', type: 'shape', shape: 'checklist', ...box, checklistItems: items });
    expect(list([{ text: 'Task', done: false }])).toBe(true);
    expect(list([{ text: 'Task', done: 'yes' }])).toBe(false);
    expect(list([{ text: 42, done: true }])).toBe(false);
    expect(list(Array.from({ length: 31 }, () => ({ text: 't', done: false })))).toBe(false);
  });

  it('accepts the freehand pen + straightEdges flags, rejects junk values', () => {
    const freehand = { id: 'f', type: 'freehand', closed: false, points: [], ...box };
    // Highlighter recipe (spec/81) + polygon straight edges (spec/84).
    expect(isValidElement({ ...freehand, pen: 'highlighter' })).toBe(true);
    expect(isValidElement({ ...freehand, straightEdges: true })).toBe(true);
    expect(isValidElement({ ...freehand, pen: 'marker' })).toBe(false);
    expect(isValidElement({ ...freehand, straightEdges: 'yes' })).toBe(false);
    expect(isValidElement({ ...freehand, pen: 'highlighter', penWidth: 22 })).toBe(true);
    expect(isValidElement({ ...freehand, penWidth: 0 })).toBe(false);
    expect(isValidElement({ ...freehand, penWidth: 101 })).toBe(false);
  });

  it('rejects a non-object / missing id / unknown type', () => {
    expect(isValidElement(null)).toBe(false);
    expect(isValidElement({ type: 'shape', shape: 'square', ...box })).toBe(false);
    expect(isValidElement({ id: 'a', type: 'wormhole', ...box })).toBe(false);
  });

  it('rejects a boxed element with a non-numeric / missing box', () => {
    expect(isValidElement({ id: 'a', type: 'shape', shape: 'square', x: 0, y: 0 })).toBe(false);
    expect(
      isValidElement({
        id: 'a',
        type: 'shape',
        shape: 'square',
        x: '0',
        y: 0,
        width: 1,
        height: 1,
      }),
    ).toBe(false);
    expect(
      isValidElement({
        id: 'a',
        type: 'shape',
        shape: 'square',
        x: NaN,
        y: 0,
        width: 1,
        height: 1,
      }),
    ).toBe(false);
  });

  it('rejects a shape with no kind and an arrow with a bad endpoint', () => {
    expect(isValidElement({ id: 'a', type: 'shape', ...box })).toBe(false);
    expect(
      isValidElement({
        id: 'a',
        type: 'arrow',
        from: { kind: 'pinned', anchor: 'zz' },
        to: { kind: 'free', x: 0, y: 0 },
      }),
    ).toBe(false);
    expect(isValidElement({ id: 'a', type: 'arrow', from: { kind: 'free', x: 0, y: 0 } })).toBe(
      false,
    );
  });

  it('rejects over-cap arrays (freehand points, table cells)', () => {
    const points = Array.from({ length: MAX_FREEHAND_POINTS + 1 }, () => ({ nx: 0, ny: 0 }));
    expect(isValidElement({ id: 'f', type: 'freehand', closed: false, points, ...box })).toBe(
      false,
    );
  });
});

describe('isValidTab', () => {
  it('accepts a tab of valid elements', () => {
    expect(
      isValidTab({
        id: 't',
        name: 'Tab',
        elements: [{ id: 'a', type: 'shape', shape: 'square', ...box }],
      }),
    ).toBe(true);
  });

  it('accepts an empty tab', () => {
    expect(isValidTab({ id: 't', name: '', elements: [] })).toBe(true);
  });

  it('rejects a missing id/name or non-array elements', () => {
    expect(isValidTab({ name: 'x', elements: [] })).toBe(false);
    expect(isValidTab({ id: 't', elements: [] })).toBe(false);
    expect(isValidTab({ id: 't', name: 'x', elements: {} })).toBe(false);
  });

  it('rejects a tab containing an invalid element', () => {
    expect(isValidTab({ id: 't', name: 'x', elements: [{ id: 'a', type: 'shape', ...box }] })).toBe(
      false,
    );
  });

  it('rejects duplicate element ids', () => {
    const el = { id: 'dup', type: 'shape', shape: 'square', ...box };
    expect(isValidTab({ id: 't', name: 'x', elements: [el, { ...el }] })).toBe(false);
  });

  it('rejects an over-cap element count', () => {
    const els = Array.from({ length: MAX_ELEMENTS_PER_TAB + 1 }, (_, i) => ({
      id: `e${i}`,
      type: 'shape',
      shape: 'square',
      ...box,
    }));
    expect(isValidTab({ id: 't', name: 'x', elements: els })).toBe(false);
  });
});

describe('coerceShapeKind', () => {
  it('keeps a real kind', () => {
    expect(coerceShapeKind('square')).toBe('square');
    expect(coerceShapeKind('diamond')).toBe('diamond');
    expect(coerceShapeKind('cylinder')).toBe('cylinder');
  });
  it('coerces an off-vocabulary or junk kind to square', () => {
    expect(coerceShapeKind('rectangle')).toBe('square'); // the bug: not a real kind
    expect(coerceShapeKind('box')).toBe('square');
    expect(coerceShapeKind('oval')).toBe('square');
    expect(coerceShapeKind(undefined)).toBe('square');
    expect(coerceShapeKind(42)).toBe('square');
  });
});
