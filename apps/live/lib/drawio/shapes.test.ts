// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { readGraph } from './cells';
import { classifyVertex, shapeTurn } from './shapes';
import { model, vertex } from './test-support';

const classify = (style: string, value = '', children = '') => {
  const g = readGraph(
    model(vertex('v', style, 'width="100" height="60"', `parent="1" value="${value}"`) + children),
  );
  return classifyVertex(g.cells.get('v')!, g);
};
const child = (id: string, style: string) =>
  vertex(id, style, 'width="10" height="10"', 'parent="v"');

describe('classifyVertex', () => {
  it('maps the exact shapes', () => {
    expect(classify('rounded=0;whiteSpace=wrap;')).toEqual({
      kind: 'shape',
      shape: 'square',
      approximated: false,
    });
    expect(classify('ellipse;')).toMatchObject({ shape: 'circle', approximated: false });
    expect(classify('rhombus;')).toMatchObject({ shape: 'diamond' });
    expect(classify('shape=mxgraph.flowchart.terminator;')).toMatchObject({ shape: 'stadium' });
    expect(classify('shape=cylinder3;')).toMatchObject({ shape: 'cylinder' });
    expect(classify('ellipse;shape=cloud;')).toMatchObject({ shape: 'cloud' });
    expect(classify('shape=umlActor;')).toMatchObject({ shape: 'actor' });
    expect(classify('shape=callout;')).toMatchObject({ shape: 'speech-bubble' });
  });

  it('marks approximated shapes', () => {
    expect(classify('shape=process;')).toEqual({
      kind: 'shape',
      shape: 'square',
      approximated: true,
    });
    expect(classify('shape=step;')).toMatchObject({ shape: 'parallelogram', approximated: true });
    expect(classify('shape=umlLifeline;')).toMatchObject({ shape: 'square', approximated: true });
  });

  it('draws the flowchart or and summing function as approximated circles', () => {
    for (const name of ['or', 'summing_function']) {
      expect(classify(`shape=mxgraph.flowchart.${name};`)).toEqual({
        kind: 'shape',
        shape: 'circle',
        approximated: true,
      });
    }
  });

  it('recognises text, notes, lines, frames and images', () => {
    expect(classify('text;html=1;')).toEqual({ kind: 'text', approximated: false });
    expect(classify('edgeLabel;html=1;')).toEqual({ kind: 'text', approximated: false });
    expect(classify('shape=note;')).toEqual({ kind: 'sticky' });
    expect(classify('line;strokeWidth=1;')).toEqual({ kind: 'line' });
    expect(classify('shape=umlFrame;')).toEqual({ kind: 'frame', approximated: false });
    expect(classify('shape=image;image=data:image/png,AAA;')).toEqual({ kind: 'image' });
  });

  it('makes a text cell that draws its own box a square, as draw.io draws it', () => {
    const square = { kind: 'shape', shape: 'square', approximated: false };
    expect(classify('text;html=1;strokeColor=#23445d;fillColor=#bac8d3;rounded=1;')).toEqual(
      square,
    );
    expect(classify('text;html=1;strokeColor=none;fillColor=#FFFFCC;')).toEqual(square);
    expect(classify('text;html=1;strokeColor=#333333;')).toEqual(square);
    // Its own defaults (no stroke, no fill), or explicitly none: still a text.
    expect(classify('text;html=1;')).toEqual({ kind: 'text', approximated: false });
    expect(classify('text;strokeColor=none;fillColor=none;')).toEqual({
      kind: 'text',
      approximated: false,
    });
    // An edge label is always a label.
    expect(classify('edgeLabel;fillColor=#ffffff;')).toEqual({ kind: 'text', approximated: false });
  });

  it('matches vendor stencils to icons', () => {
    expect(classify('shape=mxgraph.aws4.resourceIcon;resIcon=mxgraph.aws4.lambda;')).toEqual({
      kind: 'icon',
      iconId: 'aws-lambda',
      tech: true,
    });
    expect(classify('shape=mxgraph.aws4.productIcon;prIcon=mxgraph.aws4.s3;')).toMatchObject({
      iconId: 'aws-s3',
    });
    expect(classify('shape=mxgraph.aws4.bucket;')).toMatchObject({ iconId: 'aws-s3' });
    expect(classify('shape=mxgraph.aws4.t3_instance;')).toMatchObject({ iconId: 'aws-ec2' });
    expect(classify('shape=mxgraph.aws4.rds_postgresql_instance;')).toMatchObject({
      iconId: 'aws-rds',
    });
    expect(
      classify('image;html=1;image=img/lib/azure2/compute/Virtual_Machine.svg;'),
    ).toMatchObject({ kind: 'icon', iconId: 'azure-vm', tech: true });
    expect(classify('shape=mxgraph.kubernetes.icon2;prIcon=pod')).toEqual({
      kind: 'icon',
      iconId: 'k8s',
      tech: true,
      caption: 'Pod',
    });
    expect(classify('shape=mxgraph.networks.web_server;')).toEqual({
      kind: 'icon',
      iconId: 'server',
      tech: false,
    });
  });

  it('makes AWS and GCP groups frames', () => {
    expect(classify('shape=mxgraph.aws4.group;grIcon=mxgraph.aws4.group_vpc2;')).toEqual({
      kind: 'frame',
      approximated: true,
    });
    expect(classify('shape=mxgraph.gcp2.project_zone_group;')).toMatchObject({ kind: 'frame' });
  });

  it('names what it cannot match', () => {
    expect(classify('shape=mxgraph.cisco.routers.router;')).toEqual({
      kind: 'unmatched',
      name: 'router',
    });
    expect(classify('shape=mxgraph.aws4.resourceIcon;resIcon=mxgraph.aws4.sagemaker;')).toEqual({
      kind: 'unmatched',
      name: 'sagemaker',
    });
    expect(classify('shape=stencil(eJzt);')).toEqual({ kind: 'unmatched', name: 'custom stencil' });
    expect(classify('shape=mxgraph.flowchart.collate;')).toEqual({
      kind: 'unmatched',
      name: 'collate',
    });
  });

  it('tells a group, a lane and an entity stack apart', () => {
    expect(classify('group', '', child('a', ''))).toEqual({ kind: 'group' });
    expect(classify('group', '')).toMatchObject({ kind: 'shape', shape: 'square' });
    expect(classify('swimlane;', 'Lane')).toEqual({ kind: 'lane' });
    expect(
      classify(
        'swimlane;childLayout=stackLayout;',
        'Order',
        child('r1', 'text;') + child('s', 'line;'),
      ),
    ).toEqual({ kind: 'entity' });
    expect(classify('swimlane;childLayout=stackLayout;', 'Pool', child('l1', 'swimlane;'))).toEqual(
      { kind: 'lane' },
    );
    expect(classify('shape=table;')).toEqual({ kind: 'table' });
  });
});

describe('shapeTurn', () => {
  const turn = (style: string, shape: Parameters<typeof shapeTurn>[1]) => {
    const g = readGraph(model(vertex('v', style, 'width="1" height="1"', 'parent="1"')));
    return shapeTurn(g.cells.get('v')!, shape);
  };

  it('turns a triangle to draw.io direction, east by default', () => {
    expect(turn('triangle;', 'triangle')).toEqual({
      rotation: 90,
      swap: true,
      approximated: false,
    });
    expect(turn('triangle;direction=north;', 'triangle')).toMatchObject({
      rotation: 0,
      swap: false,
    });
    expect(turn('triangle;direction=south;', 'triangle')).toMatchObject({ rotation: 180 });
    expect(turn('triangle;flipH=1;', 'triangle')).toMatchObject({ rotation: 270 });
  });

  it('counts a turned or flipped asymmetric shape as approximated', () => {
    expect(turn('shape=document;direction=south;', 'document').approximated).toBe(true);
    expect(turn('shape=parallelogram;flipH=1;', 'parallelogram').approximated).toBe(true);
    expect(turn('ellipse;direction=south;', 'circle').approximated).toBe(false);
    expect(turn('shape=document;', 'document').approximated).toBe(false);
  });
});

describe('classifyVertex, marks and braces', () => {
  it('maps the cross and the tick to their line-art icons', () => {
    expect(classify('shape=mxgraph.basic.x;fillColor=#ff0000;')).toMatchObject({
      kind: 'icon',
      iconId: 'x',
      tech: false,
    });
    expect(classify('shape=mxgraph.basic.tick;')).toMatchObject({ kind: 'icon', iconId: 'check' });
  });

  it('maps UML’s destroy cross to the cross icon', () => {
    expect(classify('shape=umlDestroy;strokeWidth=3;strokeColor=#FF1212;')).toMatchObject({
      kind: 'icon',
      iconId: 'x',
      tech: false,
    });
  });

  it('draws an end state as the circle it is', () => {
    expect(
      classify('ellipse;html=1;shape=endState;fillColor=#000000;strokeColor=#ff0000;'),
    ).toEqual({
      kind: 'shape',
      shape: 'circle',
      approximated: false,
    });
  });

  it('draws a curly bracket as a line down its spine', () => {
    expect(classify('shape=curlyBracket;whiteSpace=wrap;')).toEqual({ kind: 'line', spine: true });
  });

  it('matches the AWS data lake and MSK stencils to their Technology icons', () => {
    expect(classify('shape=mxgraph.aws4.data_lake_resource_icon;')).toMatchObject({
      iconId: 'aws-lake-formation',
      tech: true,
    });
    expect(
      classify('shape=mxgraph.aws4.resourceIcon;resIcon=mxgraph.aws4.managed_streaming_for_kafka;'),
    ).toMatchObject({ iconId: 'aws-msk', tech: true });
  });
});
