import { describe, expect, it } from 'vitest';
import type { ArrowElement, Element } from '@livehuddle/document';
import { resolveArrowEndpointDrag } from './arrow-endpoint-resolve';

const centre = (i: number) => ({ x: i * 1000, y: 0 });
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

const source = box('s', centre(0));
const sameTarget = box('t', { x: centre(0).x, y: centre(0).y + 300 });
const otherTarget = box('o', centre(1));
const arrow: ArrowElement = {
  id: 'arrow',
  type: 'arrow',
  from: { kind: 'pinned', elementId: 's', anchor: 's' },
  to: { kind: 'free', x: centre(0).x, y: centre(0).y + 120 },
};
const elements = [source, sameTarget, otherTarget, arrow];

// The cursor right on a target's top anchor.
const topOf = (el: Element) => {
  const b = el as { x: number; y: number; width: number };
  return { x: b.x + b.width / 2, y: b.y };
};
describe('resolveArrowEndpointDrag onto an anchor', () => {
  it('pins to an element anchor under the cursor', () => {
    const out = resolveArrowEndpointDrag({
      cursor: topOf(otherTarget),
      elements,
      arrowId: 'arrow',
      end: 'to',
      noSnap: true,
      guidesOn: false,
    });
    expect(out.endpoint).toMatchObject({ kind: 'pinned', elementId: 'o' });
  });
});

// docs/specs/008-canvas/canvas-and-palette.md "Dropped on a shape": an end over a shape's body, away from its
// anchors, pins to the side facing its other end; Cmd / Ctrl leaves it free.
describe('resolveArrowEndpointDrag over a shape body', () => {
  const over = (
    cursor: { x: number; y: number },
    opts: { noSnap?: boolean; els?: Element[] } = {},
  ) =>
    resolveArrowEndpointDrag({
      cursor,
      elements: opts.els ?? elements,
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
    const out = over(middle(sameTarget));
    expect(out.endpoint).toEqual({ kind: 'pinned', elementId: 't', anchor: 'n' });
    const active = out.snapTargets.filter((t) => t.active);
    expect(active).toHaveLength(1);
    expect(active[0]).toMatchObject(topOf(sameTarget));
  });

  it('stays free with Cmd / Ctrl held', () => {
    expect(over(middle(sameTarget), { noSnap: true }).endpoint).toMatchObject({ kind: 'free' });
  });

  it('does not pin back onto the shape the arrow leaves', () => {
    expect(over(middle(source)).endpoint).toMatchObject({ kind: 'free' });
  });
});
