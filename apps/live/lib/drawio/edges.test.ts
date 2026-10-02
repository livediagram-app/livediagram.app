// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import {
  arrowLabelAnchor,
  arrowLabelFontSize,
  endpointPosition,
  type ArrowElement,
} from '@livediagram/document';
import { DRAWIO_CAPTION_WIDTH_SLACK } from './edges';
import { labelTextWidth } from './text-size';
import type { Pt } from './cells';
import { ReportTally } from './notes';
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
    // Geometry rules read in draw.io units; the page scale has its own tests (scale.test.ts).
    scale: 1,
    images: [],
    imageKeys: new Map(),
  });
  const arrow = page.elements.find((e): e is ArrowElement => e.type === 'arrow')!;
  const idOf = (label: string) => page.elements.find((e) => 'label' in e && e.label === label)?.id;
  return { arrow, notes: tally.notes(), idOf, page };
}

// Every expected route below is draw.io's own, from its desktop CLI's SVG export of the same cells.
const boxBelow = vertex('b', '', 'x="200" y="300" width="100" height="50"', 'parent="1" value="B"');
const absolute = (arrow: ArrowElement, from: Pt, to: Pt) => {
  const mid = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
  return arrow.curvePoints!.map((p) => ({ x: p.dx + mid.x, y: p.dy + mid.y }));
};

describe('edge ends', () => {
  it('pins a floating end to the anchor nearest where draw.io’s line meets the shape', () => {
    // draw.io: (66.7, 50) on A's bottom to (233.3, 300) on B's top.
    const { arrow, idOf } = convert(boxA + boxBelow + edge('html=1;'));
    expect(arrow.from).toEqual({ kind: 'pinned', elementId: idOf('A'), anchor: 'sse' });
    expect(arrow.to).toEqual({ kind: 'pinned', elementId: idOf('B'), anchor: 'nnw' });
    expect(arrow.arrowStyle).toBeUndefined();
  });

  it('pins an orthogonal end on the side draw.io’s route leaves through', () => {
    // draw.io: (100, 25) east to (350, 25), down into B's top at (350, 200).
    const { arrow } = convert(boxA + boxB + edge('edgeStyle=orthogonalEdgeStyle;'));
    expect(arrow.from).toMatchObject({ anchor: 'e' });
    expect(arrow.to).toMatchObject({ anchor: 'n' });
    expect(arrow.arrowStyle).toBe('angled');
    expect(absolute(arrow, { x: 100, y: 25 }, { x: 350, y: 200 })).toEqual([{ x: 350, y: 25 }]);
  });

  it('keeps imported ends exactly where they meet and the line over what it crosses', () => {
    const { arrow } = convert(boxA + boxB + edge('edgeStyle=orthogonalEdgeStyle;'));
    expect(arrow).toMatchObject({ exactStart: true, exactEnd: true, routeBehind: false });
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
    expect(arrow.from).toMatchObject({ kind: 'pinned', anchor: 'e' });
    expect(arrow.to).toEqual({ kind: 'free', x: 500, y: 10 });
    expect(arrow.exactEnd).toBeUndefined();
    expect(notes).toEqual([]);
  });

  it('draws an edge with no terminals between its own points', () => {
    const legend = edge(
      'html=1;',
      '<mxPoint x="60" y="420" as="sourcePoint"/><mxPoint x="200" y="420" as="targetPoint"/>',
      '',
    );
    const { arrow, notes } = convert(legend);
    expect(arrow.from).toEqual({ kind: 'free', x: 60, y: 420 });
    expect(arrow.to).toEqual({ kind: 'free', x: 200, y: 420 });
    expect(notes).toEqual([]);
  });

  it('frees and counts an end whose cell has nowhere to pin', () => {
    const { arrow, notes } = convert(boxA + edge('', '', 'source="a" target="ghost"'));
    expect(arrow.to.kind).toBe('free');
    expect(notes).toEqual([{ kind: 'connection-loosened', count: 1 }]);
  });

  it('attaches an end on another edge to that edge’s arrow, where draw.io meets it', () => {
    // draw.io ends the tap at the middle of the other edge's path, (149.9, 174.8).
    const other =
      '<mxCell id="f" edge="1" parent="1" source="a" target="b"><mxGeometry relative="1" as="geometry"/></mxCell>';
    const tap = edge('', '<mxPoint x="400" y="100" as="sourcePoint"/>', 'target="f"');
    const { page, notes } = convert(boxA + boxBelow + other + tap);
    const [main, onEdge] = page.elements.filter((e): e is ArrowElement => e.type === 'arrow');
    expect(onEdge!.to).toMatchObject({ kind: 'on-arrow', arrowId: main!.id });
    const at = endpointPosition(onEdge!.to, page.elements);
    expect(at.x).toBeCloseTo(149.9, 0);
    expect(at.y).toBeCloseTo(174.8, 0);
    expect(notes).toEqual([]);
  });
});

describe('edge routes', () => {
  it('runs an orthogonal route through draw.io’s corners, waypoints included', () => {
    // draw.io: (50, 50) down to (50, 100), across to (200, 100), down to (200, 225), into B.
    const { arrow } = convert(
      boxA +
        boxB +
        edge(
          'edgeStyle=orthogonalEdgeStyle;',
          '<Array as="points"><mxPoint x="200" y="100"/></Array>',
        ),
    );
    expect(arrow.from).toMatchObject({ anchor: 's' });
    expect(arrow.to).toMatchObject({ anchor: 'w' });
    expect(absolute(arrow, { x: 50, y: 50 }, { x: 300, y: 225 })).toEqual([
      { x: 50, y: 100 },
      { x: 200, y: 100 },
      { x: 200, y: 225 },
    ]);
  });

  it('draws a one-corner curve as draw.io’s quadratic, through the side draw.io leaves by', () => {
    const { arrow } = convert(boxA + boxB + edge('edgeStyle=orthogonalEdgeStyle;curved=1;'));
    expect(arrow.arrowStyle).toBe('curved');
    expect(arrow.from).toMatchObject({ anchor: 'e' });
    expect(arrow.to).toMatchObject({ anchor: 'n' });
    // The control point is the route's corner, (350, 25).
    expect(arrow.curveOffset).toEqual({ dx: 350 - 225, dy: 25 - 112.5 });
    expect(arrow.curvePoints).toBeUndefined();
  });

  it('draws a bent straight edge as a polyline and a curved one through its points', () => {
    const pts = '<Array as="points"><mxPoint x="50" y="200"/><mxPoint x="250" y="150"/></Array>';
    expect(convert(boxA + boxB + edge('html=1;', pts)).arrow).toMatchObject({
      arrowStyle: 'angled',
      curvePoints: [expect.any(Object), expect.any(Object)],
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
      '<mxCell id="e" style="html=1;" edge="1" parent="p" source="a" target="b"><mxGeometry relative="1" as="geometry"><Array as="points"><mxPoint x="250" y="300"/></Array></mxGeometry></mxCell>';
    const { arrow } = convert(lane + a + b + e);
    // draw.io: from A's bottom (1072.2, 1100) via (1250, 1300) to B's bottom (1427.8, 1100).
    expect(arrow.from).toMatchObject({ anchor: 'sse' });
    expect(arrow.to).toMatchObject({ anchor: 'ssw' });
    expect(absolute(arrow, { x: 1075, y: 1100 }, { x: 1425, y: 1100 })).toEqual([
      { x: 1250, y: 1300 },
    ]);
  });
});

describe('edge heads and stroke', () => {
  it('reads heads, fills and sizes', () => {
    const { arrow, notes } = convert(
      boxA + boxB + edge('endArrow=block;endFill=0;endSize=12;strokeWidth=3;dashed=1;'),
    );
    expect(arrow).toMatchObject({
      arrowheadShape: 'triangle-hollow',
      arrowheadSize: 'small',
      strokeWidth: 3,
      strokeStyle: 'dashed',
    });
    expect(arrow.arrowEnds).toBeUndefined();
    expect(notes).toEqual([]);
  });

  it('sizes a head to the length draw.io draws on its own stroke', () => {
    // draw.io draws size + stroke width; the canvas marker draws its preset times the stroke width.
    expect(convert(boxA + boxB + edge('')).arrow.arrowheadSize).toBeUndefined();
    expect(convert(boxA + boxB + edge('strokeWidth=5;')).arrow.arrowheadSize).toBe('small');
    expect(convert(boxA + boxB + edge('endSize=10;')).arrow.arrowheadSize).toBe('extra-large');
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

const labelChild = (id: string, value: string, geo: string, style = 'edgeLabel;html=1;') =>
  `<mxCell id="${id}" value="${value}" style="${style}" vertex="1" connectable="0" parent="e"><mxGeometry ${geo} relative="1" as="geometry"><mxPoint as="offset"/></mxGeometry></mxCell>`;
// draw.io's route here: (100, 25) east to (350, 25), down to (350, 200); 425 long.
const orthogonal = (value = '') =>
  edge('edgeStyle=orthogonalEdgeStyle;html=1;', '', `source="a" target="b" value="${value}"`);

describe('edge labels', () => {
  it('joins the edge value and label children, and counts the merge', () => {
    const { arrow, notes, page } = convert(
      boxA +
        boxB +
        orthogonal('main') +
        labelChild('l1', 'first', 'x="0.5"') +
        labelChild('l2', 'second', 'x="0"'),
    );
    expect(arrow.label).toBe('main\nfirst\nsecond');
    expect(notes).toEqual([{ kind: 'label-moved', count: 1 }]);
    expect(page.elements).toHaveLength(3);
  });

  it('places the caption where draw.io centres the label, along the line the arrow draws', () => {
    // draw.io: the middle of the route's length, rounded to the pixel: (313, 25).
    const { arrow } = convert(boxA + boxB + orthogonal('main'));
    expect(arrow.labelOffset!.t).toBeCloseTo(213 / 425, 6);
    expect(arrow.labelOffset!.offset).toBeCloseTo(0, 6);
  });

  it('places a label child off the middle and to one side, as its geometry says', () => {
    // x -0.5 is a quarter of the way along, (206, 25); y 10 lifts it 10 px to the left of travel.
    const { arrow } = convert(
      boxA + boxB + orthogonal() + labelChild('l1', 'Yes', 'x="-0.5" y="10"'),
    );
    expect(arrow.labelOffset!.t).toBeCloseTo(106 / 425, 6);
    expect(arrow.labelOffset!.offset).toBeCloseTo(-10, 6);
    const at = arrowLabelAnchor(
      'angled',
      { x: 100, y: 25 },
      { x: 350, y: 200 },
      arrow.from,
      arrow.to,
      undefined,
      undefined,
      arrow.labelOffset,
      arrow.curvePoints,
    );
    expect(at.x).toBeCloseTo(206, 6);
    expect(at.y).toBeCloseTo(15, 6);
  });

  it('keeps a caption on draw.io’s lines: its wrap width is its widest line', () => {
    const { arrow } = convert(boxA + boxB + orthogonal('Reads from&lt;br&gt;the shared store'));
    const px = arrowLabelFontSize(arrow.textSize);
    expect(arrow.labelMaxWidth).toBe(
      Math.ceil(labelTextWidth('the shared store'.length, px) * DRAWIO_CAPTION_WIDTH_SLACK),
    );
  });

  it('keeps the colour a label is set in whole', () => {
    const { arrow } = convert(
      boxA +
        boxB +
        orthogonal() +
        labelChild('l1', '&lt;font color=&quot;#d6b656&quot;&gt;Yes&lt;/font&gt;', 'x="0"'),
    );
    expect(arrow.textColor).toBe('#d6b656');
  });

  it('places a shape riding on an edge where draw.io puts it along the route', () => {
    const rider =
      '<mxCell id="r" value="R" style="ellipse;" vertex="1" parent="e"><mxGeometry x="0" y="0" width="20" height="20" relative="1" as="geometry"/></mxCell>';
    const { page } = convert(
      boxA +
        boxB +
        edge(
          'edgeStyle=orthogonalEdgeStyle;exitX=1;exitY=0.5;entryX=0.5;entryY=0;',
          '<Array as="points"><mxPoint x="200" y="100"/></Array>',
        ) +
        rider,
    );
    // draw.io draws the ellipse with its corner at the middle of the route's length, (200, 138).
    expect(page.elements.find((x) => 'label' in x && x.label === 'R')).toMatchObject({
      x: 200,
      y: 138,
    });
  });
});
