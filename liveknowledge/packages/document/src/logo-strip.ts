// The logo strip (docs/specs/009-elements/logo-strip.md): a row stack of logo pictures, evenly spaced and the same
// height, drawn in grey. Its parts are ordinary elements (a stack and image placeholders), so the stack keeps them
// in line and every image path (uploads, the gallery, exports, the reference index) works unchanged. Pure.
import { createImage } from './factories';
import type { Element, ElementId, ImageElement, ShapeElement } from './index';
import { createShape } from './shape-factory';
import { isStack, layoutStack, stackChildren } from './stack';

import {
  LOGO_H,
  LOGO_MIN_H,
  LOGO_MIN_W,
  LOGO_STRIP_COUNT,
  LOGO_STRIP_GAP,
  LOGO_STRIP_PADDING,
  LOGO_W,
  logoStripSize,
} from './logo-strip-size';

export * from './logo-strip-size';

/** One logo slot: a placeholder that shows its picture whole, in grey, sized freely beside its neighbours. */
export function createLogo(x: number, y: number, width = LOGO_W, height = LOGO_H): ImageElement {
  return {
    ...createImage(x, y),
    width,
    height,
    objectFit: 'contain',
    greyscale: true,
    aspectLocked: false,
    alt: 'Logo',
  };
}

/**
 * A logo strip: its stack first, then its logos, already in their slots. Centred on (`cx`, `cy`) at its natural
 * size, or filling `box`, the logos sharing its width (each at least LOGO_MIN_W x LOGO_MIN_H).
 */
export function createLogoStrip(
  at: { cx: number; cy: number } | { x: number; y: number; width: number; height: number },
  count = LOGO_STRIP_COUNT,
): Element[] {
  const n = Math.max(1, Math.round(count));
  const p = LOGO_STRIP_PADDING;
  const g = LOGO_STRIP_GAP;
  let logoW = LOGO_W;
  let logoH = LOGO_H;
  let x: number;
  let y: number;
  if ('cx' in at) {
    const size = logoStripSize(n);
    x = at.cx - size.width / 2;
    y = at.cy - size.height / 2;
  } else {
    logoW = Math.max(LOGO_MIN_W, Math.floor((at.width - p * 2 - (n - 1) * g) / n));
    logoH = Math.max(LOGO_MIN_H, Math.floor(at.height - p * 2));
    x = at.x;
    y = at.y;
  }
  const base = createShape('stack', x, y);
  const stack: ShapeElement = {
    ...base,
    stackGap: g,
    strokeWidth: 'none',
    label: '',
  };
  const logos = Array.from({ length: n }, (_, i) =>
    createLogo(x + p + i * (logoW + g), y + p, logoW, logoH),
  );
  const laid = layoutStack(stack, logos);
  return [
    { ...stack, width: laid.width, height: laid.height },
    ...logos.map((l, i) => ({ ...l, x: laid.at[i]!.x, y: laid.at[i]!.y })),
  ];
}

const pictures = (elements: readonly Element[], stack: ShapeElement): ImageElement[] =>
  stackChildren(elements, stack).filter((el): el is ImageElement => el.type === 'image');

/** Whether a stack holds a picture, and whether every picture it directly holds is greyscale. */
export function stackPicturesGreyscale(
  elements: readonly Element[],
  stack: ShapeElement,
): { hasPictures: boolean; greyscale: boolean } {
  const held = pictures(elements, stack);
  return {
    hasPictures: held.length > 0,
    greyscale: held.length > 0 && held.every((i) => i.greyscale === true),
  };
}

/** Every picture a stack directly holds turned grey (or back to colour); the same array when nothing changes. */
export function withStackPicturesGreyscale(
  elements: Element[],
  stackId: ElementId,
  on: boolean,
): Element[] {
  const stack = elements.find((el) => el.id === stackId);
  if (!stack || !isStack(stack)) return elements;
  const ids = new Set(pictures(elements, stack).map((el) => el.id));
  if (ids.size === 0) return elements;
  let changed = false;
  const next = elements.map((el) => {
    if (!ids.has(el.id) || el.type !== 'image' || (el.greyscale === true) === on) return el;
    changed = true;
    if (on) return { ...el, greyscale: true as const };
    const { greyscale: _drop, ...rest } = el;
    void _drop;
    return rest;
  });
  return changed ? next : elements;
}
