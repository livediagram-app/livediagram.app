// Product-neutral element builders for the shared element model's own tests: a shape at its kind's usual size, a
// text, a table, a sticky note, a pen stroke and arrows, each with a fresh id. The sizes are the products' defaults
// (a kind no product sizes gets a 120 x 80 box), so a test that moved here from a product reads the same boxes it read
// there. Tests only: nothing in a product or an app imports this.
import type {
  Anchor,
  ArrowElement,
  ElementId,
  FreehandElement,
  OtherBoxedElement,
  ShapeElement,
  TableElement,
  TextElement,
} from '../element';
import { packFreehandPoints } from '../freehand-points';

/** Each shape kind's usual size, as the products make it. */
export const SHAPE_DEFAULT_SIZE: Readonly<Record<string, { width: number; height: number }>> = {
  square: { width: 120, height: 120 },
  circle: { width: 120, height: 120 },
  diamond: { width: 120, height: 120 },
  cylinder: { width: 100, height: 140 },
  parallelogram: { width: 160, height: 100 },
  hexagon: { width: 140, height: 120 },
  document: { width: 140, height: 110 },
  page: { width: 420, height: 594 },
  'mind-node': { width: 250, height: 80 },
  lane: { width: 900, height: 200 },
  'reaction-pad': { width: 150, height: 110 },
  'comment-pin': { width: 300, height: 320 },
  'action-card': { width: 300, height: 300 },
  'done-check': { width: 280, height: 220 },
  entity: { width: 240, height: 170 },
  stadium: { width: 160, height: 64 },
  actor: { width: 90, height: 130 },
  'final-state': { width: 32, height: 32 },
  cloud: { width: 180, height: 140 },
  triangle: { width: 130, height: 120 },
  trapezoid: { width: 160, height: 110 },
  star: { width: 130, height: 130 },
  'speech-bubble': { width: 180, height: 130 },
  frame: { width: 360, height: 260 },
  browser: { width: 240, height: 160 },
  monitor: { width: 220, height: 170 },
  laptop: { width: 240, height: 150 },
  phone: { width: 90, height: 170 },
  tablet: { width: 140, height: 180 },
  foldable: { width: 190, height: 170 },
  smartwatch: { width: 110, height: 150 },
  icon: { width: 120, height: 120 },
  sticker: { width: 104, height: 104 },
  'progress-bar': { width: 220, height: 44 },
  'progress-ring': { width: 130, height: 130 },
  'timeline-rail': { width: 720, height: 240 },
  rating: { width: 200, height: 44 },
  'pie-chart': { width: 260, height: 220 },
  'bar-chart': { width: 260, height: 220 },
  'line-chart': { width: 300, height: 240 },
  'code-block': { width: 320, height: 180 },
  checklist: { width: 240, height: 180 },
  legend: { width: 180, height: 132 },
  sankey: { width: 560, height: 300 },
  'mode-button': { width: 104, height: 96 },
  'focus-button': { width: 120, height: 96 },
  portal: { width: 72, height: 112 },
  'session-button': { width: 104, height: 96 },
  reveal: { width: 320, height: 220 },
  picker: { width: 220, height: 132 },
  chair: { width: 76, height: 84 },
  fence: { width: 240, height: 24 },
  'avatar-pad': { width: 128, height: 80 },
  desk: { width: 120, height: 112 },
  sofa: { width: 152, height: 85 },
  room: { width: 480, height: 320 },
  'meeting-table': { width: 232, height: 168 },
  plant: { width: 56, height: 88 },
  bookshelf: { width: 120, height: 132 },
  'water-cooler': { width: 56, height: 112 },
  'coffee-machine': { width: 72, height: 96 },
  rug: { width: 200, height: 120 },
  estimate: { width: 360, height: 310 },
  quiz: { width: 520, height: 520 },
  temperature: { width: 320, height: 300 },
  'idea-box': { width: 340, height: 420 },
  'qa-board': { width: 360, height: 460 },
  agenda: { width: 330, height: 300 },
  decision: { width: 330, height: 220 },
  'roll-call': { width: 300, height: 260 },
  banner: { width: 440, height: 104 },
  callout: { width: 380, height: 116 },
  card: { width: 300, height: 150 },
  badge: { width: 40, height: 24 },
  step: { width: 28, height: 28 },
  'pointer-note': { width: 180, height: 64 },
  'diagram-key': { width: 260, height: 68 },
  stack: { width: 360, height: 160 },
  sequence: { width: 560, height: 340 },
  boundary: { width: 480, height: 300 },
  'layer-stack': { width: 360, height: 260 },
  pyramid: { width: 320, height: 260 },
  cycle: { width: 300, height: 300 },
  hub: { width: 340, height: 320 },
  onion: { width: 320, height: 320 },
  chevrons: { width: 600, height: 150 },
  'stat-row': { width: 482, height: 96 },
  process: { width: 420, height: 110 },
  'site-header': { width: 640, height: 84 },
};

const FALLBACK_SIZE = { width: 120, height: 80 };

let next = 0;
/** A fresh id, unique within a test run. */
export const testId = (): ElementId => `el-${++next}`;

export function createShape(kind: string, x: number, y: number): ShapeElement {
  const { width, height } = SHAPE_DEFAULT_SIZE[kind] ?? FALLBACK_SIZE;
  return { id: testId(), type: 'shape', shape: kind, x, y, width, height, textSize: 'md' };
}

export function createText(x: number, y: number): TextElement {
  return {
    id: testId(),
    type: 'text',
    x,
    y,
    width: 220,
    height: 64,
    label: 'Text',
    textSize: 'sm',
  };
}

export function createTable(x: number, y: number, rows = 3, cols = 3): TableElement {
  return {
    id: testId(),
    type: 'table',
    x,
    y,
    width: 360,
    height: 150,
    cells: Array.from({ length: rows }, () => Array.from({ length: cols }, () => '')),
    headerRow: true,
    textSize: 'md',
  };
}

export function createSticky(x: number, y: number): OtherBoxedElement {
  return { id: testId(), type: 'sticky', x, y, width: 200, height: 200, textSize: 'md' };
}

export function createFreehand(
  rawPoints: readonly { x: number; y: number }[],
  closed: boolean,
  pressures?: readonly number[],
): FreehandElement {
  return { id: testId(), type: 'freehand', ...packFreehandPoints(rawPoints, pressures), closed };
}

export function createArrow(fromX: number, fromY: number, toX: number, toY: number): ArrowElement {
  return {
    id: testId(),
    type: 'arrow',
    from: { kind: 'free', x: fromX, y: fromY },
    to: { kind: 'free', x: toX, y: toY },
  };
}

export function createPinnedArrow(
  fromId: ElementId,
  fromAnchor: Anchor,
  toId: ElementId,
  toAnchor: Anchor,
): ArrowElement {
  return {
    id: testId(),
    type: 'arrow',
    from: { kind: 'pinned', elementId: fromId, anchor: fromAnchor },
    to: { kind: 'pinned', elementId: toId, anchor: toAnchor },
  };
}

/** A shape's kind, as the shared model reads it: any string (each product holds a subset). */
export type ShapeKind = string;
/** A sticky note, one of the other boxed kinds. */
export type StickyElement = OtherBoxedElement & { type: 'sticky' };
