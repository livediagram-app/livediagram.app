// Shared domain types for diagrams. Consumed by the live app's canvas today,
// and (later) by the persistence store, API workers, and any other code that
// handles diagram data. See specs/05-diagram-structure.md and
// specs/09-canvas-and-command-palette.md.

export type DiagramId = string;
export type TabId = string;
export type ElementId = string;

// --- Shared boxed-element fields ------------------------------------------

export type TextSize = 'scale' | 'sm' | 'md' | 'lg';

export type TextAlignX = 'left' | 'center' | 'right';
export type TextAlignY = 'top' | 'middle' | 'bottom';

export type BackgroundPattern = 'grid' | 'blank' | 'lines';

export function defaultTextColor(element: BoxedElement): string {
  switch (element.type) {
    case 'shape':
      return '#075985'; // brand-800
    case 'sticky':
      return '#451a03'; // amber-950-ish
    case 'text':
      return '#1e293b'; // slate-800
  }
}

export function defaultTextAlign(element: BoxedElement): { x: TextAlignX; y: TextAlignY } {
  if (element.type === 'sticky') return { x: 'left', y: 'top' };
  return { x: 'center', y: 'middle' };
}

// Default fill / stroke colours per boxed element type. Used when the element
// doesn't override them with explicit `fillColor` / `strokeColor` fields.
// Hex strings so they can also seed the colour picker UI.
export function defaultFillColor(element: BoxedElement): string {
  switch (element.type) {
    case 'shape':
      return '#f0f9ff'; // brand-50
    case 'sticky':
      return '#fef3c7'; // amber-100
    case 'text':
      return 'transparent';
  }
}

export function defaultStrokeColor(element: BoxedElement): string {
  switch (element.type) {
    case 'shape':
      return '#0ea5e9'; // brand-500
    case 'sticky':
      return '#fde68a'; // amber-200
    case 'text':
      return 'transparent';
  }
}

export function supportsColours(element: Element): boolean {
  return element.type === 'shape' || element.type === 'sticky';
}

// --- Shapes ---------------------------------------------------------------

export type ShapeKind = 'square' | 'circle' | 'diamond';

export type ShapeElement = {
  id: ElementId;
  type: 'shape';
  shape: ShapeKind;
  x: number;
  y: number;
  width: number;
  height: number;
  label?: string;
  locked?: boolean;
  groupId?: ElementId;
  textSize?: TextSize;
  textAlignX?: TextAlignX;
  textAlignY?: TextAlignY;
  fillColor?: string;
  strokeColor?: string;
  textColor?: string;
  aspectLocked?: boolean;
};

// --- Text ------------------------------------------------------------------

export type TextElement = {
  id: ElementId;
  type: 'text';
  x: number;
  y: number;
  width: number;
  height: number;
  label?: string;
  locked?: boolean;
  groupId?: ElementId;
  textSize?: TextSize;
  textAlignX?: TextAlignX;
  textAlignY?: TextAlignY;
  fillColor?: string;
  strokeColor?: string;
  textColor?: string;
  aspectLocked?: boolean;
};

// --- Sticky notes ----------------------------------------------------------

export type StickyElement = {
  id: ElementId;
  type: 'sticky';
  x: number;
  y: number;
  width: number;
  height: number;
  label?: string;
  locked?: boolean;
  groupId?: ElementId;
  textSize?: TextSize;
  textAlignX?: TextAlignX;
  textAlignY?: TextAlignY;
  fillColor?: string;
  strokeColor?: string;
  textColor?: string;
  aspectLocked?: boolean;
};

// --- Arrows ----------------------------------------------------------------

export type Anchor = 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'nw';

export const ALL_ANCHORS: Anchor[] = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'];

export type Endpoint =
  | { kind: 'free'; x: number; y: number }
  | { kind: 'pinned'; elementId: ElementId; anchor: Anchor };

export type ArrowElement = {
  id: ElementId;
  type: 'arrow';
  from: Endpoint;
  to: Endpoint;
  locked?: boolean;
};

// --- Element union ---------------------------------------------------------

export type BoxedElement = ShapeElement | TextElement | StickyElement;
export type Element = BoxedElement | ArrowElement;

export type Tab = {
  id: TabId;
  name: string;
  elements: Element[];
  backgroundPattern?: BackgroundPattern;
};

export type Diagram = {
  id: DiagramId;
  name: string;
  tabs: Tab[];
  createdAt: string;
  updatedAt: string;
};

// --- Type guards -----------------------------------------------------------

export function isBoxed(element: Element): element is BoxedElement {
  return element.type === 'shape' || element.type === 'text' || element.type === 'sticky';
}

// --- Factories -------------------------------------------------------------

// New boxed elements default to Medium text size per spec 09 ("Text size").
export function createShape(kind: ShapeKind, x: number, y: number): ShapeElement {
  return {
    id: crypto.randomUUID(),
    type: 'shape',
    shape: kind,
    x,
    y,
    width: 80,
    height: 80,
    textSize: 'md',
  };
}

export function createText(x: number, y: number): TextElement {
  return {
    id: crypto.randomUUID(),
    type: 'text',
    x,
    y,
    width: 160,
    height: 48,
    label: 'Text',
    textSize: 'md',
  };
}

export function createSticky(x: number, y: number): StickyElement {
  return {
    id: crypto.randomUUID(),
    type: 'sticky',
    x,
    y,
    width: 160,
    height: 160,
    textSize: 'md',
  };
}

export function createArrow(fromX: number, fromY: number, toX: number, toY: number): ArrowElement {
  return {
    id: crypto.randomUUID(),
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
    id: crypto.randomUUID(),
    type: 'arrow',
    from: { kind: 'pinned', elementId: fromId, anchor: fromAnchor },
    to: { kind: 'pinned', elementId: toId, anchor: toAnchor },
  };
}

// Duplicate a boxed element with a new id and a position offset.
export function duplicateBoxed<T extends BoxedElement>(element: T, dx: number, dy: number): T {
  return { ...element, id: crypto.randomUUID(), x: element.x + dx, y: element.y + dy };
}

// Duplicate every element whose id is in `ids`:
// - Boxed elements get fresh ids and a position offset of (dx, dy).
// - Arrows whose both endpoints are pinned to ids inside the set get fresh
//   ids with endpoints remapped to the duplicates.
// - If more than one boxed element is duplicated, the copies share a new
//   `groupId` so they form a sibling group.
//
// Returns the new elements plus a map of old → new ids so callers can wire
// extra arrows (e.g. a connector from the original to the duplicate).
export function duplicateGroupedElements(
  elements: Element[],
  ids: Set<ElementId>,
  dx: number,
  dy: number,
): { newElements: Element[]; idMap: Map<ElementId, ElementId> } {
  const idMap = new Map<ElementId, ElementId>();
  const newBoxed: BoxedElement[] = [];

  for (const el of elements) {
    if (!ids.has(el.id) || !isBoxed(el)) continue;
    const newId = crypto.randomUUID();
    idMap.set(el.id, newId);
    newBoxed.push({ ...el, id: newId, x: el.x + dx, y: el.y + dy });
  }

  const sharedGroupId = newBoxed.length > 1 ? crypto.randomUUID() : undefined;
  const finalBoxed: Element[] = newBoxed.map((el) =>
    sharedGroupId ? { ...el, groupId: sharedGroupId } : el,
  );

  const newArrows: ArrowElement[] = [];
  for (const el of elements) {
    if (el.type !== 'arrow') continue;
    if (el.from.kind !== 'pinned' || el.to.kind !== 'pinned') continue;
    const newFromId = idMap.get(el.from.elementId);
    const newToId = idMap.get(el.to.elementId);
    if (!newFromId || !newToId) continue;
    newArrows.push({
      id: crypto.randomUUID(),
      type: 'arrow',
      from: { kind: 'pinned', elementId: newFromId, anchor: el.from.anchor },
      to: { kind: 'pinned', elementId: newToId, anchor: el.to.anchor },
      ...(el.locked === true ? { locked: true } : {}),
    });
  }

  return { newElements: [...finalBoxed, ...newArrows], idMap };
}

// --- Geometry helpers ------------------------------------------------------

export type Point = { x: number; y: number };

// Works on any boxed element since they share x/y/width/height.
export function anchorPosition(element: BoxedElement, anchor: Anchor): Point {
  const { x, y, width, height } = element;
  switch (anchor) {
    case 'nw': return { x, y };
    case 'n':  return { x: x + width / 2, y };
    case 'ne': return { x: x + width, y };
    case 'e':  return { x: x + width, y: y + height / 2 };
    case 'se': return { x: x + width, y: y + height };
    case 's':  return { x: x + width / 2, y: y + height };
    case 'sw': return { x, y: y + height };
    case 'w':  return { x, y: y + height / 2 };
  }
}

export function endpointPosition(endpoint: Endpoint, elements: Element[]): Point {
  if (endpoint.kind === 'free') return { x: endpoint.x, y: endpoint.y };
  const target = elements.find((el) => el.id === endpoint.elementId);
  if (!target || !isBoxed(target)) return { x: 0, y: 0 };
  return anchorPosition(target, endpoint.anchor);
}

export function elementBounds(element: Element, elements: Element[]): { x: number; y: number; width: number; height: number } {
  if (isBoxed(element)) {
    return { x: element.x, y: element.y, width: element.width, height: element.height };
  }
  const from = endpointPosition(element.from, elements);
  const to = endpointPosition(element.to, elements);
  return {
    x: Math.min(from.x, to.x),
    y: Math.min(from.y, to.y),
    width: Math.abs(to.x - from.x),
    height: Math.abs(to.y - from.y),
  };
}

// Nearest boxed-element anchor to a canvas point. Returns the pinning
// reference if one is within `threshold` pixels; otherwise null.
export function snapToAnchor(
  point: Point,
  elements: Element[],
  threshold: number,
): { elementId: ElementId; anchor: Anchor } | null {
  let best: { elementId: ElementId; anchor: Anchor; dist: number } | null = null;
  for (const el of elements) {
    if (!isBoxed(el)) continue;
    for (const anchor of ALL_ANCHORS) {
      const pos = anchorPosition(el, anchor);
      const dist = Math.hypot(pos.x - point.x, pos.y - point.y);
      if (dist <= threshold && (best === null || dist < best.dist)) {
        best = { elementId: el.id, anchor, dist };
      }
    }
  }
  if (!best) return null;
  return { elementId: best.elementId, anchor: best.anchor };
}

// --- Layer order -----------------------------------------------------------

export function bringToFront(elements: Element[], id: ElementId): Element[] {
  const el = elements.find((e) => e.id === id);
  if (!el) return elements;
  return [...elements.filter((e) => e.id !== id), el];
}

export function sendToBack(elements: Element[], id: ElementId): Element[] {
  const el = elements.find((e) => e.id === id);
  if (!el) return elements;
  return [el, ...elements.filter((e) => e.id !== id)];
}

export function bringManyToFront(elements: Element[], ids: Set<ElementId>): Element[] {
  const members = elements.filter((e) => ids.has(e.id));
  const others = elements.filter((e) => !ids.has(e.id));
  return [...others, ...members];
}

export function sendManyToBack(elements: Element[], ids: Set<ElementId>): Element[] {
  const members = elements.filter((e) => ids.has(e.id));
  const others = elements.filter((e) => !ids.has(e.id));
  return [...members, ...others];
}

// --- Groups ----------------------------------------------------------------

// All element ids that should be treated as one selection when `id` is clicked:
// the element itself, plus any other boxed element with the same groupId.
export function selectionMembers(elements: Element[], id: ElementId): ElementId[] {
  const target = elements.find((el) => el.id === id);
  if (!target) return [];
  if (!isBoxed(target) || !target.groupId) return [target.id];
  const gid = target.groupId;
  return elements.filter((el) => isBoxed(el) && el.groupId === gid).map((el) => el.id);
}

// Union bounding box of multiple boxed elements. Returns null if no boxed
// elements were found.
export function unionBoxedBounds(
  elements: Element[],
  ids: Set<ElementId>,
): { x: number; y: number; width: number; height: number } | null {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  let found = false;
  for (const el of elements) {
    if (!ids.has(el.id) || !isBoxed(el)) continue;
    found = true;
    if (el.x < minX) minX = el.x;
    if (el.y < minY) minY = el.y;
    if (el.x + el.width > maxX) maxX = el.x + el.width;
    if (el.y + el.height > maxY) maxY = el.y + el.height;
  }
  if (!found) return null;
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

// Merge the groups containing `sourceId` and `targetId` into one fresh group.
// Returns elements unchanged if either id is missing, non-boxed, or they're
// already in the same group.
export function joinGroups(
  elements: Element[],
  sourceId: ElementId,
  targetId: ElementId,
): Element[] {
  if (sourceId === targetId) return elements;
  const source = elements.find((el) => el.id === sourceId);
  const target = elements.find((el) => el.id === targetId);
  if (!source || !target || !isBoxed(source) || !isBoxed(target)) return elements;
  if (source.groupId && source.groupId === target.groupId) return elements;
  // Prefer source's existing group id when extending an existing group so we
  // don't churn ids on every "Click another element to group it".
  const newGroupId = source.groupId ?? target.groupId ?? crypto.randomUUID();
  return elements.map((el) => {
    if (!isBoxed(el)) return el;
    const isSource = el.id === source.id;
    const isTarget = el.id === target.id;
    const inSourceGroup = source.groupId !== undefined && el.groupId === source.groupId;
    const inTargetGroup = target.groupId !== undefined && el.groupId === target.groupId;
    if (isSource || isTarget || inSourceGroup || inTargetGroup) {
      return { ...el, groupId: newGroupId };
    }
    return el;
  });
}

export function ungroup(elements: Element[], groupId: ElementId): Element[] {
  return elements.map((el) => {
    if (!isBoxed(el) || el.groupId !== groupId) return el;
    const { groupId: _drop, ...rest } = el;
    return rest as typeof el;
  });
}
