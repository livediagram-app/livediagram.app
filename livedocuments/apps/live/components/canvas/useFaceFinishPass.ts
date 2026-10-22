'use client';

import { useLayoutEffect, type RefObject } from 'react';
import {
  MARKER_FACE_BODY_SLACK_PX,
  MARKER_FACE_MAX_PARTS,
  MARKER_FACE_RULE_MIN_PX,
  handDrawnInk,
  isPillRect,
  markerFacePart,
  markerFaceSeed,
  sketchFacePart,
  type FacePartDrawing,
  type FacePartPaint,
  type FacePartShape,
  type Finish,
} from '@livedocuments/document';
import { trustedHtml } from '@livedocuments/ui';
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
  // Sketch hides a live face's fills and lines (its ink copy shows them through the wobble, app/sketch-face.css):
  // they are shown again for the moment they are read.
  const measured = [...root.querySelectorAll('[data-sketch-words]')];
  for (const live of measured) live.setAttribute(MEASURE_ATTR, '');
  try {
    drawn = drawParts(root, parts, face, seed, drawn, pen, page);
  } finally {
    for (const live of measured) live.removeAttribute(MEASURE_ATTR);
  }
  return drawn;
}

function drawParts(
  root: HTMLElement,
  parts: readonly Element[],
  face: { width: number; height: number },
  seed: number,
  drawn: number,
  pen: Pen,
  page: boolean,
): number {
  if (pen === 'marker') drawn += drawGridRules(root, face, seed, drawn);
  // The face's own box is coloured in once: the outermost element that paints it (a wrapper and a card inside it the
  // same size would streak twice).
  // An element with a hand-drawn body (SketchOverlay) has its box drawn and shaded already.
  let ownBoxDrawn = page || !!root.querySelector(':scope > svg[data-finish]');
  for (const el of parts) {
    if (drawn >= MARKER_FACE_MAX_PARTS) break;
    const faceBox =
      !ownBoxDrawn && el instanceof HTMLElement && (el === root || isFaceBox(el, face));
    const part =
      el instanceof HTMLElement
        ? frameInk(el, face, seed, drawn, faceBox || el.hasAttribute(SHAPE_ATTR), pen)
        : isSvgShape(el)
          ? shapeInk(el, face, seed, drawn, pen)
          : null;
    if (part) drawn += 1;
    if (part?.role === 'shape' && faceBox) ownBoxDrawn = true;
  }
  return drawn;
}

/** Shows a Sketch face's hidden fills and lines while the pass reads them (app/sketch-face.css). */
const MEASURE_ATTR = 'data-sketch-measure';
/** Marks a part a face wants drawn as a shape whatever its size or roundness (a progress bar's track and fill). */
const SHAPE_ATTR = 'data-marker-shape';
/** Marks a box this pass made its own stacking context, so its colouring can sit under its contents. */
const ISOLATED_ATTR = 'data-marker-isolated';
/** Marks a grid cell's sides whose border the grid's marker rules replace (`r`, `b`: face-finish.css). */
const RULES_ATTR = 'data-marker-rules';

// A grid's rules (a table's cell borders, inside `[data-marker-grid]`): each cell draws only its right and bottom
// border, so a row or column line is many short pieces. They are joined into whole rules, one per line, each
// drawn in one marker stroke in an <svg> over the face, and the pieces hidden. Returns how many rules it drew.
function drawGridRules(
  root: HTMLElement,
  face: { width: number; height: number },
  seed: number,
  first: number,
): number {
  type Piece = { at: number; from: number; to: number; colour: string; px: number };
  const vertical = new Map<string, Piece[]>();
  const horizontal = new Map<string, Piece[]>();
  for (const grid of root.querySelectorAll<HTMLElement>('[data-marker-grid]')) {
    for (const cell of grid.querySelectorAll<HTMLElement>('*')) {
      const at = offsetIn(cell, root);
      if (!at) continue;
      const css = getComputedStyle(cell);
      const sides: string[] = [];
      const see = (
        side: 'right' | 'bottom',
        map: Map<string, Piece[]>,
        piece: Omit<Piece, 'colour' | 'px'>,
      ) => {
        const px = parseFloat(css.getPropertyValue(`border-${side}-width`)) || 0;
        const colour = css.getPropertyValue(`border-${side}-color`);
        if (px <= 0 || css.getPropertyValue(`border-${side}-style`) === 'none') return;
        const key = `${Math.round(piece.at)}|${colour}`;
        map.set(key, [...(map.get(key) ?? []), { ...piece, colour, px }]);
        sides.push(side[0]!);
      };
      see('right', vertical, {
        at: at.x + cell.offsetWidth,
        from: at.y,
        to: at.y + cell.offsetHeight,
      });
      see('bottom', horizontal, {
        at: at.y + cell.offsetHeight,
        from: at.x,
        to: at.x + cell.offsetWidth,
      });
      if (sides.length > 0) cell.setAttribute(RULES_ATTR, sides.join(' '));
    }
  }
  const ink: string[] = [];
  let drawn = 0;
  const rule = (pieces: Piece[], vertical: boolean) => {
    pieces.sort((a, b) => a.from - b.from);
    const draw = (run: Piece) => {
      if (first + drawn >= MARKER_FACE_MAX_PARTS) return;
      const a = vertical ? { x: run.at, y: run.from } : { x: run.from, y: run.at };
      const b = vertical ? { x: run.at, y: run.to } : { x: run.to, y: run.at };
      const part = markerFacePart(
        { kind: 'polyline', points: [a, b] },
        { fill: null, stroke: handDrawnInk(run.colour, null), strokePx: run.px },
        face,
        seed,
        first + drawn,
      );
      if (part) {
        ink.push(part.svg);
        drawn += 1;
      }
    };
    // Pieces that touch (within 2 px) are one rule.
    let run: Piece | undefined;
    for (const p of pieces) {
      if (run && p.from <= run.to + 2) run.to = Math.max(run.to, p.to);
      else {
        if (run) draw(run);
        run = { ...p };
      }
    }
    if (run) draw(run);
  };
  for (const pieces of vertical.values()) rule(pieces, true);
  for (const pieces of horizontal.values()) rule(pieces, false);
  if (ink.length === 0) return 0;
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute(INK_ATTR, '');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('width', String(face.width));
  svg.setAttribute('height', String(face.height));
  svg.style.cssText = 'position:absolute;left:0;top:0;overflow:visible;pointer-events:none';
  svg.innerHTML = trustedHtml(ink.join('')) as string;
  root.appendChild(svg);
  return drawn;
}

// An element's place in `root`, through its offset parents (layout px, so a zoom or a rotation of the element does
// not move it); null when `root` is not among them.
function offsetIn(el: HTMLElement, root: HTMLElement): { x: number; y: number } | null {
  let x = 0;
  let y = 0;
  let at: HTMLElement | null = el;
  while (at && at !== root) {
    x += at.offsetLeft;
    y += at.offsetTop;
    const parent: Element | null = at.offsetParent;
    if (parent === root) return { x, y };
    at = parent instanceof HTMLElement && root.contains(parent) ? parent : null;
  }
  return at === root ? { x, y } : null;
}

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
  // The face's own box: a fill alone gives it a marker edge (a banner, a timer), as a border does.
  own = false,
  pen: Pen = 'marker',
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
  );
  // A box is outlined (a frame) or, when it is the face's own, coloured in (a shape); never a bare line.
  if (!part || part.role === 'line' || (part.role === 'shape' && !own)) return null;
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute(INK_ATTR, '');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('width', String(w));
  svg.setAttribute('height', String(h));
  // A coloured-in box's streaks go under its contents, as a shape's go under its label: the box becomes its own
  // stacking context (isolation, set and cleared by this pass) and the ink sits at its back, over its own background.
  // A frame's outline is its edge, over everything.
  const under = part.role === 'shape';
  if (under && css.isolation !== 'isolate') {
    el.style.isolation = 'isolate';
    el.setAttribute(ISOLATED_ATTR, '');
  }
  svg.style.cssText = `position:absolute;left:${-parseFloat(css.borderLeftWidth)}px;top:${-parseFloat(
    css.borderTopWidth,
  )}px;overflow:visible;pointer-events:none${under ? ';z-index:-1' : ''}`;
  svg.innerHTML = trustedHtml(part.svg) as string;
  // Its own line gives way to the ink (face-finish.css): a border, or a ring (`ring`, which drops that shadow only).
  if (pen === 'marker' && (bordered || ring))
    el.setAttribute(DRAWN_ATTR, ring ? 'ring' : part.role);
  el.appendChild(svg);
  return part;
}

// An SVG shape: its marker drawing in a <g> straight after it, in its own coordinates (and its own transform).
function shapeInk(
  el: SVGGeometryElement,
  face: { width: number; height: number },
  seed: number,
  index: number,
  pen: Pen = 'marker',
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
    ...(css.strokeDasharray && css.strokeDasharray !== 'none' ? { dashed: true } : {}),
  };
  const part = PEN_PART[pen](shape, paint, face, seed, index);
  if (!part) return null;
  const g = document.createElementNS(SVG_NS, 'g');
  g.setAttribute(INK_ATTR, '');
  const transform = el.getAttribute('transform');
  if (transform) g.setAttribute('transform', transform);
  g.innerHTML = trustedHtml(part.svg) as string;
  if (pen === 'marker') el.setAttribute(DRAWN_ATTR, part.role);
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
