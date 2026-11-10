// The shared element model (liveworkspace/docs/specs/002-architecture/architecture.md "The shared element model"):
// the element types every product's own union is assignable to, so one module can read the elements of any product.
//
// Structural, not a product's: each type names only the fields the shared modules read, each field typed as widely
// as the five products store it (a shape's kind is any string, an end may carry an entity `field`). A product's own
// `Element`, `BoxedElement`, `ShapeElement` and `ArrowElement` stay in its model package, exact, and are assignable to
// these. Functions that only read take these types; functions that hand elements back are generic
// (`<E extends Element>(el: E) => E`), so a caller keeps its product's precise type.

import type {
  ElementId,
  Padding,
  TextAlignX,
  TextAlignY,
  TextSize,
} from '@liveworkspace/model-core/basics';
import type { TextRun } from '@liveworkspace/model-core/rich-text';
import type { BorderRadius, BorderStroke, BorderStyle } from '@liveworkspace/model-core/border-style';
import type { ArrowheadShape, ArrowheadSize, ArrowStyle } from './arrow-style';
import type { BoundaryStyle } from './boundary';
import type { CardMedia } from './card';
import type { ChipLook } from './chip';
import type { ConceptAnim, ConceptRow, PyramidVariant } from './concept';
import type { KeyRow } from './diagram-key';
import type { Finish } from './finish';
import type { MindLook } from './person-node';
import type { HeroCaption, StatItem } from './web-components';

export type { ElementId, TextSize };

/** Which ends of an arrow carry a head. */
export type ArrowEnds = 'from' | 'to' | 'both' | 'none';

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
  'sticky' | 'path' | 'table' | 'annotation' | 'link-card' | 'video' | 'article-note';

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
  // Its look, where a product's kind stores one.
  fillColor?: string;
  strokeColor?: string;
  textColor?: string;
  font?: string;
  strokeWidth?: BorderStroke;
  strokeStyle?: BorderStyle;
  borderRadius?: BorderRadius;
  finish?: Finish;
  headerFill?: string;
  textBold?: boolean;
  textItalic?: boolean;
  richText?: TextRun[];
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
  /** A page's title and subtitle (livediagram, livedesign, liveplanner). */
  pageTitle?: string;
  pageSubtitle?: string;
  // The web components' own fields (web-components.ts and the kinds it lays out), where a product holds the kind.
  cardMedia?: CardMedia;
  cardHeader?: boolean;
  conceptRows?: ConceptRow[];
  conceptAnim?: ConceptAnim;
  conceptAnimRepeat?: boolean;
  pyramidVariant?: PyramidVariant;
  hubSpokes?: boolean;
  keyRows?: KeyRow[];
  keyMeanings?: Record<string, string>;
  boundaryStyle?: BoundaryStyle;
  mindLook?: MindLook;
  stats?: StatItem[];
  processSteps?: string[];
  navLinks?: string[];
  chipLook?: ChipLook;
  stepSequence?: boolean;
  /** A mind node's parent (livediagram, liveplanner). */
  mindParentId?: ElementId;
};

export type TextElement = BoxBase & { type: 'text' };

export type FreehandElement = BoxBase & {
  type: 'freehand';
  packedPoints?: string;
  closed?: boolean;
  pen?: 'highlighter';
  penWidth?: number;
  streamline?: number;
  straightEdges?: boolean;
};

/** A freehand stroke as the products that draw one store it (livehuddle keeps only a placeholder): its packed
 *  points and whether it closes. */
export type StrokeElement = FreehandElement & { packedPoints: string; closed: boolean };

/** Whether a freehand carries its stroke (true for every product's freehand but livehuddle's placeholder). */
export function isStroke(el: FreehandElement): el is StrokeElement {
  return typeof el.packedPoints === 'string';
}

/** How a path node's two handles move together. */
export type PathHandleMode = 'corner' | 'mirrored' | 'aligned';

/** A point in a path's box, normalised (0..1 across its width and height). */
export type PathPoint = { nx: number; ny: number };

/** An anchor point and its optional handles, stored as absolute normalised positions so a resize scales the whole
 *  path, handles included. */
export type PathNode = PathPoint & {
  mode: PathHandleMode;
  handleIn?: PathPoint;
  handleOut?: PathPoint;
};

/** A Path-tool curve (livediagram, livedesign): nodes joined by cubic Beziers, open or closed, and a combined
 *  shape's further contours. Not in `Element`: a product without the Path tool stores `path` as a placeholder. */
export type PathElement = BoxBase & {
  type: 'path';
  nodes: PathNode[];
  closed: boolean;
  subpaths?: PathNode[][];
};

/** Whether a `path` is a Path-tool curve (true wherever the Path tool exists; a product without it never stores
 *  one). */
export function isDrawnPath(el: { type: string }): el is PathElement {
  return el.type === 'path' && Array.isArray((el as { nodes?: unknown }).nodes);
}

export type OtherBoxedElement = BoxBase & { type: OtherBoxedKind };

export type ImageElement = BoxBase & { type: 'image'; heroCaption?: HeroCaption };

export type BoxedElement =
  ShapeElement | TextElement | FreehandElement | ImageElement | OtherBoxedElement;

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
  arrowEnds?: ArrowEnds;
  textBold?: boolean;
  textItalic?: boolean;
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
