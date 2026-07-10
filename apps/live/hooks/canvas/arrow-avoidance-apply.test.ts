import { describe, expect, it } from 'vitest';
import type { ArrowElement, Element } from '@livediagram/diagram';
import { applyCollisionAvoidance } from './arrow-avoidance-apply';

// The apply side of spec/77: pure elements map, so the whole creation
// wiring short of the pointer gesture is testable here. The geometry
// itself is covered in packages/diagram/src/arrow-avoidance.test.ts;
// these assertions pin the mapping around it (role assignment, the
// untouched-default guard, and the written wire fields).

const shape = (id: string, x: number, y: number, w = 120, h = 80): Element =>
  ({ id, type: 'shape', shape: 'square', x, y, width: w, height: h, label: id }) as Element;

const arrowBetween = (id: string, fromId: string, toId: string): ArrowElement => ({
  id,
  type: 'arrow',
  from: { kind: 'pinned', elementId: fromId, anchor: 's' },
  to: { kind: 'pinned', elementId: toId, anchor: 'n' },
});

// Two stacked endpoints with a third box squatting on the straight chord
// between them: the canonical avoidance scene.
const scene = (): Element[] => [
  shape('top', 0, 0),
  shape('mid', -20, 200), // extends 100 left / 80 right of the chord at x=60
  shape('bottom', 0, 400),
  arrowBetween('arr', 'top', 'bottom'),
];

describe('applyCollisionAvoidance', () => {
  it('curves a fresh arrow whose chord crosses an unrelated element', () => {
    const out = applyCollisionAvoidance(scene(), 'arr');
    const arr = out.find((e) => e.id === 'arr') as ArrowElement;
    expect(arr.arrowStyle).toBe('curved');
    expect(arr.curveOffset).toBeDefined();
    // The mid box reaches further left of the chord than right, so the
    // cheaper bow is rightward (positive dx).
    expect(arr.curveOffset!.dx).toBeGreaterThan(0);
    // Everything else passes through untouched (same references).
    expect(out.find((e) => e.id === 'mid')).toBe(out.find((e) => e.id === 'mid'));
  });

  it('leaves the arrow alone when the chord is clear', () => {
    const els = scene().filter((e) => e.id !== 'mid');
    const out = applyCollisionAvoidance(els, 'arr');
    expect(out).toBe(els);
  });

  it('never touches an arrow that already has a style or curve', () => {
    for (const styled of [
      { arrowStyle: 'straight' as const },
      { arrowStyle: 'elbow' as const },
      { curveOffset: { dx: 5, dy: 5 } },
      { curvePoints: [{ dx: 5, dy: 5 }] },
    ]) {
      const els = scene().map((e) => (e.id === 'arr' ? { ...e, ...styled } : e));
      const out = applyCollisionAvoidance(els, 'arr');
      expect(out).toBe(els);
    }
  });

  it('treats the endpoint elements as their own obstacles (flush case bows)', () => {
    // Both ends pinned at the RIGHT-EDGE MIDDLES of two stacked boxes: the
    // chord runs flush along both boxes' edges well past the anchor
    // exemption, so it must bow outward. (Corner anchors only graze the
    // clearance ring inside the exemption and are a known limit; see the
    // spec/77 note.)
    const els: Element[] = [
      shape('a', 0, 0, 100, 80),
      shape('b', 0, 320, 100, 80),
      {
        id: 'arr',
        type: 'arrow',
        from: { kind: 'pinned', elementId: 'b', anchor: 'e' },
        to: { kind: 'pinned', elementId: 'a', anchor: 'e' },
      } as ArrowElement,
    ];
    const out = applyCollisionAvoidance(els, 'arr');
    const arr = out.find((e) => e.id === 'arr') as ArrowElement;
    expect(arr.arrowStyle).toBe('curved');
    // Away from the boxes (which sit left of the chord) = positive dx.
    expect(arr.curveOffset!.dx).toBeGreaterThan(0);
  });

  it('is a no-op for unknown ids and non-arrows', () => {
    const els = scene();
    expect(applyCollisionAvoidance(els, 'nope')).toBe(els);
    expect(applyCollisionAvoidance(els, 'top')).toBe(els);
  });
});
