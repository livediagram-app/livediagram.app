// Everything the checks read, prepared once a run (blueprint "Behaviour and state" step 1): the visible
// elements, an index over all of them, the views' refs, the boxes, containment, the arrows sorted into
// dangling and drawable with their routes, the element grid and the label pass.

import {
  arrowLabelPass,
  arrowPolyline,
  boundsOfPoints,
  buildElementGrid,
  buildElementIndex,
  computeRefs,
  deriveContainers,
  estimatedLabelMeasure,
  isBoxed,
  pinnedBoxedElement,
  visibleLayerElements,
  type ArrowElement,
  type ArrowLabelPass,
  type BoxedElement,
  type Element,
  type ElementGrid,
  type ElementId,
  type ElementIndex,
  type Endpoint,
  type Point,
  type Rect,
  type RefTable,
  type Tab,
} from '@livediagram/document';
import { boxBounds, isLintBox } from './boxes';
import { LINT_MEASURE_EPOCH } from './constants';

export type LintSource = 'tab' | 'graph';

export type DrawableArrow = {
  arrow: ArrowElement;
  polyline: Point[];
  bounds: Rect;
  // The boxes its ends are pinned to, when they are.
  from: BoxedElement | null;
  to: BoxedElement | null;
};

export type LintContext = {
  source: LintSource;
  theme: string | undefined;
  visible: Element[];
  index: ElementIndex;
  refs: RefTable;
  boxes: BoxedElement[];
  // Visible elements with a non-finite rect, checked by nothing (N6).
  skipped: number;
  // Each visible element's container: the smallest frame or lane holding its centre.
  containers: ReadonlyMap<ElementId, ElementId | null>;
  byId: ReadonlyMap<ElementId, Element>;
  // Paint order among visible elements.
  order: ReadonlyMap<ElementId, number>;
  dangling: ArrowElement[];
  drawable: DrawableArrow[];
  // Drawable arrows pinned at both ends to two different boxes.
  connecting: DrawableArrow[];
  // Boxes at the pinned end of a drawable arrow: the diagram's graph, which the error codes judge.
  connected: ReadonlySet<ElementId>;
  grid: ElementGrid;
  // Half the largest diagonal of any rotated box: grows every grid query (LN34).
  rotationPad: number;
  labels: ArrowLabelPass;
  flow: 'down' | 'right' | undefined;
};

// Why an arrow cannot be drawn: an end on a missing element (`arrow-dangling`). A line with both ends free
// is a drawing, not a broken arrow.
export function isDangling(arrow: ArrowElement, index: ElementIndex): boolean {
  const missing = (end: Endpoint) => {
    if (end.kind === 'pinned') {
      const el = index.get(end.elementId);
      return !el || !isBoxed(el);
    }
    if (end.kind === 'on-arrow') return index.get(end.arrowId)?.type !== 'arrow';
    return false;
  };
  return missing(arrow.from) || missing(arrow.to);
}

export function prepareLintContext(
  tab: Pick<Tab, 'elements' | 'layers' | 'theme'>,
  options: { source: LintSource; flow?: 'down' | 'right' },
): LintContext {
  const visible = visibleLayerElements(tab.elements, tab.layers);
  const index = buildElementIndex(tab.elements);
  const boxed = visible.filter(isBoxed);
  const boxes = visible.filter(isLintBox);
  const skipped = boxed.filter(
    (el) => ![el.x, el.y, el.width, el.height].every((v) => Number.isFinite(v)),
  ).length;
  const arrows = visible.filter((el): el is ArrowElement => el.type === 'arrow');
  const dangling = arrows.filter((arrow) => isDangling(arrow, index));
  const danglingIds = new Set(dangling.map((arrow) => arrow.id));
  const drawable = arrows
    .filter((arrow) => !danglingIds.has(arrow.id))
    .map((arrow): DrawableArrow => {
      const polyline = arrowPolyline(arrow, index);
      return {
        arrow,
        polyline,
        bounds: boundsOfPoints(polyline)!,
        from: pinnedBoxedElement(arrow.from, index),
        to: pinnedBoxedElement(arrow.to, index),
      };
    });
  const boxIds = new Set(boxes.map((b) => b.id));
  const connecting = drawable.filter(
    (d) => d.from && d.to && d.from.id !== d.to.id && boxIds.has(d.from.id) && boxIds.has(d.to.id),
  );
  const rotationPad = Math.max(
    0,
    ...boxes
      .filter((b) => b.rotation)
      .map((b) => {
        const r = boxBounds(b);
        return Math.hypot(r.width, r.height) / 2;
      }),
  );
  return {
    source: options.source,
    theme: tab.theme,
    visible,
    index,
    refs: computeRefs(tab.elements.map((el) => el.id)),
    boxes,
    skipped,
    containers: deriveContainers(visible),
    byId: new Map(visible.map((el) => [el.id, el])),
    order: new Map(visible.map((el, i) => [el.id, i])),
    dangling,
    drawable,
    connecting,
    connected: new Set(
      drawable
        .flatMap((d) => [d.from?.id, d.to?.id])
        .filter((id): id is ElementId => id !== undefined),
    ),
    grid: buildElementGrid(boxes),
    rotationPad,
    labels: arrowLabelPass(visible, {
      measureFor: (px) => estimatedLabelMeasure(px),
      fontEpoch: LINT_MEASURE_EPOCH,
    }),
    flow: options.flow,
  };
}

// A grid query rect grown by the rotation pad.
export function padded(ctx: LintContext, rect: Rect): Rect {
  const pad = ctx.rotationPad;
  return {
    x: rect.x - pad,
    y: rect.y - pad,
    width: rect.width + 2 * pad,
    height: rect.height + 2 * pad,
  };
}

// The ref the views print for an element.
export const refOf = (ctx: LintContext, id: ElementId) => ctx.refs.refOf(id);
