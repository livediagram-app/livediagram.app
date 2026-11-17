// The walkthrough's one hold on an app's canvas (liveworkspace/docs/specs/006-media/walkthroughs.md "One package, four
// apps"): every canvas app draws its content in an element marked `data-canvas-content`, transformed
// `scale(zoom) translate(offset)` about its centre, and marks each element `data-element-id`. Reading those two, the
// recorder and the player need nothing else of an app's DOM. An app that draws hideable things over the canvas
// rather than in it (liveplanner's board cards and dashboard widgets) names their attributes as `marks`
// (host.ts WalkthroughHideable), read everywhere `data-element-id` is.

import type { Point } from './timeline';

export const CONTENT_SELECTOR = '[data-canvas-content]';
const ELEMENT_ATTR = 'data-element-id';

// Every attribute that names a hideable thing: the canvas's own first, then the app's marks.
function attrsOf(marks: readonly string[]): readonly string[] {
  return marks.length === 0 ? [ELEMENT_ATTR] : [ELEMENT_ATTR, ...marks];
}

/** Whether a press or the pointer is on something the walkthrough reads: the canvas content, or a marked thing. */
export function onHideableSurface(
  target: EventTarget | null,
  marks: readonly string[] = [],
): boolean {
  if (!(target instanceof Element)) return false;
  if (target.closest(CONTENT_SELECTOR)) return true;
  return marks.length > 0 && target.closest(marks.map((m) => `[${m}]`).join(',')) !== null;
}

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

/**
 * The element a pointer is over: the nearest marked one, as a group's child is the one pressed (and a card on a
 * board drawn on the canvas is the card, not the board).
 */
export function elementIdAt(
  target: EventTarget | null,
  marks: readonly string[] = [],
): string | null {
  if (!(target instanceof Element)) return null;
  const attrs = attrsOf(marks);
  const found = target.closest(attrs.map((a) => `[${a}]`).join(','));
  if (!found) return null;
  for (const a of attrs) {
    const id = found.getAttribute(a);
    if (id) return id;
  }
  return null;
}

/** An element's box on the screen relative to `frame`, for the player's press ring. */
export function elementBox(
  root: ParentNode,
  frame: HTMLElement,
  id: string,
  marks: readonly string[] = [],
): { x: number; y: number; w: number; h: number } | null {
  const q = quoteAttr(id);
  // The one drawn: a covered copy (a board's own copy under its Board tab) is passed over.
  const el = [
    ...root.querySelectorAll(
      attrsOf(marks)
        .map((a) => `[${a}="${q}"]`)
        .join(','),
    ),
  ].find((e) => e.checkVisibility?.({ visibilityProperty: true }) ?? true);
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
export function hiddenCss(
  ids: Iterable<string>,
  look: HiddenLook,
  marks: readonly string[] = [],
): string {
  const selectors = [...ids].flatMap((id) => {
    const q = quoteAttr(id);
    return [`${CONTENT_SELECTOR} [${ELEMENT_ATTR}="${q}"]`, ...marks.map((m) => `[${m}="${q}"]`)];
  });
  if (selectors.length === 0) return '';
  if (look === 'viewer') {
    return `${selectors.join(',')}{visibility:hidden !important;pointer-events:none !important;}`;
  }
  // The element's own drawing fades (its children: the element's wrapper paints nothing itself), and the dashed
  // outline sits on the wrapper, outside the fade, so it shows at full strength over any canvas.
  const faded = selectors.map((s) => `${s} > *`).join(',');
  return (
    `${faded}{opacity:.35 !important;}` +
    `${selectors.join(',')}{outline:2px dashed rgb(225 29 72) !important;outline-offset:3px;}`
  );
}

/** Puts a hiding rule on the page until the answer is called. One style element per caller; an empty rule adds none. */
export function applyHidden(
  doc: Document,
  ids: Iterable<string>,
  look: HiddenLook,
  marks: readonly string[] = [],
): () => void {
  const css = hiddenCss(ids, look, marks);
  if (!css) return () => undefined;
  const style = doc.createElement('style');
  style.setAttribute('data-walkthrough-hidden', look);
  style.textContent = css;
  doc.head.append(style);
  return () => style.remove();
}
