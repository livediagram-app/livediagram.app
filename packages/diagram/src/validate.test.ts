import { describe, it, expect } from 'vitest';
import { isValidElement, isValidTab, MAX_ELEMENTS_PER_TAB, MAX_FREEHAND_POINTS } from './validate';

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
