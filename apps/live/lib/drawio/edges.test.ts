// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import type { ArrowElement } from '@livediagram/document';
import { ReportTally } from '@/lib/import-report';
import { readGraph } from './cells';
import { convertPage } from './convert-page';
import { model, vertex } from './test-support';

const boxA = vertex('a', '', 'x="0" y="0" width="100" height="50"', 'parent="1" value="A"');
const boxB = vertex('b', '', 'x="300" y="200" width="100" height="50"', 'parent="1" value="B"');
const edge = (style: string, inner = '', extra = 'source="a" target="b"') =>
  `<mxCell id="e" style="${style}" edge="1" parent="1" ${extra}><mxGeometry relative="1" as="geometry">${inner}</mxGeometry></mxCell>`;

function convert(xml: string) {
  const tally = new ReportTally();
  const page = convertPage(readGraph(model(xml)), {
    tally,
    pageIdToTab: new Map(),
    images: [],
    imageKeys: new Map(),
  });
  const arrow = page.elements.find((e): e is ArrowElement => e.type === 'arrow')!;
  const idOf = (label: string) => page.elements.find((e) => 'label' in e && e.label === label)?.id;
  return { arrow, notes: tally.notes(), idOf, page };
}

describe('edge ends', () => {
  it('pins floating ends to the anchor facing the other end', () => {
    const { arrow, idOf } = convert(boxA + boxB + edge('html=1;'));
    expect(arrow.from).toEqual({ kind: 'pinned', elementId: idOf('A'), anchor: 'se' });
    expect(arrow.to).toEqual({ kind: 'pinned', elementId: idOf('B'), anchor: 'nw' });
  });

  it('uses the middle of the side the line leaves through for an orthogonal edge', () => {
    const { arrow } = convert(boxA + boxB + edge('edgeStyle=orthogonalEdgeStyle;'));
    expect(arrow.from).toMatchObject({ anchor: 's' });
    expect(arrow.to).toMatchObject({ anchor: 'n' });
    expect(arrow.arrowStyle).toBe('angled');
  });

  it('pins a fixed exit / entry point to its nearest anchor', () => {
    const { arrow } = convert(
      boxA + boxB + edge('exitX=0.5;exitY=1;entryX=0;entryY=0.5;edgeStyle=orthogonalEdgeStyle;'),
    );
    expect(arrow.from).toMatchObject({ anchor: 's' });
    expect(arrow.to).toMatchObject({ anchor: 'w' });
  });

  it('keeps a loose end at its point, uncounted', () => {
    const { arrow, notes } = convert(
      boxA + edge('', '<mxPoint x="500" y="10" as="targetPoint"/>', 'source="a"'),
    );
    expect(arrow.to).toEqual({ kind: 'free', x: 500, y: 10 });
    expect(notes).toEqual([]);
  });

  it('frees and counts an end whose cell has nowhere to pin', () => {
    const { arrow, notes } = convert(boxA + edge('', '', 'source="a" target="ghost"'));
    expect(arrow.to.kind).toBe('free');
    expect(notes).toEqual([{ kind: 'connection-loosened', count: 1 }]);
  });

  it('frees an end on another edge at that edge’s middle', () => {
    const other =
      '<mxCell id="f" edge="1" parent="1" source="a" target="b"><mxGeometry relative="1" as="geometry"/></mxCell>';
    const { page, notes } = convert(boxA + boxB + other + edge('', '', 'source="a" target="f"'));
    const onEdge = page.elements.filter((e): e is ArrowElement => e.type === 'arrow')[1]!;
    expect(onEdge.to).toEqual({ kind: 'free', x: 200, y: 125 });
    expect(notes).toEqual([{ kind: 'connection-loosened', count: 1 }]);
  });
});

describe('edge routes', () => {
  it('adds right-angle corners through orthogonal waypoints', () => {
    const { arrow } = convert(
      boxA +
        boxB +
        edge(
          'edgeStyle=orthogonalEdgeStyle;exitX=1;exitY=0.5;entryX=0.5;entryY=0;',
          '<Array as="points"><mxPoint x="200" y="100"/></Array>',
        ),
    );
    // from (100, 25) east, via (200, 100), to (350, 200) north.
    const mid = { x: (100 + 350) / 2, y: (25 + 200) / 2 };
    const abs = arrow.curvePoints!.map((p) => ({ x: p.dx + mid.x, y: p.dy + mid.y }));
    expect(abs).toEqual([
      { x: 200, y: 25 },
      { x: 200, y: 100 },
      { x: 350, y: 100 },
    ]);
  });

  it('draws a bent straight edge as a polyline and a curved one through its points', () => {
    const pts = '<Array as="points"><mxPoint x="50" y="200"/></Array>';
    expect(convert(boxA + boxB + edge('html=1;', pts)).arrow).toMatchObject({
      arrowStyle: 'angled',
      curvePoints: [expect.any(Object)],
    });
    expect(convert(boxA + boxB + edge('curved=1;', pts)).arrow.arrowStyle).toBe('curved');
  });

  it('resolves waypoints of an edge inside a container', () => {
    const lane = vertex(
      'p',
      'swimlane;',
      'x="1000" y="1000" width="600" height="400"',
      'parent="1"',
    );
    const a = vertex('a', '', 'x="0" y="50" width="100" height="50"', 'parent="p" value="A"');
    const b = vertex('b', '', 'x="400" y="50" width="100" height="50"', 'parent="p" value="B"');
    const e =
      '<mxCell id="e" style="curved=1;" edge="1" parent="p" source="a" target="b"><mxGeometry relative="1" as="geometry"><Array as="points"><mxPoint x="250" y="300"/></Array></mxGeometry></mxCell>';
    const { arrow, page } = convert(lane + a + b + e);
    const [from, to] = [arrow.from, arrow.to].map((ep) => {
      const el = page.elements.find((x) => ep.kind === 'pinned' && x.id === ep.elementId)!;
      return el;
    });
    expect(from).toMatchObject({ x: 1000, y: 1050 });
    expect(to).toMatchObject({ x: 1400 });
    // The waypoint sits in the lane's coordinates: (1250, 1300) on the canvas.
    expect(arrow.curvePoints).toHaveLength(1);
  });
});

describe('edge heads and stroke', () => {
  it('reads heads, fills and sizes', () => {
    const { arrow, notes } = convert(
      boxA + boxB + edge('endArrow=block;endFill=0;endSize=12;strokeWidth=3;dashed=1;'),
    );
    expect(arrow).toMatchObject({
      arrowheadShape: 'triangle-hollow',
      arrowheadSize: 'extra-large',
      strokeWidth: 3,
      strokeStyle: 'dashed',
    });
    expect(arrow.arrowEnds).toBeUndefined();
    expect(notes).toEqual([]);
  });

  it('counts heads livediagram does not draw, and mismatched pairs', () => {
    expect(convert(boxA + boxB + edge('endArrow=ERmany;')).notes).toEqual([
      { kind: 'arrowhead-approximated', count: 1 },
    ]);
    expect(convert(boxA + boxB + edge('startArrow=diamond;endArrow=classic;')).notes).toEqual([
      { kind: 'arrowhead-approximated', count: 1 },
    ]);
    expect(convert(boxA + boxB + edge('endArrow=none;')).arrow.arrowEnds).toBe('none');
  });

  it('keeps an invisible edge invisible', () => {
    expect(convert(boxA + boxB + edge('strokeColor=none;')).arrow.opacity).toBe(0);
  });
});

describe('edge labels', () => {
  it('joins the edge value and label children, and counts the merge', () => {
    const label = (id: string, value: string, x: string) =>
      `<mxCell id="${id}" value="${value}" style="edgeLabel;html=1;" vertex="1" connectable="0" parent="e"><mxGeometry x="${x}" relative="1" as="geometry"><mxPoint as="offset"/></mxGeometry></mxCell>`;
    const { arrow, notes, page } = convert(
      boxA +
        boxB +
        edge('html=1;', '', 'source="a" target="b" value="main"') +
        label('l1', 'first', '0.5') +
        label('l2', 'second', '0'),
    );
    expect(arrow.label).toBe('main\nfirst\nsecond');
    expect(arrow.labelOffset).toEqual({ t: 0.75, offset: 0 });
    expect(notes).toEqual([{ kind: 'label-moved', count: 1 }]);
    expect(page.elements).toHaveLength(3);
  });

  it('places a shape riding on an edge along it', () => {
    const rider =
      '<mxCell id="r" value="R" style="ellipse;" vertex="1" parent="e"><mxGeometry x="0" y="0" width="20" height="20" relative="1" as="geometry"/></mxCell>';
    const { page } = convert(boxA + boxB + edge('') + rider);
    expect(page.elements.find((x) => 'label' in x && x.label === 'R')).toMatchObject({
      x: 190,
      y: 115,
    });
  });
});
