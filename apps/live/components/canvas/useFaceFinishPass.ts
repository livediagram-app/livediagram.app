'use client';

import { useLayoutEffect, type RefObject } from 'react';
import {
  MARKER_FACE_MAX_PARTS,
  isPillRect,
  markerFacePart,
  markerFaceSeed,
  type FacePartDrawing,
  type FacePartPaint,
  type FacePartShape,
  type Finish,
} from '@livediagram/document';
import { watchUntilSettled } from '@/components/canvas/settle-watch';

// A face's own parts in its finish on the canvas. Under Marker (docs/specs/008-canvas/finish.md "Marker", "Faces: frames and shapes"):
// once the face has settled, its frames (outlined HTML boxes) and its SVG shapes are read from the live DOM and
// described to markerFacePart, the same rules and drawing the export runs over its markup (svgMarkerFace). Each
// part's ink goes in beside the part itself: an <svg> inside a frame, a <g> after a shape, in the shape's own
// coordinates. So it moves with the part (a column that scrolls, a band that animates) and sits under whatever the
// face draws above the part (its words). The part's own line is hidden by app/face-finish.css through the mark set
// here. The ink is ours, not React's: React never sees it, and every take clears the last one first.

const SVG_NS = 'http://www.w3.org/2000/svg';
/** The ink this pass adds; everything carrying it is removed before each take. */
const INK_ATTR = 'data-marker-ink';
/** Marks a part whose line the ink replaces: `frame`, `shape` or `line` (face-finish.css). */
const DRAWN_ATTR = 'data-marker-drawn';
/** Marks an SVG rectangle whose ends are round, which Professional keeps round (face-finish.css). */
const PILL_ATTR = 'data-finish-pill';
/** What the pass never reads into: the hand-drawn body, photos, embeds, kept parts and its own ink. */
const SKIP = `[data-finish="marker"], [data-finish-keep], [${INK_ATTR}], img, video, iframe, canvas, foreignObject, text`;
const SHAPE_TAGS = new Set(['rect', 'circle', 'ellipse', 'path']);

/** The face under `root` in its finish, re-taken whenever it settles after a change: Marker draws its frames and
 *  shapes in marker; Professional keeps its SVG pills round (face-finish.css squares every other rectangle). */
export function useFaceFinishPass(
  rootRef: RefObject<HTMLElement | null>,
  finish: Finish | undefined,
  elementId: string,
): void {
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root || (finish !== 'marker' && finish !== 'professional')) return;
    const take =
      finish === 'marker' ? () => drawMarkerFace(root, elementId) : () => markFacePills(root);
    take();
    const stop = watchUntilSettled(root, take, { resize: true, ignore: ownChange });
    // Lettering that loads late reflows the face without a mutation.
    let live = true;
    void document.fonts?.ready.then(() => live && take());
    return () => {
      live = false;
      stop();
      clearMarkerFace(root);
      for (const pill of root.querySelectorAll(`[${PILL_ATTR}]`)) pill.removeAttribute(PILL_ATTR);
    };
  }, [rootRef, finish, elementId]);
}

/** Marks every SVG rectangle under `root` whose ends are round (a pill, a disc), which Professional keeps. */
export function markFacePills(root: Element): void {
  if (typeof SVGRectElement === 'undefined') return;
  for (const rect of root.querySelectorAll('rect')) {
    const pill = isPillRect(
      rect.width.baseVal.value,
      rect.height.baseVal.value,
      rect.rx.baseVal.value || rect.ry.baseVal.value,
    );
    if (pill !== rect.hasAttribute(PILL_ATTR)) rect.toggleAttribute(PILL_ATTR, pill);
  }
}

// A change the pass made: its ink going in or out, its marks.
function ownChange(r: MutationRecord): boolean {
  if (r.type === 'attributes') return r.attributeName === DRAWN_ATTR || r.attributeName === PILL_ATTR;
  if (r.type !== 'childList') return false;
  const ours = (n: Node) => n instanceof Element && n.hasAttribute(INK_ATTR);
  return [...r.addedNodes, ...r.removedNodes].every(ours);
}

/** Removes the pass's ink and marks under `root`. */
export function clearMarkerFace(root: Element): void {
  for (const ink of root.querySelectorAll(`[${INK_ATTR}]`)) ink.remove();
  for (const drawn of root.querySelectorAll(`[${DRAWN_ATTR}]`)) drawn.removeAttribute(DRAWN_ATTR);
}

/** One take: clears the last, then draws every frame and shape under `root` that Marker draws. Returns how many. */
export function drawMarkerFace(root: HTMLElement, elementId: string): number {
  clearMarkerFace(root);
  const face = { width: root.offsetWidth, height: root.offsetHeight };
  const seed = markerFaceSeed(elementId);
  let drawn = 0;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT, {
    acceptNode: (n) =>
      (n as Element).matches(SKIP) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT,
  });
  const parts: Element[] = [root];
  for (let n = walker.nextNode(); n; n = walker.nextNode()) parts.push(n as Element);
  for (const el of parts) {
    if (drawn >= MARKER_FACE_MAX_PARTS) break;
    const part =
      el instanceof HTMLElement
        ? frameInk(el, face, seed, drawn)
        : isSvgShape(el)
          ? shapeInk(el, face, seed, drawn)
          : null;
    if (part) drawn += 1;
  }
  return drawn;
}

// An outlined HTML box: its marker outline in an <svg> laid over its border box, inside it so it scrolls and clips
// with it. A static box is not a containing block for the ink, so it keeps its plain border.
function frameInk(
  el: HTMLElement,
  face: { width: number; height: number },
  seed: number,
  index: number,
): FacePartDrawing | null {
  const w = el.offsetWidth;
  const h = el.offsetHeight;
  if (w < 1 || h < 1) return null;
  const css = getComputedStyle(el);
  if (css.position === 'static') return null;
  const sides = ['Top', 'Right', 'Bottom', 'Left'] as const;
  const bordered = sides.every(
    (s) =>
      parseFloat(css.getPropertyValue(`border-${s.toLowerCase()}-width`)) > 0 &&
      css.getPropertyValue(`border-${s.toLowerCase()}-style`) !== 'none',
  );
  if (!bordered) return null;
  const rx = parseFloat(css.borderTopLeftRadius) || 0;
  if (isPillRect(w, h, rx)) return null;
  const inset = 2;
  const part = markerFacePart(
    { kind: 'rect', x: inset, y: inset, width: w - 2 * inset, height: h - 2 * inset, rx },
    { fill: css.backgroundColor, stroke: css.borderTopColor, strokePx: parseFloat(css.borderTopWidth) },
    face,
    seed,
    index,
  );
  if (!part || part.role !== 'frame') return null;
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute(INK_ATTR, '');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('width', String(w));
  svg.setAttribute('height', String(h));
  svg.style.cssText = `position:absolute;left:${-parseFloat(css.borderLeftWidth)}px;top:${-parseFloat(
    css.borderTopWidth,
  )}px;overflow:visible;pointer-events:none`;
  svg.innerHTML = part.svg;
  el.setAttribute(DRAWN_ATTR, part.role);
  el.appendChild(svg);
  return part;
}

// An SVG shape: its marker drawing in a <g> straight after it, in its own coordinates (and its own transform).
function shapeInk(
  el: SVGGeometryElement,
  face: { width: number; height: number },
  seed: number,
  index: number,
): FacePartDrawing | null {
  const css = getComputedStyle(el);
  if (css.markerStart !== 'none' || css.markerEnd !== 'none') return null;
  const shape = shapeOf(el);
  if (!shape) return null;
  const paint: FacePartPaint = {
    fill: css.fill,
    stroke: css.stroke,
    strokePx: css.stroke === 'none' ? 0 : parseFloat(css.strokeWidth) || 0,
    ...(Number(css.opacity) < 1 ? { opacity: Number(css.opacity) } : {}),
  };
  const part = markerFacePart(shape, paint, face, seed, index);
  if (!part) return null;
  const g = document.createElementNS(SVG_NS, 'g');
  g.setAttribute(INK_ATTR, '');
  const transform = el.getAttribute('transform');
  if (transform) g.setAttribute('transform', transform);
  g.innerHTML = part.svg;
  el.setAttribute(DRAWN_ATTR, part.role);
  el.after(g);
  return part;
}

// An SVG shape the pass reads (jsdom has no SVGGeometryElement, so it reads none there).
function isSvgShape(el: Element): el is SVGGeometryElement {
  return (
    typeof SVGGeometryElement !== 'undefined' &&
    el instanceof SVGGeometryElement &&
    SHAPE_TAGS.has(el.tagName)
  );
}

function shapeOf(el: SVGGeometryElement): FacePartShape | null {
  if (el instanceof SVGRectElement)
    return {
      kind: 'rect',
      x: el.x.baseVal.value,
      y: el.y.baseVal.value,
      width: el.width.baseVal.value,
      height: el.height.baseVal.value,
      rx: el.rx.baseVal.value || el.ry.baseVal.value,
    };
  if (el instanceof SVGCircleElement) {
    const r = el.r.baseVal.value;
    return { kind: 'ellipse', cx: el.cx.baseVal.value, cy: el.cy.baseVal.value, rx: r, ry: r };
  }
  if (el instanceof SVGEllipseElement)
    return {
      kind: 'ellipse',
      cx: el.cx.baseVal.value,
      cy: el.cy.baseVal.value,
      rx: el.rx.baseVal.value,
      ry: el.ry.baseVal.value,
    };
  const d = el.getAttribute('d');
  return d ? { kind: 'path', d } : null;
}
