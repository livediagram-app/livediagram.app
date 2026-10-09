// Derived containment and the content origin (docs/specs/024-agents/document-views.md "The outline"):
// the one rule views, edit-operation membership reports, the lint and the editor's frame drag read.
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
  const byArea = elements
    .filter(hasGeometry)
    .filter(isContainerShape)
    .sort((a, b) => areaOf(a) - areaOf(b));
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
    const centre = boxCentre(el);
    // Ascending area, the earlier first on a tie: the first holder found is the smallest.
    const holder = byArea.find((c) => areaOf(c) > area && boxHoldsPoint(c, centre));
    result.set(id, holder?.id ?? null);
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

// A frame or lane: a shape whose box holds members.
export function isContainer(el: Element): boolean {
  return el.type === 'shape' && (el.shape === 'frame' || el.shape === 'lane');
}

// What travels with moved containers (docs/specs/024-agents/blueprints/edit-operations.md "Carry"): `ids`
// itself, every element whose chain of holders reaches a container in `ids` (a nested frame or lane with
// all it holds), and every arrow whose free ends all lie, as points, in such a container. Pinned ends
// follow their elements. `ids` unchanged when none of them is a container.
export function containerContents(
  elements: readonly Element[],
  ids: ReadonlySet<ElementId>,
  // `deriveContainers(elements)`, when the caller already has it.
  known?: ReadonlyMap<ElementId, ElementId | null>,
): ReadonlySet<ElementId> {
  const moved = new Set(
    elements.filter((el) => ids.has(el.id) && isContainer(el)).map((el) => el.id),
  );
  if (moved.size === 0) return ids;
  const holders = known ?? deriveContainers(elements);
  const carried = new Map<ElementId, boolean>();
  // Whether the chain of holders from `id` reaches a moved container. Chains end: each holder is
  // strictly larger, and mind-map loops are broken (deriveContainers).
  const reachesMoved = (id: ElementId): boolean => {
    if (moved.has(id)) return true;
    const known = carried.get(id);
    if (known !== undefined) return known;
    const holder = holders.get(id);
    const reaches = holder ? reachesMoved(holder) : false;
    carried.set(id, reaches);
    return reaches;
  };
  const containers = elements.filter(hasGeometry).filter(isContainerShape);
  const out = new Set(ids);
  for (const el of elements) {
    if (out.has(el.id)) continue;
    if (el.type === 'arrow') {
      const free = [el.from, el.to].flatMap((end) =>
        end.kind === 'free' ? [{ x: end.x, y: end.y }] : [],
      );
      if (
        free.length > 0 &&
        free.every((p) => {
          const holder = smallestHolder(p, containers);
          return holder !== null && reachesMoved(holder.id);
        })
      ) {
        out.add(el.id);
      }
      continue;
    }
    if (reachesMoved(el.id)) out.add(el.id);
  }
  return out;
}

// A Sheet carries the charts drawn from its own sheet that sit on it (docs/specs/029-sheets/sheet.md "Charts"): a
// chart whose centre is inside a moved Sheet's box moves with it; one dragged off onto the canvas stays put. `ids`
// unchanged when no Sheet is among them.
export function withSheetCharts(
  elements: readonly Element[],
  ids: ReadonlySet<ElementId>,
): ReadonlySet<ElementId> {
  const sheets = elements.filter(
    (el): el is Boxed & { type: 'shape'; planSheet?: { sheetId: string } } =>
      ids.has(el.id) && el.type === 'shape' && el.shape === 'plan-sheet' && hasGeometry(el),
  );
  if (sheets.length === 0) return ids;
  const out = new Set(ids);
  for (const el of elements) {
    if (out.has(el.id) || el.type !== 'shape' || !el.chartSource || !hasGeometry(el)) continue;
    const cx = el.x + el.width / 2;
    const cy = el.y + el.height / 2;
    if (
      sheets.some(
        (s) =>
          s.planSheet?.sheetId === el.chartSource!.sheetId &&
          cx >= s.x &&
          cx <= s.x + s.width &&
          cy >= s.y &&
          cy <= s.y + s.height,
      )
    )
      out.add(el.id);
  }
  return out;
}
