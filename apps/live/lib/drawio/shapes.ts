// What a draw.io vertex becomes (docs/specs/020-import-export/drawio-import.md
// "Vertices: shapes", blueprint step 9). One table of named shapes, the
// stencil lookups, and the container kinds; everything else is unmatched and
// becomes a labelled box.

import type { ShapeKind } from '@livediagram/document';
import type { DrawioCell, DrawioGraph } from './cells';
import { shapeName } from './style';
import { azureImageIcon, readableStencilName, stencilIcon, type IconMatch } from './stencils';

export type VertexClass =
  | { kind: 'shape'; shape: ShapeKind; approximated: boolean }
  | { kind: 'text'; approximated: boolean }
  | { kind: 'sticky' }
  | { kind: 'line' }
  | { kind: 'lane' }
  | { kind: 'entity' }
  | { kind: 'table' }
  | { kind: 'image' }
  | ({ kind: 'icon' } & IconMatch)
  | { kind: 'frame'; approximated: boolean }
  | { kind: 'group' }
  | { kind: 'unmatched'; name: string };

type Row = { shape: ShapeKind; approximated?: true };
const exact = (shape: ShapeKind): Row => ({ shape });
const near = (shape: ShapeKind): Row => ({ shape, approximated: true });
const f = (name: string) => `mxgraph.flowchart.${name}`;

const SHAPES: Record<string, Row> = {
  '': exact('square'),
  rect: exact('square'),
  label: exact('square'),
  [f('process')]: exact('square'),
  'mxgraph.basic.rect': exact('square'),
  ellipse: exact('circle'),
  [f('start_1')]: exact('circle'),
  [f('start_2')]: exact('circle'),
  [f('on-page_reference')]: exact('circle'),
  startState: exact('circle'),
  rhombus: exact('diamond'),
  [f('decision')]: exact('diamond'),
  triangle: exact('triangle'),
  hexagon: exact('hexagon'),
  [f('preparation')]: exact('hexagon'),
  [f('hexagon')]: exact('hexagon'),
  cylinder: exact('cylinder'),
  cylinder2: exact('cylinder'),
  cylinder3: exact('cylinder'),
  datastore: exact('cylinder'),
  [f('database')]: exact('cylinder'),
  cloud: exact('cloud'),
  'mxgraph.networks.cloud': exact('cloud'),
  parallelogram: exact('parallelogram'),
  [f('data')]: exact('parallelogram'),
  trapezoid: exact('trapezoid'),
  document: exact('document'),
  [f('document')]: exact('document'),
  [f('document2')]: exact('document'),
  actor: exact('actor'),
  umlActor: exact('actor'),
  [f('terminator')]: exact('stadium'),
  'mxgraph.basic.star': exact('star'),
  callout: exact('speech-bubble'),
  wedgeCallout: exact('speech-bubble'),
  'mxgraph.android.phone2': exact('phone'),
  'mxgraph.ios7.misc.iphone': exact('phone'),
  'mxgraph.mockup.containers.browserWindow': exact('browser'),
  // Approximated: a draw.io shape livediagram draws differently.
  doubleEllipse: near('circle'),
  orEllipse: near('circle'),
  sumEllipse: near('circle'),
  or: near('circle'),
  xor: near('circle'),
  endState: near('circle'),
  lineEllipse: near('circle'),
  umlBoundary: near('circle'),
  umlEntity: near('circle'),
  umlControl: near('circle'),
  'mxgraph.bpmn.event': near('circle'),
  [f('or_2')]: near('circle'),
  [f('summing_junction')]: near('circle'),
  process: near('square'),
  internalStorage: near('square'),
  card: near('square'),
  cube: near('square'),
  folder: near('square'),
  component: near('square'),
  module: near('square'),
  offPageConnector: near('square'),
  umlLifeline: near('square'),
  partialRectangle: near('square'),
  singleArrow: near('square'),
  doubleArrow: near('square'),
  [f('predefined_process')]: near('square'),
  [f('off-page_reference')]: near('square'),
  [f('card')]: near('square'),
  'mxgraph.bpmn.task': near('square'),
  'mxgraph.bpmn.task2': near('square'),
  'mxgraph.bpmn.shape': near('square'),
  delay: near('stadium'),
  display: near('stadium'),
  [f('delay')]: near('stadium'),
  [f('display')]: near('stadium'),
  step: near('parallelogram'),
  manualInput: near('trapezoid'),
  loopLimit: near('trapezoid'),
  [f('manual_input')]: near('trapezoid'),
  [f('loop_limit')]: near('trapezoid'),
  [f('manual_operation')]: near('trapezoid'),
  tape: near('document'),
  [f('paper_tape')]: near('document'),
  [f('multi-document')]: near('document'),
  dataStorage: near('cylinder'),
  [f('stored_data')]: near('cylinder'),
  [f('direct_data')]: near('cylinder'),
  [f('sequential_data')]: near('cylinder'),
  'mxgraph.bpmn.gateway2': near('diamond'),
  [f('sort')]: near('diamond'),
  [f('merge_or_storage')]: near('triangle'),
  [f('extract_or_measurement')]: near('triangle'),
};

// A class / entity box: a stack of text rows and separator lines, nothing nested.
function isEntityStack(cell: DrawioCell, graph: DrawioGraph): boolean {
  if (cell.style.str('childLayout') !== 'stackLayout' || cell.children.length === 0) return false;
  return cell.children.every((id) => {
    const child = graph.cells.get(id);
    if (!child?.vertex || child.children.length > 0) return false;
    const name = shapeName(child.style);
    return name === 'line' || (name === '' && child.style.has('text'));
  });
}

const isGcpGroup = (name: string) =>
  name.startsWith('mxgraph.gcp2.') && /(group|container)$/i.test(name);

export function classifyVertex(cell: DrawioCell, graph: DrawioGraph): VertexClass {
  const style = cell.style;
  const name = shapeName(style);
  if (name === 'swimlane')
    return isEntityStack(cell, graph) ? { kind: 'entity' } : { kind: 'lane' };
  if (name === 'table') return { kind: 'table' };
  if (name === 'image') {
    const azure = azureImageIcon(style.str('image') ?? '');
    return azure ? { kind: 'icon', ...azure } : { kind: 'image' };
  }
  const icon = stencilIcon(name, { resIcon: style.str('resIcon'), prIcon: style.str('prIcon') });
  if (icon) return { kind: 'icon', ...icon };
  if (name === 'mxgraph.aws4.group' || name === 'mxgraph.aws4.groupCenter' || isGcpGroup(name)) {
    return { kind: 'frame', approximated: true };
  }
  if (name === '' && style.has('group') && cell.value.trim() === '' && cell.children.length > 0) {
    return { kind: 'group' };
  }
  if (name === '' && (style.has('text') || style.has('edgeLabel'))) {
    return { kind: 'text', approximated: false };
  }
  if (name === f('annotation_1') || name === f('annotation_2')) {
    return { kind: 'text', approximated: true };
  }
  if (name === 'note') return { kind: 'sticky' };
  if (name === 'line') return { kind: 'line' };
  if (name === 'umlFrame') return { kind: 'frame', approximated: false };
  const row = SHAPES[name];
  if (row) return { kind: 'shape', shape: row.shape, approximated: row.approximated === true };
  const inner =
    name === 'mxgraph.aws4.resourceIcon'
      ? style.str('resIcon')
      : name === 'mxgraph.aws4.productIcon'
        ? style.str('prIcon')
        : undefined;
  return { kind: 'unmatched', name: readableStencilName(inner ?? name) };
}

// Kinds that look the same turned or mirrored, so a `direction` or flip on
// them loses nothing.
const SYMMETRIC = new Set<ShapeKind>([
  'square',
  'circle',
  'diamond',
  'hexagon',
  'cylinder',
  'cloud',
  'stadium',
  'star',
]);

const TRIANGLE_TURN: Record<string, number> = { east: 90, south: 180, west: 270, north: 0 };

// A flip across the pointing axis turns a triangle round.
const FLIP: Record<string, string> = { east: 'west', west: 'east', north: 'south', south: 'north' };

export type ShapeTurn = { rotation: number; swap: boolean; approximated: boolean };

/** How a shape's draw.io `direction` / flips carry over (blueprint step 9). */
export function shapeTurn(cell: DrawioCell, shape: ShapeKind): ShapeTurn {
  const direction = cell.style.str('direction') ?? 'east';
  if (shape === 'triangle') {
    const flipped = FLIP[direction];
    const axisFlip = direction === 'east' || direction === 'west' ? 'flipH' : 'flipV';
    const pointing = flipped && cell.style.flag(axisFlip) ? flipped : direction;
    const rotation = TRIANGLE_TURN[pointing] ?? 90;
    return { rotation, swap: rotation % 180 !== 0, approximated: false };
  }
  const turned = direction !== 'east' || cell.style.flag('flipH') || cell.style.flag('flipV');
  return { rotation: 0, swap: false, approximated: turned && !SYMMETRIC.has(shape) };
}
