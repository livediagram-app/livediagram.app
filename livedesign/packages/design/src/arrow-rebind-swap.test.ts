import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  arrowPolyline,
  buildElementIndex,
  passesThroughOwnShapes,
  pathsCross,
  rebindArrowAnchorsAfterMove,
  type Anchor,
  type ArrowElement,
  type Element,
  type Endpoint,
  type ShapeElement,
} from './index';

// docs/specs/008-canvas/arrow-anchors.md "Crossings on one side".

const box = (id: string, x: number, y: number): ShapeElement => ({
  id,
  type: 'shape',
  shape: 'square',
  x,
  y,
  width: 100,
  height: 100,
});
const pin = (elementId: string, anchor: Anchor): Endpoint => ({
  kind: 'pinned',
  elementId,
  anchor,
});
const free = (x: number, y: number): Endpoint => ({ kind: 'free', x, y });
const arrow = (id: string, from: Endpoint, to: Endpoint, extra: Partial<ArrowElement> = {}) =>
  ({ id, type: 'arrow', from, to, ...extra }) as ArrowElement;
const run = (els: Element[], moving: string[]) => rebindArrowAnchorsAfterMove(els, new Set(moving));
// Arrange guard: the two arrows' drawn paths really do cross.
const cross = (els: Element[], a: string, b: string) => {
  const index = buildElementIndex(els);
  const path = (id: string) => arrowPolyline(index.get(id) as ArrowElement, index);
  return pathsCross(path(a), path(b));
};
const fromAnchor = (els: Element[], id: string) => {
  const a = els.find((e) => e.id === id) as ArrowElement;
  return a.from.kind === 'pinned' ? a.from.anchor : null;
};

// Two arrows leaving A's top side and crossing above it.
const crossing = (): Element[] => [
  box('a', 0, 0),
  box('b1', 300, -300),
  box('b2', -300, -300),
  arrow('a1', pin('a', 'nnw'), pin('b1', 's')),
  arrow('a2', pin('a', 'nne'), pin('b2', 's')),
];

afterEach(() => vi.restoreAllMocks());

describe('same-side crossing swap', () => {
  it('swaps two ends on the same side whose paths cross', () => {
    expect(cross(crossing(), 'a1', 'a2')).toBe(true);
    const out = run(crossing(), ['a']);
    expect(cross(out, 'a1', 'a2')).toBe(false);
    expect(fromAnchor(out, 'a1')).toBe('nne');
    expect(fromAnchor(out, 'a2')).toBe('nnw');
  });

  it('logs the swap with a recognisable fingerprint', () => {
    const debug = vi.spyOn(console, 'debug').mockImplementation(() => {});
    run(crossing(), ['a']);
    expect(debug).toHaveBeenCalledWith('[arrow-rebind] swap element=a arrows=a1,a2 nnw<->nne');
  });

  it('does not swap when neither arrow is attached to a moved element', () => {
    const els = crossing();
    expect(run(els, ['elsewhere'])).toBe(els);
  });

  it('does not swap ends on different sides', () => {
    const els = [
      box('a', 0, 0),
      arrow('a1', pin('a', 'nnw'), free(400, -50)),
      arrow('a2', pin('a', 'ene'), free(150, -300)),
    ];
    expect(cross(els, 'a1', 'a2')).toBe(true);
    expect(run(els, ['a'])).toBe(els);
  });

  it('does not swap when trading anchors would not uncross the paths', () => {
    // a2 bows left across a1 whichever quarter each one holds.
    const els = [
      box('a', 0, 0),
      box('b', 0, -400),
      arrow('a1', pin('a', 'nnw'), pin('b', 'ssw')),
      arrow('a2', pin('a', 'nne'), pin('b', 'sse'), {
        arrowStyle: 'curved',
        curveOffset: { dx: -150, dy: 0 },
      }),
    ];
    expect(cross(els, 'a1', 'a2')).toBe(true);
    const traded = els.map((e) =>
      e.id === 'a1'
        ? { ...(e as ArrowElement), from: pin('a', 'nne') }
        : e.id === 'a2'
          ? { ...(e as ArrowElement), from: pin('a', 'nnw') }
          : e,
    );
    expect(cross(traded, 'a1', 'a2')).toBe(true);
    expect(run(els, ['a'])).toBe(els);
  });

  it('does not swap when a traded path would run through its own shape', () => {
    // On a circle the ne anchor sits on the curve; leaving it leftwards cuts
    // through the top of the circle, so a2 cannot take it.
    const circle = { ...box('a', 0, 0), shape: 'circle' as const };
    const els = [
      circle,
      arrow('a1', pin('a', 'ne'), free(-394, -303)),
      arrow('a2', pin('a', 'nne'), free(-231, -78)),
    ];
    expect(cross(els, 'a1', 'a2')).toBe(true);
    const index = buildElementIndex(els);
    const traded = { ...(els[2] as ArrowElement), from: pin('a', 'ne') };
    expect(passesThroughOwnShapes(traded, arrowPolyline(traded, index), index)).toBe(true);
    expect(run(els, ['a'])).toBe(els);
  });

  it('does not count paths that only meet at their far end', () => {
    const els = [
      box('a', 0, 0),
      arrow('a1', pin('a', 'nnw'), free(300, -300)),
      arrow('a2', pin('a', 'nne'), free(300, -300)),
    ];
    expect(run(els, ['a'])).toBe(els);
  });

  it('skips a side holding more ends than the cap, and says so', () => {
    const debug = vi.spyOn(console, 'debug').mockImplementation(() => {});
    const many: Element[] = [box('a', 0, 0)];
    for (let i = 0; i < 33; i++) {
      const left = i % 2 === 0;
      many.push(
        arrow(`m${i}`, pin('a', left ? 'nnw' : 'nne'), free(left ? 400 + i : -300 - i, -300)),
      );
    }
    expect(run(many, ['a'])).toBe(many);
    expect(debug).toHaveBeenCalledWith('[arrow-rebind] swap skipped element=a side=n ends=33');
  });
});
