'use client';

import { useLayoutEffect, type RefObject } from 'react';
import {
  MARKER_FACE_BODY_SLACK_PX,
  MARKER_FACE_RULE_MIN_PX,
  faceBudgetSpent,
  isPillRect,
  markerFaceBudget,
  markerFacePart,
  markerFaceSeed,
  sketchFacePart,
  spendFaceBudget,
  type FacePartDrawing,
  type FacePartPaint,
  type FacePartShape,
  type Finish,
  type MarkerFaceBudget,
} from '@liveplanner/project';
import { trustedHtml } from '@liveplanner/ui';
import { watchUntilSettled } from '@liveworkspace/workbench/components/canvas/settle-watch';
import { isBoardHoverWrite } from '@/components/plan/board-hover';
import {
  DRAWN_ATTR,
  INK_ATTR,
  ISOLATED_ATTR,
  MEASURE_ATTR,
  PILL_ATTR,
  RULES_ATTR,
  SHAPE_ATTR,
  SVG_NS,
  TAKING_ATTR,
} from './face-finish-marks';
import { readGridRules, type Write } from './marker-grid-rules';

// A face's own parts in its finish on the canvas. Under Marker (docs/specs/008-canvas/finish.md "Marker", "Faces: frames and shapes"):
// once the face has settled, its frames (outlined HTML boxes) and its SVG shapes are read from the live DOM and
// described to markerFacePart, the same rules and drawing the export runs over its markup (svgMarkerFace). Each
// part's ink goes in beside the part itself: an <svg> inside a frame, a <g> after a shape, in the shape's own
// coordinates. So it moves with the part (a column that scrolls, a band that animates) and sits under whatever the
// face draws above the part (its words). The part's own line is hidden by app/face-finish.css through the mark set
// here. The ink is ours, not React's: React never sees it, and every take clears the last one first.

/** What the pass never reads into: the hand-drawn body, photos, embeds, kept parts and its own ink. */
const SKIP = `[data-finish="marker"], [data-finish-keep], [data-sketch-skip], [data-sketch-ink], [${INK_ATTR}], img, video, iframe, canvas, foreignObject, text`;
type Pen = 'marker' | 'pencil';
// Marker redraws a part; Sketch's pencil only shades a shape (its wobble draws the rest by hand).
const PEN_PART = { marker: markerFacePart, pencil: sketchFacePart } as const;
const SHAPE_TAGS = new Set(['rect', 'circle', 'ellipse', 'path', 'polygon', 'polyline', 'line']);

/** The face under `root` in its finish, re-taken whenever it settles after a change: Marker draws its frames and
 *  shapes in marker; Sketch shades its shapes in pencil; Professional keeps its SVG pills round (face-finish.css
 *  squares every other rectangle). */
export function useFaceFinishPass(
  rootRef: RefObject<HTMLElement | null>,
  finish: Finish | undefined,
  elementId: string,
  // A body that fills its tab or the screen (MaximisedPlanLayer's OverFace) is the page, not a box on it: its own box
  // is never coloured in.
  { page = false }: { page?: boolean } = {},
): void {
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root || finish === undefined || finish === 'flexible') return;
    const take =
      finish === 'professional'
        ? () => markFacePills(root)
        : () => drawMarkerFace(root, elementId, finish === 'marker' ? 'marker' : 'pencil', page);
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
      r.attributeName === TAKING_ATTR ||
      // The pointer's own feedback on a Plan board (a column's tint, a card's light): never a change to the face.
      isBoardHoverWrite(r) ||
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
  // The face is held still (no transitions) for the whole take (face-finish.css).
  root.setAttribute(TAKING_ATTR, '');
  try {
    clearMarkerFace(root);
    const face = { width: root.offsetWidth, height: root.offsetHeight };
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT, {
      acceptNode: (n) =>
        (n as Element).matches(SKIP) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT,
    });
    const parts: Element[] = [root];
    for (let n = walker.nextNode(); n; n = walker.nextNode()) parts.push(n as Element);
    // Sketch hides a live face's fills and lines (its ink copy shows them through the wobble, app/sketch-face.css):
    // they are shown again for the moment they are read.
    const measured = [...root.querySelectorAll('[data-sketch-words]')];
    for (const live of measured) live.setAttribute(MEASURE_ATTR, '');
    // Every part is read first and written after, so a part's ink going in never makes the next read lay the face
    // out again (on a 200-card board that was a layout per card).
    const writes: Write[] = [];
    let drawn = 0;
    try {
      drawn = readParts(root, parts, face, markerFaceSeed(elementId), pen, page, writes);
    } finally {
      for (const live of measured) live.removeAttribute(MEASURE_ATTR);
    }
    const marked = writes.map((write) => write());
    // The marks take effect while transitions are still held, or each part's own line would ease out from where the
    // clear left it instead of going at once.
    for (const el of marked) if (el) void getComputedStyle(el).color;
    return drawn;
  } finally {
    root.removeAttribute(TAKING_ATTR);
  }
}

function readParts(
  root: HTMLElement,
  parts: readonly Element[],
  face: { width: number; height: number },
  seed: number,
  pen: Pen,
  page: boolean,
  writes: Write[],
): number {
  // A face draws at most MARKER_FACE_MAX_PARTS shapes and lines and MARKER_FACE_MAX_FRAMES frames.
  const budget = markerFaceBudget();
  let drawn = pen === 'marker' ? readGridRules(root, face, seed, writes, budget) : 0;
  // The face's own box is coloured in once: the outermost element that paints it (a wrapper and a card inside it the
  // same size would streak twice).
  // An element with a hand-drawn body (SketchOverlay) has its box drawn and shaded already.
  let ownBoxDrawn = page || !!root.querySelector(':scope > svg[data-finish]');
  // How many parts each keyed owner has drawn so far this take (partIndex).
  const owned = new Map<string, number>();
  for (const el of parts) {
    if (faceBudgetSpent(budget)) break;
    const faceBox =
      !ownBoxDrawn && el instanceof HTMLElement && (el === root || isFaceBox(el, face));
    const owner = ownerKey(root, el);
    const count = owned.get(owner) ?? 0;
    const index = ownerBase(owner) + count;
    const ink =
      el instanceof HTMLElement
        ? frameInk(el, face, seed, index, budget, faceBox || el.hasAttribute(SHAPE_ATTR), pen)
        : isSvgShape(el)
          ? shapeInk(el, face, seed, index, budget, pen)
          : null;
    const part = ink?.part;
    if (ink) {
      writes.push(ink.write);
      spendFaceBudget(budget, ink.part.role);
      drawn += 1;
      owned.set(owner, count + 1);
    }
    if (part?.role === 'shape' && faceBox) ownBoxDrawn = true;
  }
  return drawn;
}

// What a part's stroke is seeded by (docs/specs/008-canvas/finish.md "Marker"): the card or column it sits in and its
// order among that owner's drawn parts, not its place in the whole face. So a part appearing or going elsewhere (a
// column's hover controls, a card dragged to another column) leaves every other part's ink as it was, and a re-take
// draws the same strokes instead of a fresh wobble on every card (which read as the borders flashing).
const OWNER = '[data-plan-card], [data-plan-column], [data-marker-key]';
function ownerKey(root: Element, el: Element): string {
  const owner = el.closest(OWNER);
  if (!owner || !root.contains(owner)) return '';
  const card = owner.getAttribute('data-plan-card');
  if (card) return `card:${card}`;
  const marked = owner.getAttribute('data-marker-key');
  if (marked) return `key:${marked}`;
  return `col:${owner.getAttribute('data-plan-column') ?? ''}|${owner.getAttribute('data-plan-lane') ?? ''}`;
}
// A 32-bit FNV-1a of the owner's key, spread so owners' indices never meet.
function ownerBase(key: string): number {
  if (!key) return 0;
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 0x01000193);
  return (h >>> 0) & 0x7fff0000;
}

/** A part read and drawn, and how its ink goes in once every part is read. */
type Ink = { part: FacePartDrawing; write: Write };

// An inset hairline ring (`box-shadow: <colour> 0 0 0 <n>px inset`), the frame some faces draw instead of a border.
function insetRing(shadow: string): { colour: string; px: number } | null {
  const m = /^(rgba?\([^)]*\)|#[0-9a-f]+)\s+0px\s+0px\s+0px\s+([\d.]+)px\s+inset$/i.exec(
    shadow.trim(),
  );
  return m ? { colour: m[1]!, px: Number(m[2]) } : null;
}

// A box the size of the face (a banner's or a site header's coloured card, a tab window's sheet): the face's own box,
// whichever element paints it.
function isFaceBox(el: HTMLElement, face: { width: number; height: number }): boolean {
  return (
    Math.abs(el.offsetWidth - face.width) <= MARKER_FACE_BODY_SLACK_PX &&
    Math.abs(el.offsetHeight - face.height) <= MARKER_FACE_BODY_SLACK_PX
  );
}

// An outlined HTML box: its marker outline in an <svg> laid over its border box, inside it so it scrolls and clips
// with it. A static box is not a containing block for the ink, so it keeps its plain border.
function frameInk(
  el: HTMLElement,
  face: { width: number; height: number },
  seed: number,
  index: number,
  budget: MarkerFaceBudget,
  // The face's own box: a fill alone gives it a marker edge (a banner, a timer), as a border does.
  own = false,
  pen: Pen = 'marker',
): Ink | null {
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
  // A hairline drawn as an inset ring (a tab window's frame) is an outline too.
  const ring = bordered ? null : insetRing(css.boxShadow);
  if (!bordered && !ring && !own) return null;
  const rx = parseFloat(css.borderTopLeftRadius) || 0;
  const round = isPillRect(w, h, rx);
  // A round part is a pill (left plain), unless it is the face's own (an annotation's disc, a progress bar's track) or
  // marked a shape: a marker circle, or a pill.
  if (round && !own) return null;
  const disc = round && Math.abs(w - h) <= 2;
  const inset = 2;
  const part = PEN_PART[pen](
    disc
      ? { kind: 'ellipse', cx: w / 2, cy: h / 2, rx: w / 2 - inset, ry: h / 2 - inset }
      : {
          kind: 'rect',
          x: inset,
          y: inset,
          width: w - 2 * inset,
          height: h - 2 * inset,
          rx: round ? (h - 2 * inset) / 2 : rx,
        },
    {
      // A part painted with a gradient names its colour (`data-marker-fill`).
      fill: el.getAttribute('data-marker-fill') ?? css.backgroundColor,
      stroke: bordered ? css.borderTopColor : (ring?.colour ?? null),
      strokePx: bordered ? parseFloat(css.borderTopWidth) : (ring?.px ?? 0),
      ...(el.hasAttribute(SHAPE_ATTR) ? { shape: true } : {}),
    },
    face,
    seed,
    index,
    budget,
  );
  // A box is outlined (a frame) or, when it is the face's own, coloured in (a shape); never a bare line.
  if (!part || part.role === 'line' || (part.role === 'shape' && !own)) return null;
  // A coloured-in box's streaks go under its contents, as a shape's go under its label: the box becomes its own
  // stacking context (isolation, set and cleared by this pass) and the ink sits at its back, over its own background.
  // A frame's outline is its edge, over everything.
  const under = part.role === 'shape';
  const isolate = under && css.isolation !== 'isolate';
  const left = -parseFloat(css.borderLeftWidth);
  const top = -parseFloat(css.borderTopWidth);
  // Its own line gives way to the ink (face-finish.css): a border, or a ring (`ring`, which drops that shadow only).
  const drawnAs = pen === 'marker' && (bordered || ring) ? (ring ? 'ring' : part.role) : null;
  return {
    part,
    write: () => {
      const svg = document.createElementNS(SVG_NS, 'svg');
      svg.setAttribute(INK_ATTR, '');
      svg.setAttribute('aria-hidden', 'true');
      svg.setAttribute('width', String(w));
      svg.setAttribute('height', String(h));
      if (isolate) {
        el.style.isolation = 'isolate';
        el.setAttribute(ISOLATED_ATTR, '');
      }
      svg.style.cssText = `position:absolute;left:${left}px;top:${top}px;overflow:visible;pointer-events:none${
        under ? ';z-index:-1' : ''
      }`;
      svg.innerHTML = trustedHtml(part.svg) as string;
      if (drawnAs) el.setAttribute(DRAWN_ATTR, drawnAs);
      el.appendChild(svg);
      return drawnAs ? el : null;
    },
  };
}

// An SVG shape: its marker drawing in a <g> straight after it, in its own coordinates (and its own transform).
function shapeInk(
  el: SVGGeometryElement,
  face: { width: number; height: number },
  seed: number,
  index: number,
  budget: MarkerFaceBudget,
  pen: Pen = 'marker',
): Ink | null {
  const css = getComputedStyle(el);
  if (css.markerStart !== 'none' || css.markerEnd !== 'none') return null;
  const shape = shapeOf(el);
  if (!shape) return null;
  const paint: FacePartPaint = {
    fill: css.fill,
    stroke: css.stroke,
    strokePx: css.stroke === 'none' ? 0 : parseFloat(css.strokeWidth) || 0,
    ...(Number(css.opacity) < 1 ? { opacity: Number(css.opacity) } : {}),
    ...(css.strokeDasharray && css.strokeDasharray !== 'none' ? { dashed: true } : {}),
  };
  const part = PEN_PART[pen](shape, paint, face, seed, index, budget);
  if (!part) return null;
  return {
    part,
    write: () => {
      const g = document.createElementNS(SVG_NS, 'g');
      g.setAttribute(INK_ATTR, '');
      const transform = el.getAttribute('transform');
      if (transform) g.setAttribute('transform', transform);
      g.innerHTML = trustedHtml(part.svg) as string;
      if (pen === 'marker') el.setAttribute(DRAWN_ATTR, part.role);
      el.after(g);
      return pen === 'marker' ? el : null;
    },
  };
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
  if (el instanceof SVGLineElement) {
    // A straight rule counts only at a marker's weight (a timeline's spine); axes and grid lines stay plain.
    if ((parseFloat(getComputedStyle(el).strokeWidth) || 0) < MARKER_FACE_RULE_MIN_PX) return null;
    return {
      kind: 'polyline',
      points: [
        { x: el.x1.baseVal.value, y: el.y1.baseVal.value },
        { x: el.x2.baseVal.value, y: el.y2.baseVal.value },
      ],
    };
  }
  if (el instanceof SVGPolygonElement || el instanceof SVGPolylineElement) {
    const points = Array.from(el.points, (p) => ({ x: p.x, y: p.y }));
    const kind = el instanceof SVGPolygonElement ? 'polygon' : 'polyline';
    return points.length >= 2 ? { kind, points } : null;
  }
  const d = el.getAttribute('d');
  return d ? { kind: 'path', d } : null;
}
