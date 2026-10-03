// Elements coming into a document's writing (docs/specs/007-editor/document-pages.md "Zones",
// "Into the writing"): an element added onto a document page outside every zone goes into a new
// zone of the writing, at the block boundary nearest it. Which kind of zone, how big, and where its
// elements sit in it are decided here; where in the writing it goes is the editor's (it alone
// knows where the lines fall). Pure.
import {
  docsOf,
  type DocBlock,
  type DocFlow,
  type DocZoneBlock,
  type DocZoneKind,
} from './doc-flow';
import { zoneAnchorOf, zoneCanvasRect, zoneMemberIds } from './doc-zones';
import { isBoxed, type BoxedElement, type Element, type Tab } from './index';
import {
  illustratePagesOf,
  layOutIllustratePages,
  type LaidOutPage,
  type PageRect,
} from './illustrate-page';
import type { ShapeKind } from './shape-kind';

// The shapes a diagram is drawn with: these, arrows, text, sticky notes and pen strokes go into a
// drawing zone; everything else (a chart, a table, an image, a component) is an object.
const DRAWING_SHAPES: ReadonlySet<ShapeKind> = new Set<ShapeKind>([
  'square',
  'circle',
  'diamond',
  'cylinder',
  'parallelogram',
  'hexagon',
  'document',
  'mind-node',
  'lane',
  'entity',
  'stadium',
  'actor',
  'cloud',
  'triangle',
  'trapezoid',
  'star',
  'speech-bubble',
  'frame',
]);

/** Whether an element is drawn with (and so goes into a drawing zone). */
export function isDrawingElement(el: Element): boolean {
  if (el.type === 'arrow' || el.type === 'text' || el.type === 'sticky') return true;
  if (el.type === 'freehand' || el.type === 'path') return true;
  return el.type === 'shape' && DRAWING_SHAPES.has(el.shape);
}

// A drawing zone's room around what is drawn in it, and the least height it starts with.
export const DOC_DRAWING_PAD = 24;
export const DOC_DRAWING_MIN_HEIGHT = 200;

const boundsOf = (els: readonly Element[], all: readonly Element[]): PageRect => {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const el of els) {
    if (isBoxed(el)) {
      x0 = Math.min(x0, el.x);
      y0 = Math.min(y0, el.y);
      x1 = Math.max(x1, el.x + el.width);
      y1 = Math.max(y1, el.y + el.height);
    } else {
      const p = zoneAnchorOf(el, all);
      x0 = Math.min(x0, p.x);
      y0 = Math.min(y0, p.y);
      x1 = Math.max(x1, p.x);
      y1 = Math.max(y1, p.y);
    }
  }
  return { x: x0, y: y0, width: Math.max(1, x1 - x0), height: Math.max(1, y1 - y0) };
};

export type ZonePlan = {
  zone: DocZoneKind;
  width: number;
  height: number;
  // Where the zone's elements were, as one box: they keep their arrangement inside the zone.
  bounds: PageRect;
  // An object wider than the text is scaled down to it.
  scale: number;
};

/** The zone a set of newly added elements goes into: an object zone hugging a single object, else
 *  a drawing zone the text's width, tall enough for them with room to spare. */
export function zonePlanFor(
  added: readonly Element[],
  all: readonly Element[],
  textWidth: number,
): ZonePlan {
  const bounds = boundsOf(added, all);
  const single = added.length === 1 ? added[0]! : null;
  if (single && isBoxed(single) && !isDrawingElement(single)) {
    const scale = Math.min(1, textWidth / single.width);
    return {
      zone: 'object',
      width: Math.round(single.width * scale),
      height: Math.round(single.height * scale),
      bounds,
      scale,
    };
  }
  const width = Math.round(textWidth);
  const height = Math.round(Math.max(DOC_DRAWING_MIN_HEIGHT, bounds.height + 2 * DOC_DRAWING_PAD));
  const scale = Math.min(1, (width - 2 * DOC_DRAWING_PAD) / bounds.width);
  return { zone: 'drawing', width, height, bounds, scale };
}

/** The elements moved (and an object scaled) into a zone standing at `rect`: an object filling it,
 *  drawn elements centred in it, keeping their arrangement. */
export function withElementsIntoZone(
  elements: readonly Element[],
  ids: ReadonlySet<string>,
  plan: ZonePlan,
  rect: PageRect,
): Element[] {
  const { bounds, scale } = plan;
  // Where the box of elements lands: centred in the zone, scaled about its own corner.
  const ox = rect.x + (rect.width - bounds.width * scale) / 2;
  const oy = rect.y + (rect.height - bounds.height * scale) / 2;
  const map = (p: { x: number; y: number }) => ({
    x: ox + (p.x - bounds.x) * scale,
    y: oy + (p.y - bounds.y) * scale,
  });
  return elements.map((el): Element => {
    if (!ids.has(el.id)) return el;
    if (isBoxed(el)) {
      const at = map(el);
      return {
        ...el,
        x: at.x,
        y: at.y,
        width: el.width * scale,
        height: el.height * scale,
      } as BoxedElement;
    }
    const end = (ep: typeof el.from) => (ep.kind === 'free' ? { ...ep, ...map(ep) } : ep);
    return { ...el, from: end(el.from), to: end(el.to) };
  });
}

/** Of `ids` (just added), the ones on a document page and inside no zone of its document, grouped
 *  by document. An arrow pinned at both ends to elements already in a zone is left alone. */
export function looseOnDocuments(
  elements: readonly Element[],
  ids: readonly string[],
  pages: readonly LaidOutPage[],
  docs: Readonly<Record<string, DocFlow>>,
): Map<string, string[]> {
  const byId = new Map(elements.map((e) => [e.id, e]));
  const zones = new Map<string, PageRect[]>();
  for (const [flow, doc] of Object.entries(docs)) {
    const own = pages.filter((p) => p.flow === flow);
    zones.set(
      flow,
      doc.blocks.flatMap((b) => {
        if (b.type !== 'zone') return [];
        const r = zoneCanvasRect(own, b);
        return r ? [r] : [];
      }),
    );
  }
  const out = new Map<string, string[]>();
  for (const id of ids) {
    const el = byId.get(id);
    if (!el) continue;
    const at = zoneAnchorOf(el, elements as Element[]);
    const page = pages.find(
      (p) =>
        at.x >= p.rect.x &&
        at.x <= p.rect.x + p.rect.width &&
        at.y >= p.rect.y &&
        at.y <= p.rect.y + p.rect.height,
    );
    if (!page?.flow || !docs[page.flow]) continue;
    const inZone = (zones.get(page.flow) ?? []).some(
      (r) => at.x >= r.x && at.x <= r.x + r.width && at.y >= r.y && at.y <= r.y + r.height,
    );
    if (inZone) continue;
    const list = out.get(page.flow);
    if (list) list.push(id);
    else out.set(page.flow, [id]);
  }
  return out;
}

type DocsTab = Pick<Tab, 'elements'> & { pages?: unknown; docs?: unknown };

/**
 * A document's zones fitted to their elements (docs/specs/007-editor/document-pages.md "Zones"):
 * an object zone takes its object's size and keeps it at its corner (a resize from any handle);
 * an object zone whose object is gone leaves the writing; a drawing zone grows down and across (to
 * the text width) to keep its elements inside with DOC_DRAWING_PAD to spare, and never shrinks past
 * them. The same tab back when nothing changes.
 */
export function withZonesFitted<T extends DocsTab>(tab: T, flow: string, textWidth: number): T {
  const doc = docsOf(tab)[flow];
  if (!doc) return tab;
  const pages = layOutIllustratePages(illustratePagesOf(tab)).filter((p) => p.flow === flow);
  let elements = tab.elements as Element[];
  let changed = false;
  const blocks: DocBlock[] = [];
  for (const b of doc.blocks) {
    if (b.type !== 'zone') {
      blocks.push(b);
      continue;
    }
    const rect = zoneCanvasRect(pages, b);
    if (!rect) {
      blocks.push(b);
      continue;
    }
    const members = elements.filter((el) => insideRect(rect, zoneAnchorOf(el, elements)));
    if (b.zone === 'object') {
      const obj = members.find(isBoxed);
      if (!obj) {
        changed = true;
        continue;
      }
      const width = Math.round(Math.min(obj.width, textWidth));
      const height = Math.round(obj.height * (width / obj.width));
      const sized = Math.abs(width - b.width) > 0.5 || Math.abs(height - b.height) > 0.5;
      const placed = Math.abs(obj.x - rect.x) > 0.5 || Math.abs(obj.y - rect.y) > 0.5;
      const scaled = Math.abs(width - obj.width) > 0.5;
      if (placed || scaled)
        elements = elements.map((el) =>
          el.id === obj.id ? ({ ...el, x: rect.x, y: rect.y, width, height } as Element) : el,
        );
      if (sized) {
        blocks.push({ ...b, width, height });
        changed = true;
      } else blocks.push(b);
      if (placed || scaled) changed = true;
      continue;
    }
    if (members.length === 0) {
      blocks.push(b);
      continue;
    }
    const box = boundsOf(members, elements);
    const width = Math.round(
      Math.min(textWidth, Math.max(b.width, box.x + box.width + DOC_DRAWING_PAD - rect.x)),
    );
    const height = Math.round(Math.max(b.height, box.y + box.height + DOC_DRAWING_PAD - rect.y));
    if (width !== b.width || height !== b.height) {
      blocks.push({ ...b, width, height });
      changed = true;
    } else blocks.push(b);
  }
  if (!changed) return tab;
  const nextDoc: DocFlow = doc.style ? { blocks, style: doc.style } : { blocks };
  return { ...tab, elements, docs: { ...(tab.docs as Record<string, DocFlow>), [flow]: nextDoc } };
}

/** The elements of zones that left the writing (each where it last stood) removed with them, and
 *  any arrow pinned to one, in turn. */
export function withZoneContentsRemoved<T extends DocsTab>(
  tab: T,
  flow: string,
  gone: readonly DocZoneBlock[],
): T {
  const pages = layOutIllustratePages(illustratePagesOf(tab)).filter((p) => p.flow === flow);
  const els = tab.elements as Element[];
  const ids = new Set<string>();
  for (const z of gone) {
    const rect = zoneCanvasRect(pages, z);
    if (!rect) continue;
    for (const id of zoneMemberIds(els, rect)) ids.add(id);
  }
  if (ids.size === 0) return tab;
  let grew = true;
  while (grew) {
    grew = false;
    for (const el of els) {
      if (ids.has(el.id) || el.type !== 'arrow') continue;
      const tied = [el.from, el.to].some(
        (ep) =>
          (ep.kind === 'pinned' && ids.has(ep.elementId)) ||
          (ep.kind === 'on-arrow' && ids.has(ep.arrowId)),
      );
      if (tied) {
        ids.add(el.id);
        grew = true;
      }
    }
  }
  return { ...tab, elements: els.filter((el) => !ids.has(el.id)) };
}

const insideRect = (r: PageRect, p: { x: number; y: number }) =>
  p.x >= r.x && p.x <= r.x + r.width && p.y >= r.y && p.y <= r.y + r.height;
