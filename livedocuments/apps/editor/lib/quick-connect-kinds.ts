// Which elements show the quick add + connect "+" buttons (docs/specs/008-canvas/canvas-and-palette.md "Quick add +
// connect"): the shapes (the palette's Shapes category) and the concept graphics, which are what a document chains
// one from another. Text, sticky notes, tables, images, charts, components, device frames and icons are placed,
// not chained, so they show none.
import { isConceptShape, type Element, type ShapeKind } from '@livedocuments/document';

// The palette's Shapes category: the basics, the flowchart vocabulary and more.
const QUICK_CONNECT_SHAPES: ReadonlySet<ShapeKind> = new Set<ShapeKind>([
  'square',
  'circle',
  'diamond',
  'cylinder',
  'parallelogram',
  'hexagon',
  'document',
  'stadium',
  'cloud',
  'triangle',
  'trapezoid',
  'star',
  'speech-bubble',
]);

export function takesQuickConnect(el: Element): boolean {
  return el.type === 'shape' && (QUICK_CONNECT_SHAPES.has(el.shape) || isConceptShape(el.shape));
}
