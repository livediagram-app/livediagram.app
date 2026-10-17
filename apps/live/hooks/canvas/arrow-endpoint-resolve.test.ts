import { describe, expect, it } from 'vitest';
import {
  layOutIllustratePages,
  newLogoPage,
  type ArrowElement,
  type Element,
} from '@livediagram/document';
import { resolveArrowEndpointDrag } from './arrow-endpoint-resolve';

// docs/specs/007-editor/illustrate-pages.md "Arrows stay on one page": an arrow's dragged end pins
// to nothing on a page other than its other end's.
const pages = layOutIllustratePages([newLogoPage('a'), newLogoPage('b')]);
const centre = (i: number) => {
  const r = pages[i]!.rect;
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
};
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
const drag = (cursor: { x: number; y: number }, withPages: boolean) =>
  resolveArrowEndpointDrag({
    cursor,
    elements,
    arrowId: 'arrow',
    end: 'to',
    noSnap: true,
    guidesOn: false,
    pages: withPages ? pages : null,
  }).endpoint;

describe('resolveArrowEndpointDrag across pages', () => {
  it('pins to an element on the same page', () => {
    expect(drag(topOf(sameTarget), true)).toMatchObject({ kind: 'pinned', elementId: 't' });
  });

  it('stays free over an element on another page', () => {
    expect(drag(topOf(otherTarget), true)).toMatchObject({ kind: 'free' });
  });

  it('pins anywhere outside Illustrate mode', () => {
    expect(drag(topOf(otherTarget), false)).toMatchObject({ kind: 'pinned', elementId: 'o' });
  });
});

// docs/specs/008-canvas/canvas-and-palette.md "Dropped on a shape": an end over a shape's body, away from its
// anchors, pins to the side facing its other end; Cmd / Ctrl leaves it free.
describe('resolveArrowEndpointDrag over a shape body', () => {
  const over = (
    cursor: { x: number; y: number },
    opts: { noSnap?: boolean; withPages?: boolean; els?: Element[] } = {},
  ) =>
    resolveArrowEndpointDrag({
      cursor,
      elements: opts.els ?? elements,
      arrowId: 'arrow',
      end: 'to',
      noSnap: opts.noSnap ?? false,
      guidesOn: false,
      pages: opts.withPages ? pages : null,
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

  it('stays free with Cmd / Ctrl held, and over a shape on another page', () => {
    expect(over(middle(sameTarget), { noSnap: true }).endpoint).toMatchObject({ kind: 'free' });
    expect(over(middle(otherTarget), { withPages: true }).endpoint).toMatchObject({
      kind: 'free',
    });
  });

  it('does not pin back onto the shape the arrow leaves', () => {
    expect(over(middle(source)).endpoint).toMatchObject({ kind: 'free' });
  });
});
