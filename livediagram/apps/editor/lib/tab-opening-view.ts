// The view a tab lands on by itself: on a tab entry, a template or an import (docs/specs/008-canvas/canvas-and-palette.md
// "On a phone the opening view focuses on the main element"). Off a phone it is Fit to Screen. On a phone a
// fit-all of a real diagram is too small to read, so unless the whole tab already fits at a readable zoom the view
// centres on the tab's main element at a usable zoom, and the person pans from there.

import { isBoxed, type BoxedElement, type Element } from '@livediagram/document';
import { isMobileViewportSync } from '@liveworkspace/workbench/lib/responsive';
import { computeFitToScreen } from '@liveworkspace/workbench/lib/viewport';
import type { ViewPose } from '@liveworkspace/workbench/lib/viewport-glide';
import { fitPadding, tabFitView } from './tab-fit-view';

type Box = { x: number; y: number; width: number; height: number };

// The phone's readable zoom: a fit-all at or above it is kept, and the focus view never goes below it. The same 60%
// the canvas starts at on a phone (hooks/canvas/useEditorViewport MOBILE_DEFAULT_ZOOM).
export const PHONE_READABLE_ZOOM = 0.6;
// The focus view never zooms past 100%: a small main element does not fill the screen.
export const PHONE_FOCUS_MAX_ZOOM = 1;
// A candidate covering more than this share of the content's box is a frame, a lane or a backdrop, not the subject.
const BACKDROP_SHARE = 0.5;

// Kinds that are never the subject of a diagram: a title or caption, a callout, a pen stroke.
const NOT_MAIN = new Set<Element['type']>(['text', 'annotation', 'freehand']);

/**
 * The tab's main element: the candidate with the most pinned arrow ends, ties (and boards with no pinned arrows)
 * going to the candidate whose centre is nearest the area-weighted centre of all candidates. Text, annotations,
 * freehand and anything covering over half the content's box are not candidates, unless that leaves none.
 * Linear in the element count. Comes with the content's box (every boxed element). Null when the tab has no boxed
 * element.
 */
export function pickMainElement(
  elements: readonly Element[],
): { element: BoxedElement; content: Box } | null {
  // One pass: the boxed elements, the content's box, and how many pinned arrow ends land on each element.
  const boxed: BoxedElement[] = [];
  const degree = new Map<string, number>();
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const el of elements) {
    if (el.type === 'arrow') {
      for (const end of [el.from, el.to]) {
        if (end.kind === 'pinned') degree.set(end.elementId, (degree.get(end.elementId) ?? 0) + 1);
      }
      continue;
    }
    if (!isBoxed(el)) continue;
    boxed.push(el);
    minX = Math.min(minX, el.x);
    minY = Math.min(minY, el.y);
    maxX = Math.max(maxX, el.x + el.width);
    maxY = Math.max(maxY, el.y + el.height);
  }
  if (boxed.length === 0) return null;
  const contentArea = (maxX - minX) * (maxY - minY);
  const isCandidate = (el: BoxedElement) =>
    !NOT_MAIN.has(el.type) &&
    // A lone element is never its own backdrop.
    (boxed.length === 1 || el.width * el.height <= contentArea * BACKDROP_SHARE);
  let candidates = boxed.filter(isCandidate);
  if (candidates.length === 0) candidates = boxed;

  // The area-weighted centre of the candidates (each weighs at least 1, so zero-sized ones still count).
  let sumW = 0;
  let sumX = 0;
  let sumY = 0;
  for (const el of candidates) {
    const w = Math.max(1, el.width * el.height);
    sumW += w;
    sumX += (el.x + el.width / 2) * w;
    sumY += (el.y + el.height / 2) * w;
  }
  const cx = sumX / sumW;
  const cy = sumY / sumW;

  let best = candidates[0]!;
  let bestDegree = -1;
  let bestDist = Infinity;
  for (const el of candidates) {
    const d = degree.get(el.id) ?? 0;
    const dist = Math.hypot(el.x + el.width / 2 - cx, el.y + el.height / 2 - cy);
    if (d > bestDegree || (d === bestDegree && dist < bestDist)) {
      best = el;
      bestDegree = d;
      bestDist = dist;
    }
  }
  return { element: best, content: { x: minX, y: minY, width: maxX - minX, height: maxY - minY } };
}

/**
 * Centre on `main` at the zoom that fits it with `padding`, clamped to the phone's readable range, then pull the
 * centre toward `content` on each axis so the padded screen stays inside the content where the content is larger.
 */
export function focusView(
  size: { width: number; height: number },
  content: Box,
  main: Box,
  padding: number,
): ViewPose {
  const fitMain = computeFitToScreen(size, main, PHONE_FOCUS_MAX_ZOOM, padding).zoom;
  const zoom = Math.max(PHONE_READABLE_ZOOM, fitMain);
  const axis = (start: number, span: number, at: number, screen: number) => {
    const visible = Math.max(0, screen - 2 * padding) / zoom;
    if (visible >= span) return start + span / 2;
    return Math.min(Math.max(at, start + visible / 2), start + span - visible / 2);
  };
  const px = axis(content.x, content.width, main.x + main.width / 2, size.width);
  const py = axis(content.y, content.height, main.y + main.height / 2, size.height);
  return { zoom, offset: { x: size.width / 2 - px, y: size.height / 2 - py } };
}

/** The view a tab lands on by itself. Null when the canvas cannot be measured, as for tabFitView. */
export function tabOpeningView(
  canvas: HTMLElement | null,
  elements: Element[],
  phone: boolean = isMobileViewportSync(),
): ViewPose | null {
  const fit = tabFitView(canvas, elements);
  if (!phone || !fit || !canvas || fit.zoom >= PHONE_READABLE_ZOOM) return fit;
  const main = pickMainElement(elements);
  if (!main) return fit;
  const box = canvas.getBoundingClientRect();
  return focusView(
    { width: box.width, height: box.height },
    main.content,
    main.element,
    fitPadding(box),
  );
}
