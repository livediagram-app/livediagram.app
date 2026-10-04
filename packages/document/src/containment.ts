// Derived containment and the content origin (docs/specs/024-agents/document-views.md "The outline"):
// the one rule views, edit-operation membership reports and the lint read. The editor's frame drag keeps
// its own full-box rule (`withFrameContents`).
import type { Element, ElementId } from './index';
import type { Point } from './geometry-primitives';
import { isMindNode } from './mind-map';

export type Box = { x: number; y: number; width: number; height: number };

export function boxCentre(box: Box): Point {
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

// Edges inclusive.
export function boxHoldsPoint(box: Box, point: Point): boolean {
  return (
    point.x >= box.x &&
    point.x <= box.x + box.width &&
    point.y >= box.y &&
    point.y <= box.y + box.height
  );
}

const areaOf = (box: Box) => box.width * box.height;

// The smallest box holding the point; the earlier in `holders` on an equal area.
export function smallestHolder<T extends Box>(point: Point, holders: readonly T[]): T | null {
  let best: T | null = null;
  for (const holder of holders) {
    if (boxHoldsPoint(holder, point) && (best === null || areaOf(holder) < areaOf(best)))
      best = holder;
  }
  return best;
}

type Boxed = Element & Box;

const GEOMETRY_KEYS = ['x', 'y', 'width', 'height'] as const;

function hasGeometry(el: Element): el is Boxed {
  return GEOMETRY_KEYS.every((key) => {
    const value: unknown = Reflect.get(el, key);
    return typeof value === 'number' && Number.isFinite(value);
  });
}

const isContainerShape = (el: Boxed) =>
  el.type === 'shape' && (el.shape === 'frame' || el.shape === 'lane');

// Each mind node's parent link, with links to anything but a mind node in `elements` dropped and every
// loop broken at its node with the lowest array index.
function mindParents(elements: readonly Element[]): Map<ElementId, ElementId> {
  const index = new Map<ElementId, number>();
  elements.forEach((el, i) => {
    if (isMindNode(el) && !index.has(el.id)) index.set(el.id, i);
  });
  const links = new Map<ElementId, ElementId>();
  for (const el of elements) {
    if (isMindNode(el) && el.mindParentId && index.has(el.mindParentId)) {
      links.set(el.id, el.mindParentId);
    }
  }
  const settled = new Set<ElementId>();
  for (const start of index.keys()) {
    const chain: ElementId[] = [];
    const onChain = new Set<ElementId>();
    let node: ElementId | undefined = start;
    while (node !== undefined && !settled.has(node) && !onChain.has(node)) {
      chain.push(node);
      onChain.add(node);
      node = links.get(node);
    }
    if (node !== undefined && onChain.has(node)) {
      const loop = chain.slice(chain.indexOf(node));
      const lowest = loop.reduce((a, b) => (index.get(a)! <= index.get(b)! ? a : b));
      links.delete(lowest);
    }
    for (const id of chain) settled.add(id);
  }
  return links;
}

// The container of every non-arrow element: its mind map parent, else the smallest frame or lane of
// strictly greater area holding its centre (earlier on a tie), else null for the root.
export function deriveContainers(elements: readonly Element[]): Map<ElementId, ElementId | null> {
  const parents = mindParents(elements);
  const containers = elements.filter(hasGeometry).filter(isContainerShape);
  const result = new Map<ElementId, ElementId | null>();
  for (const el of elements) {
    if (el.type === 'arrow') continue;
    const id = el.id;
    const parent = parents.get(id);
    if (parent !== undefined) {
      result.set(id, parent);
      continue;
    }
    if (!hasGeometry(el)) {
      result.set(id, null);
      continue;
    }
    const area = areaOf(el);
    const larger = containers.filter((c) => c !== el && areaOf(c) > area);
    result.set(id, smallestHolder(boxCentre(el), larger)?.id ?? null);
  }
  return result;
}

// The rounded top-left of the boxed content; 0,0 when there is none.
export function contentOrigin(elements: readonly Element[]): Point {
  const boxed = elements.filter((el): el is Boxed => el.type !== 'arrow' && hasGeometry(el));
  if (boxed.length === 0) return { x: 0, y: 0 };
  const minOf = (key: 'x' | 'y') => boxed.reduce((min, el) => Math.min(min, el[key]), Infinity);
  return { x: Math.round(minOf('x')), y: Math.round(minOf('y')) };
}
