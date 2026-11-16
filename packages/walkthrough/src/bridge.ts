// The walkthrough's one hold on an app's canvas (liveworkspace/docs/specs/006-media/walkthroughs.md "One package, four
// apps"): every canvas app draws its content in an element marked `data-canvas-content`, transformed
// `scale(zoom) translate(offset)` about its centre, and marks each element `data-element-id`. Reading those two, the
// recorder and the player need nothing else of an app's DOM.

import type { Point } from './timeline';

export const CONTENT_SELECTOR = '[data-canvas-content]';
const ELEMENT_ATTR = 'data-element-id';

/** The canvas content inside the app's canvas root. */
export function contentOf(root: ParentNode | null): HTMLElement | null {
  return root?.querySelector<HTMLElement>(CONTENT_SELECTOR) ?? null;
}

/** The content's own size, untransformed: what a recorded view is measured against. */
export function sizeOf(content: HTMLElement): { w: number; h: number } {
  return { w: content.offsetWidth, h: content.offsetHeight };
}

/** A pointer's place on the screen as a canvas point, or null when the content has no size yet. */
export function canvasPoint(content: HTMLElement, clientX: number, clientY: number): Point | null {
  const rect = content.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return null;
  return {
    x: ((clientX - rect.left) * content.offsetWidth) / rect.width,
    y: ((clientY - rect.top) * content.offsetHeight) / rect.height,
  };
}

/** A canvas point back on the screen, relative to `frame` (the player's layer). */
export function screenPoint(content: HTMLElement, frame: HTMLElement, p: Point): Point | null {
  const rect = content.getBoundingClientRect();
  if (content.offsetWidth === 0 || content.offsetHeight === 0) return null;
  const box = frame.getBoundingClientRect();
  return {
    x: rect.left - box.left + (p.x * rect.width) / content.offsetWidth,
    y: rect.top - box.top + (p.y * rect.height) / content.offsetHeight,
  };
}

/** The element a pointer is over: the nearest marked one, as a group's child is the one pressed. */
export function elementIdAt(target: EventTarget | null): string | null {
  if (!(target instanceof Element)) return null;
  return target.closest(`[${ELEMENT_ATTR}]`)?.getAttribute(ELEMENT_ATTR) ?? null;
}

/** An element's box on the screen relative to `frame`, for the player's press ring. */
export function elementBox(
  root: ParentNode,
  frame: HTMLElement,
  id: string,
): { x: number; y: number; w: number; h: number } | null {
  const el = root.querySelector(`[${ELEMENT_ATTR}="${quoteAttr(id)}"]`);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  const box = frame.getBoundingClientRect();
  return { x: r.left - box.left, y: r.top - box.top, w: r.width, h: r.height };
}

// An id inside a double-quoted attribute selector: its quote and backslash escaped, control characters dropped.
function quoteAttr(id: string): string {
  // oxlint-disable-next-line no-control-regex -- the control characters are what is being removed.
  return id.replace(/[\u0000-\u001f\u007f]/g, '').replace(/["\\]/g, '\\$&');
}

export type HiddenLook = 'presenter' | 'viewer';

/**
 * The rule that hides elements: for the presenter, faded and dashed so they can still work around them; for a viewer,
 * not drawn at all (and not pressable).
 */
export function hiddenCss(ids: Iterable<string>, look: HiddenLook): string {
  const selectors = [...ids].map(
    (id) => `${CONTENT_SELECTOR} [${ELEMENT_ATTR}="${quoteAttr(id)}"]`,
  );
  if (selectors.length === 0) return '';
  const body =
    look === 'viewer'
      ? 'visibility:hidden !important;pointer-events:none !important;'
      : 'opacity:.35 !important;outline:1.5px dashed rgb(225 29 72 / .7);outline-offset:2px;';
  return `${selectors.join(',')}{${body}}`;
}

/** Puts a hiding rule on the page until the answer is called. One style element per caller; an empty rule adds none. */
export function applyHidden(doc: Document, ids: Iterable<string>, look: HiddenLook): () => void {
  const css = hiddenCss(ids, look);
  if (!css) return () => undefined;
  const style = doc.createElement('style');
  style.setAttribute('data-walkthrough-hidden', look);
  style.textContent = css;
  doc.head.append(style);
  return () => style.remove();
}
