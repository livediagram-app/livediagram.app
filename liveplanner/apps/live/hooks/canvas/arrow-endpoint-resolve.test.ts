import { describe, expect, it } from 'vitest';
import type { ArrowElement, Element } from '@liveplanner/document';
import { resolveArrowEndpointDrag } from './arrow-endpoint-resolve';

const box = (id: string, at: { x: number; y: number }) =>
  ({
    id,
    type: 'shape',
    shape: 'square',
    x: at.x - 50,
    y: at.y - 50,
    width: 100,
    height: 100,
  }) as Element;

const source = box('s', { x: 400, y: 400 });
const target = box('t', { x: 400, y: 700 });
const arrow: ArrowElement = {
  id: 'arrow',
  type: 'arrow',
  from: { kind: 'pinned', elementId: 's', anchor: 's' },
  to: { kind: 'free', x: 400, y: 520 },
};
const elements = [source, target, arrow];

// The cursor right on a target's top anchor.
const topOf = (el: Element) => {
  const b = el as { x: number; y: number; width: number };
  return { x: b.x + b.width / 2, y: b.y };
};

describe('resolveArrowEndpointDrag on an anchor', () => {
  it('pins to the element under the cursor', () => {
    const { endpoint } = resolveArrowEndpointDrag({
      cursor: topOf(target),
      elements,
      arrowId: 'arrow',
      end: 'to',
      noSnap: true,
      guidesOn: false,
    });
    expect(endpoint).toMatchObject({ kind: 'pinned', elementId: 't' });
  });
});

// docs/specs/008-canvas/canvas-and-palette.md "Dropped on a shape": an end over a shape's body, away from its
// anchors, pins to the side facing its other end; Cmd / Ctrl leaves it free.
describe('resolveArrowEndpointDrag over a shape body', () => {
  const over = (cursor: { x: number; y: number }, opts: { noSnap?: boolean } = {}) =>
    resolveArrowEndpointDrag({
      cursor,
      elements,
      arrowId: 'arrow',
      end: 'to',
      noSnap: opts.noSnap ?? false,
      guidesOn: false,
    });
  const middle = (el: Element) => {
    const b = el as { x: number; y: number; width: number; height: number };
    return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
  };

  it('pins to the side that faces the source, and marks that anchor', () => {
    const out = over(middle(target));
    expect(out.endpoint).toEqual({ kind: 'pinned', elementId: 't', anchor: 'n' });
    const active = out.snapTargets.filter((t) => t.active);
    expect(active).toHaveLength(1);
    expect(active[0]).toMatchObject(topOf(target));
  });

  it('stays free with Cmd / Ctrl held', () => {
    expect(over(middle(target), { noSnap: true }).endpoint).toMatchObject({ kind: 'free' });
  });

  it('does not pin back onto the shape the arrow leaves', () => {
    expect(over(middle(source)).endpoint).toMatchObject({ kind: 'free' });
  });
});
