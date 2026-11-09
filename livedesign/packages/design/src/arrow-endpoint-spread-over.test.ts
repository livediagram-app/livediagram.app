import { describe, expect, it } from 'vitest';
import { arrowEndpointSpread, spreadOverBase } from './arrow-endpoint-spread';
import { createShape } from './factories';
import type { ArrowElement, Element, Endpoint } from './index';

// A drag preview's board is the document's index with the dragged elements replaced (spreadOverBase,
// docs/specs/008-canvas/blueprints/drag-preview.md "Performance and limits"): its fans are placed again only where
// they read what moved, and must come out exactly as placing every fan over it.

const ANCHORS = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'] as const;

function box(id: string, x: number, y: number, width = 120, height = 60) {
  return { ...createShape('square', x, y), id, width, height };
}
function arrow(from: Endpoint, to: Endpoint, id: string): ArrowElement {
  return { id, type: 'arrow', from, to };
}
function pinned(elementId: string, anchor: (typeof ANCHORS)[number]) {
  return { kind: 'pinned', elementId, anchor } as const;
}

// A seeded generator, so a failing board is the same board every run.
function random(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

function board(rand: () => number): Element[] {
  const boxes = Array.from({ length: 12 }, (_, i) => ({
    ...box(`b${i}`, Math.round(rand() * 900), Math.round(rand() * 700), 80 + i * 7, 50 + i * 3),
    ...(rand() < 0.3 ? { rotation: Math.round(rand() * 90) } : {}),
  }));
  const pick = <T>(list: readonly T[]) => list[Math.floor(rand() * list.length)]!;
  const arrows: ArrowElement[] = [];
  for (let i = 0; i < 40; i++) {
    // Most ends pin to a few hubs' anchors, so many fans form; some are free, some sit on an earlier arrow.
    const end = (): Endpoint => {
      const r = rand();
      if (r < 0.7) return pinned(pick(boxes.slice(0, 4)).id, pick(ANCHORS));
      if (r < 0.85 || arrows.length === 0)
        return { kind: 'free', x: Math.round(rand() * 900), y: Math.round(rand() * 700) };
      return { kind: 'on-arrow', arrowId: pick(arrows).id, t: 0.5 };
    };
    arrows.push({
      ...arrow(end(), end(), `a${i}`),
      ...(rand() < 0.1 ? { exactStart: true } : {}),
      ...(rand() < 0.1 ? { exactEnd: true } : {}),
    });
  }
  return [...boxes, ...arrows];
}

const endsOf = (elements: readonly Element[]) =>
  elements
    .filter((el): el is ArrowElement => el.type === 'arrow')
    .flatMap((a) => [
      [a.id, 'from'],
      [a.id, 'to'],
    ]) as [string, 'from' | 'to'][];

function check(seed: number, move: (el: Element, rand: () => number) => Element) {
  const rand = random(seed);
  const doc = board(rand);
  const base = new Map(doc.map((el) => [el.id, el] as const));
  // The base's fans first, as the canvas places them before any drag.
  for (const [id, end] of endsOf(doc)) arrowEndpointSpread(id, end, base);
  const changed = new Map<string, Element>();
  for (const el of doc) if (rand() < 0.4) changed.set(el.id, move(el, rand));
  const over = new Map(base);
  for (const [id, el] of changed) over.set(id, el);
  spreadOverBase(over, base, changed.keys());
  const fresh = new Map(over);
  for (const [id, end] of endsOf(doc))
    expect(arrowEndpointSpread(id, end, over), `seed ${seed} ${id}:${end}`).toEqual(
      arrowEndpointSpread(id, end, fresh),
    );
}

describe('a board laid over another', () => {
  it('places a move of boxes and arrows as a fresh board would', () => {
    for (let seed = 1; seed <= 60; seed++)
      check(seed, (el, rand) =>
        el.type === 'arrow'
          ? el.from.kind === 'free'
            ? { ...el, from: { ...el.from, x: el.from.x + Math.round(rand() * 300 - 150) } }
            : el
          : { ...el, x: (el as { x: number }).x + Math.round(rand() * 400 - 200) },
      );
  });

  it('places a resize and a turn as a fresh board would', () => {
    for (let seed = 61; seed <= 90; seed++)
      check(seed, (el, rand) =>
        el.type === 'arrow'
          ? el
          : { ...el, width: 40 + Math.round(rand() * 200), rotation: Math.round(rand() * 180) },
      );
  });

  it('places every fan again when an arrow changes which pins it joins', () => {
    for (let seed = 91; seed <= 110; seed++)
      check(seed, (el, rand) =>
        el.type === 'arrow'
          ? { ...el, to: pinned('b1', ANCHORS[Math.floor(rand() * 8)]!), exactEnd: rand() < 0.5 }
          : el,
      );
  });

  it('places every fan again when an element came or went, or stopped being a box', () => {
    const hub = box('hub', 400, 100);
    const a = arrow({ kind: 'free', x: 100, y: 400 }, pinned('hub', 's'), 'a1');
    const b = arrow({ kind: 'free', x: 700, y: 400 }, pinned('hub', 's'), 'a2');
    const base = new Map<string, Element>([hub, a, b].map((el) => [el.id, el]));
    expect(arrowEndpointSpread('a1', 'to', base).x).toBeLessThan(0);
    // One fewer: the fan is gone.
    const fewer = new Map(base);
    fewer.delete('a2');
    spreadOverBase(fewer, base, []);
    expect(arrowEndpointSpread('a1', 'to', fewer)).toEqual({ x: 0, y: 0 });
    // The hub is no longer a box: nothing to fan along.
    const notBox = new Map(base);
    notBox.set('hub', arrow({ kind: 'free', x: 0, y: 0 }, { kind: 'free', x: 1, y: 1 }, 'hub'));
    spreadOverBase(notBox, base, ['hub']);
    expect(arrowEndpointSpread('a1', 'to', notBox)).toEqual({ x: 0, y: 0 });
    // An id the base never had, in place of one it had.
    const swapped = new Map(base);
    swapped.delete('a2');
    swapped.set('a3', { ...b, id: 'a3' });
    spreadOverBase(swapped, base, ['a3']);
    expect(arrowEndpointSpread('a3', 'to', swapped)).toEqual(arrowEndpointSpread('a2', 'to', base));
  });
});
