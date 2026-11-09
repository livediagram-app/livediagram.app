import type { ArrowElement, Element, ElementId, Endpoint } from './index';
import { endpointPosition, type ElementIndex } from './geometry';

// An arrow end that names an element no longer on the tab, freed where it was drawn: the arrow outlived what it was
// attached to (a locked arrow kept by a delete, a peer's arrow to a box an undo took back,
// docs/specs/008-canvas/canvas-and-palette.md "Locking arrows"). Left attached, the end named an element that was
// gone and was drawn, and saved, at the canvas origin.

const attachedTo = (end: Endpoint): ElementId | null =>
  end.kind === 'pinned' ? end.elementId : end.kind === 'on-arrow' ? end.arrowId : null;

// `elements` with each arrow end attached to an id `gone` holds turned free, at the point it resolved to over
// `drawnOn` (the elements as they were before the removal). The same array when no end changes. Linear in the
// elements.
export function freeEndsAttachedTo(
  elements: readonly Element[],
  gone: (id: ElementId) => boolean,
  drawnOn: Element[] | ElementIndex,
): Element[] {
  let out: Element[] | null = null;
  elements.forEach((el, i) => {
    if (el.type !== 'arrow') return;
    const freed = freeArrowEnds(el, gone, drawnOn);
    if (freed === el) return;
    out ??= elements.slice();
    out[i] = freed;
  });
  return out ?? (elements as Element[]);
}

function freeArrowEnds(
  arrow: ArrowElement,
  gone: (id: ElementId) => boolean,
  drawnOn: Element[] | ElementIndex,
): ArrowElement {
  const free = (end: Endpoint): Endpoint => {
    const target = attachedTo(end);
    if (target === null || !gone(target)) return end;
    const { x, y } = endpointPosition(end, drawnOn);
    return { kind: 'free', x, y };
  };
  const from = free(arrow.from);
  const to = free(arrow.to);
  return from === arrow.from && to === arrow.to ? arrow : { ...arrow, from, to };
}

// `elements` with every arrow end naming an element missing from it freed, at the point it resolved to over
// `drawnOn`. For a whole state restored from elsewhere (an undo snapshot), where what went is not a list in hand.
export function freeDanglingEnds(
  elements: readonly Element[],
  drawnOn: Element[] | ElementIndex,
): Element[] {
  let ids: Set<ElementId> | null = null;
  return freeEndsAttachedTo(
    elements,
    (id) => {
      ids ??= new Set(elements.map((el) => el.id));
      return !ids.has(id);
    },
    drawnOn,
  );
}
