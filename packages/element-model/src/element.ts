// The shared element model (liveworkspace/docs/specs/002-architecture/architecture.md "The shared element model"):
// the element types every product's own union is assignable to, so one module can read the elements of any product.
//
// Structural, not a product's: each type names only the fields the shared modules read, each field typed as widely
// as the five products store it (a shape's kind is any string, an end may carry an entity `field`). A product's own
// `Element`, `BoxedElement`, `ShapeElement` and `ArrowElement` stay in its model package, exact, and are assignable to
// these. Functions that only read take these types; functions that hand elements back are generic
// (`<E extends Element>(el: E) => E`), so a caller keeps its product's precise type.

import type { ElementId, Padding, TextAlignX, TextAlignY, TextSize } from '@liveworkspace/model-core/basics';
import type { BorderStyle } from '@liveworkspace/model-core/border-style';
import type { ArrowheadShape, ArrowheadSize, ArrowStyle } from './arrow-style';

export type { ElementId };

/** The sixteen anchors on a box's connector outline, clockwise from the top. */
export type Anchor =
  | 'n'
  | 'nne'
  | 'ne'
  | 'ene'
  | 'e'
  | 'ese'
  | 'se'
  | 'sse'
  | 's'
  | 'ssw'
  | 'sw'
  | 'wsw'
  | 'w'
  | 'wnw'
  | 'nw'
  | 'nnw';

/** An arrow's end: free on the canvas, pinned to a box's anchor (an entity's field row, where one is named), or on another arrow's line. */
export type Endpoint =
  | { kind: 'free'; x: number; y: number }
  | { kind: 'pinned'; elementId: ElementId; anchor: Anchor; field?: number }
  | { kind: 'on-arrow'; arrowId: ElementId; t: number };

/** The kinds with a box other than those typed below, across every product (each holds a subset). */
export type OtherBoxedKind =
  'sticky' | 'image' | 'path' | 'table' | 'annotation' | 'link-card' | 'video' | 'article-note';

/** What every boxed element has: an id, a kind and a box on the canvas. */
export type BoxBase = {
  id: ElementId;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  label?: string;
  locked?: boolean;
  layerId?: string;
  textSize?: TextSize;
  textAlignX?: TextAlignX;
  textAlignY?: TextAlignY;
  padding?: Padding;
};

export type ShapeElement = BoxBase & {
  type: 'shape';
  shape: string;
  iconId?: string;
  /** An entity's fields (livediagram, liveplanner): only how many is read here. */
  entityFields?: readonly unknown[];
  tags?: string[];
  accentEdge?: 'left' | 'top' | 'bottom';
  accentEdgeColor?: string;
};

export type TextElement = BoxBase & { type: 'text' };

export type FreehandElement = BoxBase & { type: 'freehand'; packedPoints?: string };

/** How a path node's two handles move together. */
export type PathHandleMode = 'corner' | 'mirrored' | 'aligned';

export type OtherBoxedElement = BoxBase & { type: OtherBoxedKind };

export type BoxedElement = ShapeElement | TextElement | FreehandElement | OtherBoxedElement;

export type ArrowElement = {
  id: ElementId;
  type: 'arrow';
  from: Endpoint;
  to: Endpoint;
  label?: string;
  locked?: boolean;
  layerId?: string;
  arrowStyle?: ArrowStyle;
  strokeColor?: string;
  arrowheadColor?: string;
  opacity?: number;
  strokeWidth?: number;
  arrowheadSize?: ArrowheadSize;
  arrowheadShape?: ArrowheadShape;
  arrowheadStartShape?: ArrowheadShape;
  routeBehind?: boolean;
  exactStart?: boolean;
  exactEnd?: boolean;
  labelMaxWidth?: number;
  textSize?: TextSize;
  curveOffset?: { dx: number; dy: number };
  curvePoints?: { dx: number; dy: number }[];
  elbowOffset?: { dx: number; dy: number };
  labelOffset?: { t: number; offset: number };
  strokeStyle?: BorderStyle;
};

export type Element = BoxedElement | ArrowElement;

const BOXED_KINDS: ReadonlySet<string> = new Set<BoxedElement['type']>([
  'shape',
  'text',
  'freehand',
  'sticky',
  'image',
  'path',
  'table',
  'annotation',
  'link-card',
  'video',
  'article-note',
]);

/**
 * Whether an element has a box. Each product's own `isBoxed` lists its boxed kinds, a subset of these, and every
 * element of its union that is not an arrow is one of them, so the two agree on every element a product holds.
 */
export function isBoxed<E extends { type: string }>(el: E): el is Exclude<E, { type: 'arrow' }> {
  return BOXED_KINDS.has(el.type);
}
