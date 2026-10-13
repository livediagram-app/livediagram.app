import { describe, expect, it } from 'vitest';
import { arrowPathD } from './arrow-path';
import { createPinnedArrow, createShape } from './factories';
import { MIND_CONNECTOR_LOOK, type MindFlow } from './mind-flow';
import {
  finishArrowEnds,
  finishMindConnectorRoute,
  finishRoutedArrow,
  isDefaultMindConnectorLook,
} from './mind-connector-route';
import { svgArrow } from './svg-render-arrows';
import type { Anchor, ArrowElement, Element, ShapeElement } from './index';

// docs/specs/009-elements/mind-node.md "Connectors" and docs/specs/008-canvas/finish.md "Professional":
// a mind map's default curved connectors draw right-angled under Professional, on one shared trunk per
// parent; the bubble flow draws straight spokes; a look picked on a connector wins.

const W = 250;
const H = 80;

const node = (
  id: string,
  x: number,
  y: number,
  parent?: string,
  flow?: MindFlow,
): ShapeElement => ({
  ...(createShape('mind-node', x, y) as ShapeElement),
  id,
  width: W,
  height: H,
  ...(parent ? { mindParentId: parent } : {}),
  ...(flow ? { mindFlow: flow } : {}),
});

const connector = (
  id: string,
  from: string,
  fromAnchor: Anchor,
  to: string,
  toAnchor: Anchor,
): ArrowElement => ({
  ...createPinnedArrow(from, fromAnchor, to, toAnchor),
  id,
  ...MIND_CONNECTOR_LOOK,
});

// A tree as growth lays it out: children 64 px right of the root, stacked 18 px apart.
function tree(): Element[] {
  return [
    node('root', 0, 0),
    node('a', 314, 0, 'root'),
    node('b', 314, 98, 'root'),
    node('c', 314, 196, 'root'),
    connector('ra', 'root', 'e', 'a', 'w'),
    connector('rb', 'root', 'e', 'b', 'w'),
    connector('rc', 'root', 'e', 'c', 'w'),
  ];
}

const arrowOf = (els: Element[], id: string) => els.find((e) => e.id === id) as ArrowElement;

describe('finishMindConnectorRoute', () => {
  it('leaves every finish but Professional to the stored look', () => {
    const els = tree();
    expect(finishMindConnectorRoute(arrowOf(els, 'rb'), els, 'flexible')).toBeNull();
    expect(finishMindConnectorRoute(arrowOf(els, 'rb'), els, 'sketch')).toBeNull();
    expect(finishRoutedArrow(arrowOf(els, 'rb'), els, 'flexible')).toBe(arrowOf(els, 'rb'));
  });

  it('turns every sibling on one trunk halfway across the gap (tree)', () => {
    const els = tree();
    // Root east face at x 250, children's west faces at 314: trunk x 282.
    expect(finishMindConnectorRoute(arrowOf(els, 'rb'), els, 'professional')).toEqual({
      style: 'angled',
      corners: [
        { x: 282, y: 40 },
        { x: 282, y: 138 },
      ],
    });
    expect(finishMindConnectorRoute(arrowOf(els, 'rc'), els, 'professional')).toEqual({
      style: 'angled',
      corners: [
        { x: 282, y: 40 },
        { x: 282, y: 236 },
      ],
    });
  });

  it('draws a child level with its parent as one straight run', () => {
    const els = tree();
    expect(finishMindConnectorRoute(arrowOf(els, 'ra'), els, 'professional')).toEqual({
      style: 'angled',
      corners: [],
    });
    const drawn = finishRoutedArrow(arrowOf(els, 'ra'), els, 'professional');
    expect(drawn.arrowStyle).toBe('straight');
    expect(drawn.curvePoints).toBeUndefined();
  });

  it('keeps the shared trunk when one child sits further out', () => {
    const els = tree().map((e) => (e.id === 'c' ? { ...e, x: 500 } : e));
    const corners = finishMindConnectorRoute(arrowOf(els, 'rc'), els, 'professional')!.corners;
    expect(corners.map((p) => p.x)).toEqual([282, 282]);
  });

  it('puts the trunk on the left for a balanced map’s west branches', () => {
    const els: Element[] = [
      node('root', 0, 0, undefined, 'balanced'),
      node('r', 314, 0, 'root'),
      node('l1', -314, 0, 'root'),
      node('l2', -314, 98, 'root'),
      connector('rl2', 'root', 'w', 'l2', 'e'),
      connector('rr', 'root', 'e', 'r', 'w'),
    ];
    // Root west face at 0, left children's east faces at -64: trunk x -32.
    expect(finishMindConnectorRoute(arrowOf(els, 'rl2'), els, 'professional')!.corners).toEqual([
      { x: -32, y: 40 },
      { x: -32, y: 138 },
    ]);
  });

  it('runs one horizontal bus at mid-gap and drops into each child’s top (downward)', () => {
    const els: Element[] = [
      node('root', 0, 0, undefined, 'downward'),
      node('a', -134, 130, 'root'),
      node('b', 134, 130, 'root'),
      connector('ra', 'root', 's', 'a', 'n'),
      connector('rb', 'root', 's', 'b', 'n'),
    ];
    // Root bottom at y 80, children's tops at 130: bus y 105.
    expect(finishMindConnectorRoute(arrowOf(els, 'ra'), els, 'professional')!.corners).toEqual([
      { x: 125, y: 105 },
      { x: -9, y: 105 },
    ]);
    expect(finishMindConnectorRoute(arrowOf(els, 'rb'), els, 'professional')!.corners).toEqual([
      { x: 125, y: 105 },
      { x: 259, y: 105 },
    ]);
  });

  it('mirrors the bracket for the leftward flow, the trunk west of the root', () => {
    const els: Element[] = [
      node('root', 0, 0, undefined, 'leftward'),
      node('a', -314, -49, 'root'),
      node('b', -314, 49, 'root'),
      connector('ra', 'root', 'w', 'a', 'e'),
      connector('rb', 'root', 'w', 'b', 'e'),
    ];
    // Root's west face at x 0, children's east faces at -64: trunk x -32.
    expect(finishMindConnectorRoute(arrowOf(els, 'ra'), els, 'professional')!.corners).toEqual([
      { x: -32, y: 40 },
      { x: -32, y: -9 },
    ]);
  });

  it('mirrors the bus for the upward flow, rising into each child’s bottom', () => {
    const els: Element[] = [
      node('root', 0, 0, undefined, 'upward'),
      node('a', -134, -130, 'root'),
      node('b', 134, -130, 'root'),
      connector('ra', 'root', 'n', 'a', 's'),
      connector('rb', 'root', 'n', 'b', 's'),
    ];
    // Root top at y 0, children's bottoms at -50: bus y -25.
    expect(finishMindConnectorRoute(arrowOf(els, 'rb'), els, 'professional')!.corners).toEqual([
      { x: 125, y: -25 },
      { x: 259, y: -25 },
    ]);
  });

  it('draws the bubble flow as straight spokes', () => {
    const els: Element[] = [
      node('root', 0, 0, undefined, 'bubble'),
      node('a', 300, 200, 'root'),
      node('aa', 600, 400, 'a'),
      connector('ra', 'root', 'se', 'a', 'nw'),
      connector('a-aa', 'a', 'se', 'aa', 'nw'),
    ];
    expect(finishMindConnectorRoute(arrowOf(els, 'ra'), els, 'professional')).toEqual({
      style: 'straight',
      corners: [],
    });
    // The flow is the root's, however deep the branch.
    expect(finishRoutedArrow(arrowOf(els, 'a-aa'), els, 'professional').arrowStyle).toBe(
      'straight',
    );
  });

  it('routes a connector drawn child to parent the same way, reversed', () => {
    const els = tree().map((e) => (e.id === 'rb' ? connector('rb', 'b', 'w', 'root', 'e') : e));
    expect(finishMindConnectorRoute(arrowOf(els, 'rb'), els, 'professional')!.corners).toEqual([
      { x: 282, y: 138 },
      { x: 282, y: 40 },
    ]);
  });

  it('falls back to the plain one-elbow angled line when the faces do not face each other', () => {
    const els = tree().map((e) => (e.id === 'rb' ? connector('rb', 'root', 's', 'b', 'w') : e));
    const drawn = finishRoutedArrow(arrowOf(els, 'rb'), els, 'professional');
    expect(drawn.arrowStyle).toBe('angled');
    expect(drawn.curvePoints).toBeUndefined();
  });

  it('respects a look picked on the connector', () => {
    const els = tree();
    const base = arrowOf(els, 'rb');
    for (const picked of [
      { ...base, arrowStyle: 'straight' as const },
      { ...base, arrowStyle: 'angled' as const },
      { ...base, arrowStyle: undefined },
      { ...base, curveOffset: { dx: 0, dy: 20 } },
      { ...base, curvePoints: [{ dx: 5, dy: 5 }] },
    ]) {
      expect(isDefaultMindConnectorLook(picked)).toBe(false);
      expect(finishMindConnectorRoute(picked, els, 'professional')).toBeNull();
    }
  });

  it('leaves arrows that are not a parent-child connector alone', () => {
    const els = tree();
    const across = connector('ab', 'a', 's', 'b', 'n');
    const toBox = { ...createShape('square', 600, 0), id: 'box' };
    const out = connector('a-box', 'a', 'e', 'box', 'w');
    const all = [...els, across, toBox, out];
    expect(finishMindConnectorRoute(across, all, 'professional')).toBeNull();
    expect(finishMindConnectorRoute(out, all, 'professional')).toBeNull();
  });
});

describe('finishArrowEnds', () => {
  it('starts every routed sibling at the exact anchor, out of the converging fan', () => {
    const els = tree();
    const starts = ['ra', 'rb', 'rc'].map(
      (id) => finishArrowEnds(arrowOf(els, id), els, 'professional').from,
    );
    expect(starts).toEqual([
      { x: 250, y: 40 },
      { x: 250, y: 40 },
      { x: 250, y: 40 },
    ]);
    // Flexible keeps the fan: the three starts slide apart along the face.
    const fanned = ['ra', 'rb', 'rc'].map(
      (id) => finishArrowEnds(arrowOf(els, id), els, 'flexible').from.y,
    );
    expect(new Set(fanned).size).toBe(3);
  });

  it('draws the bracket as a polyline through the trunk', () => {
    const els = tree();
    const { arrow, from, to } = finishArrowEnds(arrowOf(els, 'rb'), els, 'professional');
    expect(arrow.exactStart).toBe(true);
    expect(arrow.exactEnd).toBe(true);
    expect(
      arrowPathD(
        arrow.arrowStyle!,
        from,
        to,
        arrow.from,
        arrow.to,
        arrow.curveOffset,
        arrow.elbowOffset,
        arrow.curvePoints,
      ),
    ).toBe('M 250 40 L 282 40 L 282 138 L 314 138');
  });
});

describe('svgArrow under a finish', () => {
  it('exports the Professional bracket and restores the curve in Flexible', () => {
    const els = tree();
    const rb = arrowOf(els, 'rb');
    const pro = svgArrow(
      rb,
      els,
      'light',
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      'professional',
    );
    expect(pro).toContain('d="M 250 40 L 282 40 L 282 138 L 314 138"');
    const flexible = svgArrow(rb, els, 'light');
    expect(flexible).toMatch(/d="M [^"]* Q /);
  });
});
