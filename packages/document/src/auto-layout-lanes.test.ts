import { describe, expect, it } from 'vitest';
import { autoLayoutElements } from './auto-layout';
import { reanchorArrow } from './auto-layout-shared';
import { createPinnedArrow, createShape } from './factories';
import type { ArrowElement, BoxedElement, Element, ShapeElement } from './index';

// docs/specs/008-canvas/layout-cleanup.md: long edges keep a lane, nodes sit by their neighbours,
// plain chains run straight, and flow edges leave and land on the flow faces.

const node = (id: string, w = 160, h = 60): ShapeElement => ({
  ...createShape('square', 0, 0),
  id,
  width: w,
  height: h,
});
const edge = (from: string, to: string): ArrowElement => ({
  ...createPinnedArrow(from, 's', to, 'n'),
  id: `${from}-${to}`,
});
const box = (els: Element[], id: string) => els.find((e) => e.id === id) as BoxedElement;
const cx = (b: BoxedElement) => b.x + b.width / 2;

describe('long edges', () => {
  it('route beside the node a branch skips, not through it', () => {
    // B branches to C and straight to D; C rejoins D. B -> D spans two ranks.
    const laid = autoLayoutElements(
      [node('b'), node('c'), node('d'), edge('b', 'c'), edge('b', 'd'), edge('c', 'd')],
      { direction: 'TB' },
    );
    const b = box(laid, 'b');
    const c = box(laid, 'c');
    const d = box(laid, 'd');
    // The straight B -> D line, at C's height, must clear C's box.
    const t = (c.y + c.height / 2 - (b.y + b.height)) / (d.y - (b.y + b.height));
    const lineX = cx(b) + (cx(d) - cx(b)) * t;
    expect(lineX < c.x || lineX > c.x + c.width).toBe(true);
  });
});

describe('placement', () => {
  it('runs a plain chain dead straight under a branch', () => {
    const laid = autoLayoutElements(
      [
        node('p'),
        node('a', 120),
        node('x', 200),
        node('s', 140),
        node('d', 180),
        edge('p', 'a'),
        edge('p', 'x'),
        edge('a', 's'),
        edge('s', 'd'),
      ],
      { direction: 'TB' },
    );
    expect(cx(box(laid, 's'))).toBeCloseTo(cx(box(laid, 'a')));
    expect(cx(box(laid, 'd'))).toBeCloseTo(cx(box(laid, 'a')));
  });

  it('centres a parent over its children', () => {
    const laid = autoLayoutElements(
      [node('p'), node('a'), node('b'), edge('p', 'a'), edge('p', 'b')],
      { direction: 'TB' },
    );
    expect(cx(box(laid, 'p'))).toBeCloseTo((cx(box(laid, 'a')) + cx(box(laid, 'b'))) / 2);
  });
});

describe('flow faces', () => {
  it('leaves the bottom and lands on the top for a child far across the rank', () => {
    const a = reanchorArrow(
      edge('p', 'c'),
      new Map([
        ['p', { x: 0, y: 0 }],
        ['c', { x: 900, y: 200 }],
      ]),
      'TB',
    );
    expect(a.from).toMatchObject({ anchor: 's' });
    expect(a.to).toMatchObject({ anchor: 'n' });
  });

  it('still picks by angle without an axis', () => {
    const a = reanchorArrow(
      edge('p', 'c'),
      new Map([
        ['p', { x: 0, y: 0 }],
        ['c', { x: 900, y: 200 }],
      ]),
    );
    expect(a.from).toMatchObject({ anchor: 'e' });
  });
});
