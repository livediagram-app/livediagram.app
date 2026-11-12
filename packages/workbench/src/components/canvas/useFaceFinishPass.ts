'use client';

import { useLayoutEffect, type RefObject } from 'react';
import { MARKER_FACE_MAX_PARTS, markerFaceSeed } from '@liveworkspace/element-model/marker-face';
import type { Finish } from '@liveworkspace/element-model/finish';
import { isPillRect } from '@liveworkspace/model-core/face-finish';
import { scheduleFaceTake, type FaceTake, type FaceTakeWhen } from './face-take-batch';
import { watchUntilSettled, type SettleWatch } from './settle-watch';
import {
  INK_ATTR,
  DRAWN_ATTR,
  PILL_ATTR,
  SKIP,
  type Pen,
  MEASURE_ATTR,
  SHAPE_ATTR,
  ISOLATED_ATTR,
  RULES_ATTR,
  gridRules,
  isFaceBox,
  frameInk,
  shapeInk,
  isSvgShape,
} from './face-finish-ink';

// A face's own parts in its finish on the canvas. Under Marker (docs/specs/008-canvas/finish.md "Marker", "Faces: frames and shapes"):
// once the face has settled, its frames (outlined HTML boxes) and its SVG shapes are read from the live DOM and
// described to markerFacePart, the same rules and drawing the export runs over its markup (svgMarkerFace). Each
// part's ink goes in beside the part itself: an <svg> inside a frame, a <g> after a shape, in the shape's own
// coordinates. So it moves with the part (a column that scrolls, a band that animates) and sits under whatever the
// face draws above the part (its words). The part's own line is hidden by app/face-finish.css through the mark set
// here. The ink is ours, not React's: React never sees it, and every take clears the last one first. A face takes
// with the board's other faces (face-take-batch.ts): all clear, then all read, then all write, so a board of
// thousands of faces is laid out once per batch rather than once per face.

/** The face under `root` in its finish, re-taken whenever it settles after a change: Marker draws its frames and
 *  shapes in marker; Sketch shades its shapes in pencil; Professional keeps its SVG pills round (face-finish.css
 *  squares every other rectangle). */
export function useFaceFinishPass(
  rootRef: RefObject<HTMLElement | null>,
  finish: Finish | undefined,
  elementId: string,
  // A body that fills its tab or the screen is the page, not a box on it: its own box
  // is never coloured in.
  { page = false }: { page?: boolean } = {},
): void {
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root || finish === undefined || finish === 'flexible') return;
    const pen: Pen = finish === 'marker' ? 'marker' : 'pencil';
    let cancel = () => {};
    let watch: SettleWatch | undefined;
    const settle = () =>
      watchUntilSettled(root, () => take('frame'), { resize: true, ignore: ownChange });
    // Marker and Sketch take with the board's other faces: a face that mounts before it is first painted, one that
    // settled or whose lettering loaded at the next frame. Professional only marks pills, which reads no layout.
    const take = (when: FaceTakeWhen) => {
      if (finish === 'professional') {
        markFacePills(root);
        return;
      }
      const { prepare, read } = markerFaceTake(root, elementId, pen, page);
      cancel = scheduleFaceTake(
        root,
        {
          prepare,
          read: () => {
            const write = read();
            return () => {
              const after = write();
              // Every change so far is drawn, the take's own included: none of them is a change to wait for. The
              // face is watched from its first take on.
              if (watch) watch.taken();
              else watch = settle();
              return after;
            };
          },
        },
        when,
      );
    };
    take('now');
    if (finish === 'professional') watch = settle();
    // Lettering that loads late reflows the face without a mutation.
    let live = true;
    void document.fonts?.ready.then(() => live && take('frame'));
    return () => {
      live = false;
      cancel();
      watch?.();
      clearMarkerFace(root);
      for (const pill of root.querySelectorAll(`[${PILL_ATTR}]`)) pill.removeAttribute(PILL_ATTR);
    };
  }, [rootRef, finish, elementId, page]);
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
  // Sketch's ink copy of the face (SketchFace) is re-taken from the live face: never a change to read.
  const target = r.target instanceof Element ? r.target : r.target.parentElement;
  if (target?.closest('[data-sketch-ink]')) return true;
  if (r.type === 'attributes')
    return (
      r.attributeName === DRAWN_ATTR ||
      r.attributeName === PILL_ATTR ||
      r.attributeName === RULES_ATTR ||
      r.attributeName === MEASURE_ATTR ||
      r.attributeName === ISOLATED_ATTR ||
      // The isolation it sets on a box it colours in.
      (r.attributeName === 'style' && (r.target as Element).hasAttribute?.(ISOLATED_ATTR))
    );
  if (r.type !== 'childList') return false;
  const ours = (n: Node) => n instanceof Element && n.hasAttribute(INK_ATTR);
  return [...r.addedNodes, ...r.removedNodes].every(ours);
}

/** Removes the pass's ink and marks under `root`. */
export function clearMarkerFace(root: Element): void {
  for (const ink of root.querySelectorAll(`[${INK_ATTR}]`)) ink.remove();
  for (const drawn of root.querySelectorAll(`[${DRAWN_ATTR}]`)) drawn.removeAttribute(DRAWN_ATTR);
  for (const ruled of root.querySelectorAll(`[${RULES_ATTR}]`)) ruled.removeAttribute(RULES_ATTR);
  for (const isolated of [root, ...root.querySelectorAll<HTMLElement>(`[${ISOLATED_ATTR}]`)])
    if (isolated instanceof HTMLElement && isolated.hasAttribute(ISOLATED_ATTR)) {
      isolated.style.isolation = '';
      isolated.removeAttribute(ISOLATED_ATTR);
    }
}

/** One take: clears the last, then draws every frame and shape under `root` that Marker draws. Returns how many. */
export function drawMarkerFace(
  root: HTMLElement,
  elementId: string,
  // Sketch's pencil shades the face's shapes only; its wobble draws the rest by hand.
  pen: Pen = 'marker',
  page = false,
): number {
  let drawn = 0;
  const take = markerFaceTake(root, elementId, pen, page, (n) => (drawn = n));
  take.prepare?.();
  take.read()();
  return drawn;
}

/** A take of `root` in three steps for a batch (face-take-batch.ts): `prepare` clears the last take, `read` reads
 *  the face and every part to draw without writing anything, and the write it returns draws them. `onDrawn` hears
 *  how many parts the write drew. */
export function markerFaceTake(
  root: HTMLElement,
  elementId: string,
  pen: Pen = 'marker',
  page = false,
  onDrawn?: (drawn: number) => void,
): FaceTake {
  // Sketch hides a live face's fills and lines (its ink copy shows them through the wobble, app/sketch-face.css):
  // they are shown again from before the face is read until it is drawn.
  let measured: Element[] = [];
  const unmeasure = () => {
    for (const live of measured) live.removeAttribute(MEASURE_ATTR);
  };
  return {
    prepare: () => {
      clearMarkerFace(root);
      measured = [...root.querySelectorAll('[data-sketch-words]')];
      for (const live of measured) live.setAttribute(MEASURE_ATTR, '');
    },
    read: () => {
      let writes: (() => void)[];
      let drawn: number;
      try {
        ({ writes, drawn } = readParts(root, elementId, pen, page));
      } catch (error) {
        unmeasure();
        throw error;
      }
      return () => {
        try {
          for (const write of writes) write();
        } finally {
          unmeasure();
        }
        onDrawn?.(drawn);
      };
    },
  };
}

// Every part under `root` the pen draws, read without writing: the writes that draw them, in order, and how many.
function readParts(
  root: HTMLElement,
  elementId: string,
  pen: Pen,
  page: boolean,
): { writes: (() => void)[]; drawn: number } {
  const face = { width: root.offsetWidth, height: root.offsetHeight };
  const seed = markerFaceSeed(elementId);
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT, {
    acceptNode: (n) =>
      (n as Element).matches(SKIP) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT,
  });
  const parts: Element[] = [root];
  for (let n = walker.nextNode(); n; n = walker.nextNode()) parts.push(n as Element);
  const writes: (() => void)[] = [];
  let drawn = pen === 'marker' ? gridRules(root, face, seed, 0, writes) : 0;
  // The face's own box is coloured in once: the outermost element that paints it (a wrapper and a card inside it the
  // same size would streak twice).
  // An element with a hand-drawn body (SketchOverlay) has its box drawn and shaded already.
  let ownBoxDrawn = page || !!root.querySelector(':scope > svg[data-finish]');
  for (const el of parts) {
    if (drawn >= MARKER_FACE_MAX_PARTS) break;
    const faceBox =
      !ownBoxDrawn && el instanceof HTMLElement && (el === root || isFaceBox(el, face));
    const ink =
      el instanceof HTMLElement
        ? frameInk(el, face, seed, drawn, faceBox || el.hasAttribute(SHAPE_ATTR), pen)
        : isSvgShape(el)
          ? shapeInk(el, face, seed, drawn, pen)
          : null;
    if (ink) {
      drawn += 1;
      writes.push(ink.write);
    }
    if (ink?.part.role === 'shape' && faceBox) ownBoxDrawn = true;
  }
  return { writes, drawn };
}
