// Factories for every element type EXCEPT shapes: text, stickies,
// link cards and images, plus scaleElements. The shape kind table and createShape moved to
// './shape-factory' when this file reached 719 lines.
//
// `isBoxed` is imported from './index' rather than a leaf: it is only called
// inside function bodies, after the index cycle has settled, so it does not
// hit the module-init TDZ hazard that pins './shape-factory' to the leaves.
import {
  isBoxed,
  type LinkCardElement,
  type Element,
  type ImageElement,
  type StickyElement,
  type TextElement,
} from './index';

// The shape kind table + createShape live in './shape-factory'. Re-exported
// here so every existing `from './factories'` import (graph-authoring) and the
// package barrel resolve exactly as before.
export { SHAPE_DEFAULT_SIZE, createShape } from './shape-factory';

export function createText(x: number, y: number): TextElement {
  return {
    id: crypto.randomUUID(),
    type: 'text',
    x,
    y,
    width: 220,
    height: 64,
    label: 'Text',
    // Standalone text renders at the fixed px for its size (sm = 14px), and a
    // text element is plain text on the canvas, not a label inside a box, so
    // 'md' (22px) read oversized — especially on a phone. Default to 'sm';
    // the user can bump it from the edit toolbar.
    textSize: 'sm',
  };
}

export function createSticky(x: number, y: number): StickyElement {
  return {
    id: crypto.randomUUID(),
    type: 'sticky',
    x,
    y,
    width: 200,
    height: 200,
    textSize: 'md',
  };
}

// A link-card / bookmark (docs/specs/009-elements/link-cards.md) at (x, y). No link yet — the user sets
// the URL via the link picker, and the editor fills `meta` from the unfurl
// endpoint. Default size suits a favicon + title row above an optional image.
export function createLinkCard(x: number, y: number): LinkCardElement {
  return {
    id: crypto.randomUUID(),
    type: 'link-card',
    x,
    y,
    width: 280,
    height: 120,
  };
}

// Scale a set of elements uniformly about (ox, oy) — used to drag-to-draw a
// component to size (docs/specs/008-canvas/canvas-and-palette.md). Boxed elements scale position + size; a stored
// arrow (a retired element, ./retired-arrow) is never rewritten. Font sizes are unchanged (matches group resize).
export function scaleElements(elements: Element[], ox: number, oy: number, s: number): Element[] {
  return elements.map((el) => {
    if (isBoxed(el)) {
      return {
        ...el,
        x: ox + (el.x - ox) * s,
        y: oy + (el.y - oy) * s,
        width: el.width * s,
        height: el.height * s,
      };
    }
    return el;
  });
}

// Spawns an image element in the empty-state (placeholder) shape. The
// imageId stays null until the user picks an image from the picker;
// the renderer shows the upload affordance in the meantime.
export function createImage(x: number, y: number): ImageElement {
  return {
    id: crypto.randomUUID(),
    type: 'image',
    x,
    y,
    width: 200,
    height: 150,
    imageId: null,
    // Aspect-lock default: once a real image lands, the lock keeps
    // its width:height ratio. Holding Shift while resizing the
    // corner handle breaks it via the existing aspect-lock toggle.
    aspectLocked: true,
  };
}
