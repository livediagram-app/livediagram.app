import { describe, expect, it } from 'vitest';
import {
  bringManyToFront,
  bringToFront,
  sendManyToBack,
  sendToBack,
  unionBoxedBounds,
  unionElementBounds,
  type Element,
  type ShapeElement,
} from './index';

const box = (id: string, overrides: Partial<ShapeElement> = {}): ShapeElement => ({
  id,
  type: 'shape',
  shape: 'square',
  x: 0,
  y: 0,
  width: 100,
  height: 100,
  ...overrides,
});

const arrow = (id: string): Element => ({
  id,
  type: 'arrow',
  from: { kind: 'free', x: 0, y: 0 },
  to: { kind: 'free', x: 10, y: 10 },
});

const ids = (els: Element[]) => els.map((e) => e.id);

describe('layer order', () => {
  it('bringToFront moves the element to the end, keeping the rest in order', () => {
    expect(ids(bringToFront([box('a'), box('b'), box('c')], 'a'))).toEqual(['b', 'c', 'a']);
  });

  it('sendToBack moves the element to the start, keeping the rest in order', () => {
    expect(ids(sendToBack([box('a'), box('b'), box('c')], 'c'))).toEqual(['c', 'a', 'b']);
  });

  it('both leave the array unchanged for a missing id', () => {
    const els = [box('a'), box('b')];
    expect(ids(bringToFront(els, 'x'))).toEqual(['a', 'b']);
    expect(ids(sendToBack(els, 'x'))).toEqual(['a', 'b']);
  });

  it('bringManyToFront moves the set to the end, preserving their relative order', () => {
    const out = bringManyToFront([box('a'), box('b'), box('c'), box('d')], new Set(['a', 'c']));
    expect(ids(out)).toEqual(['b', 'd', 'a', 'c']);
  });

  it('sendManyToBack moves the set to the start, preserving their relative order', () => {
    const out = sendManyToBack([box('a'), box('b'), box('c'), box('d')], new Set(['b', 'd']));
    expect(ids(out)).toEqual(['b', 'd', 'a', 'c']);
  });
});

describe('unionBoxedBounds', () => {
  it('computes the union bounding box across the selected boxed elements', () => {
    const els = [
      box('a', { x: 0, y: 0, width: 50, height: 50 }),
      box('b', { x: 100, y: 80, width: 40, height: 20 }),
    ];
    expect(unionBoxedBounds(els, new Set(['a', 'b']))).toEqual({
      x: 0,
      y: 0,
      width: 140,
      height: 100,
    });
  });

  it('ignores non-boxed elements and ids outside the set', () => {
    const els = [
      box('a', { x: 0, y: 0, width: 50, height: 50 }),
      arrow('ar'),
      box('b', { x: 200, y: 200, width: 10, height: 10 }),
    ];
    expect(unionBoxedBounds(els, new Set(['a', 'ar']))).toEqual({
      x: 0,
      y: 0,
      width: 50,
      height: 50,
    });
  });

  it('returns null when the set contains no boxed elements', () => {
    expect(unionBoxedBounds([arrow('ar')], new Set(['ar']))).toBeNull();
    expect(unionBoxedBounds([box('a')], new Set(['x']))).toBeNull();
  });
});

describe('unionElementBounds', () => {
  it('spans arrows too (unlike unionBoxedBounds)', () => {
    // arrow('ar') runs (0,0)->(10,10); box 'b' sits at (100,80) 40x20.
    const els = [box('b', { x: 100, y: 80, width: 40, height: 20 }), arrow('ar')];
    expect(unionElementBounds(els, new Set(['ar', 'b']))).toEqual({
      x: 0,
      y: 0,
      width: 140,
      height: 100,
    });
  });

  it('covers an arrow-only selection where unionBoxedBounds is null', () => {
    const els = [arrow('ar')];
    expect(unionBoxedBounds(els, new Set(['ar']))).toBeNull();
    expect(unionElementBounds(els, new Set(['ar']))).toEqual({
      x: 0,
      y: 0,
      width: 10,
      height: 10,
    });
  });

  it('returns null when no listed id matches', () => {
    expect(unionElementBounds([box('a')], new Set(['x']))).toBeNull();
  });
});

describe('bringManyToFront / sendManyToBack keep layer membership', () => {
  const el = (id: string, layerId: string) =>
    ({ id, type: 'sticky', x: 0, y: 0, width: 10, height: 10, layerId }) as unknown as Element;

  const elements = [el('a', 'L1'), el('b', 'L1'), el('c', 'L2'), el('d', 'L1')];

  it('brings the selection to the end of the array, layerId untouched', () => {
    const out = bringManyToFront(elements, new Set(['a']));
    expect(out.map((e) => e.id)).toEqual(['b', 'c', 'd', 'a']);
    expect(out.find((e) => e.id === 'a')!.layerId).toBe('L1');
    // Its band-mates are all before it now, so it paints last within L1.
    const inBand = out.filter((e) => e.layerId === 'L1').map((e) => e.id);
    expect(inBand[inBand.length - 1]).toBe('a');
  });

  it('sends the selection to the start of the array, layerId untouched', () => {
    const out = sendManyToBack(elements, new Set(['d']));
    expect(out.map((e) => e.id)).toEqual(['d', 'a', 'b', 'c']);
    expect(out.find((e) => e.id === 'd')!.layerId).toBe('L1');
    const inBand = out.filter((e) => e.layerId === 'L1').map((e) => e.id);
    expect(inBand[0]).toBe('d');
  });

  it('never reorders across bands — a lower layer still paints below', () => {
    // 'c' sits on L2; bringing an L1 element to the front cannot lift it
    // above L2 content, because banding is applied at render time.
    const out = bringManyToFront(elements, new Set(['a']));
    expect(out.filter((e) => e.layerId === 'L2').map((e) => e.id)).toEqual(['c']);
  });
});
