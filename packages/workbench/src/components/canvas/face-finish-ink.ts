'use client';

// How the face finish pass (useFaceFinishPass.ts) reads and inks one face's parts: its marks, a frame's or an SVG
// shape's ink beside it, and a table's grid rules drawn once across its cells. DOM reads and writes only, no React.

import {
  MARKER_FACE_BODY_SLACK_PX,
  MARKER_FACE_MAX_PARTS,
  MARKER_FACE_RULE_MIN_PX,
  handDrawnInk,
  markerFacePart,
  sketchFacePart,
  type FacePartDrawing,
  type FacePartPaint,
  type FacePartShape,
} from '@liveworkspace/element-model/marker-face';
import { isPillRect } from '@liveworkspace/model-core/face-finish';
import { builtMarkup, setHtml } from '@liveworkspace/trusted-types';

const SVG_NS = 'http://www.w3.org/2000/svg';
/** The ink this pass adds; everything carrying it is removed before each take. */
export const INK_ATTR = 'data-marker-ink';
/** Marks a part whose line the ink replaces: `frame`, `shape` or `line` (face-finish.css). */
export const DRAWN_ATTR = 'data-marker-drawn';
/** Marks an SVG rectangle whose ends are round, which Professional keeps round (face-finish.css). */
export const PILL_ATTR = 'data-finish-pill';
/** Set on the face's root while a take reads and marks it: face-finish.css holds every transition under it still, so a
 *  part's line reads as it rests (not mid-ease from the mark the take just cleared) and the new marks land at once. */
export const TAKING_ATTR = 'data-marker-taking';
/** Marks a face's hover chrome (a table's add-row and add-column triggers): shown and hidden as the pointer moves, so
 *  the pass neither reads into it nor takes the face again when it comes and goes. */
export const HOVER_ATTR = 'data-face-hover';
/** What the pass never reads into: the hand-drawn body, photos, embeds, kept parts, hover chrome and its own ink. */
export const SKIP = `[data-finish="marker"], [data-finish-keep], [data-sketch-skip], [data-sketch-ink], [${HOVER_ATTR}], [${INK_ATTR}], img, video, iframe, canvas, foreignObject, text`;
/** A part's ink going in: what it marked (each mark's style is read before the face is released, so the mark takes
 *  effect with transitions still held), or null when it marked nothing. */
export type Write = () => Element | readonly Element[] | null;
export type Pen = 'marker' | 'pencil';
// Marker redraws a part; Sketch's pencil only shades a shape (its wobble draws the rest by hand).
const PEN_PART = { marker: markerFacePart, pencil: sketchFacePart } as const;
const SHAPE_TAGS = new Set(['rect', 'circle', 'ellipse', 'path', 'polygon', 'polyline', 'line']);

/** Shows a Sketch face's hidden fills and lines while the pass reads them (app/sketch-face.css). */
export const MEASURE_ATTR = 'data-sketch-measure';
/** Marks a part a face wants drawn as a shape whatever its size or roundness (a progress bar's track and fill). */
export const SHAPE_ATTR = 'data-marker-shape';
/** Marks a box this pass made its own stacking context, so its colouring can sit under its contents. */
export const ISOLATED_ATTR = 'data-marker-isolated';
/** Marks a grid cell's sides whose border the grid's marker rules replace (`r`, `b`: face-finish.css). */
export const RULES_ATTR = 'data-marker-rules';

// A grid's rules (a table's cell borders, inside `[data-marker-grid]`): each cell draws only its right and bottom
// border, so a row or column line is many short pieces. They are joined into whole rules, one per line, each
// drawn in one marker stroke in an <svg> over the face, and the pieces hidden. Reads only: the drawing and the hiding
// go in `writes`. Returns how many rules it draws.
export function gridRules(
  root: HTMLElement,
  face: { width: number; height: number },
  seed: number,
  first: number,
  writes: Write[],
): number {
  type Piece = { at: number; from: number; to: number; colour: string; px: number };
  const vertical = new Map<string, Piece[]>();
  const horizontal = new Map<string, Piece[]>();
  // The cells whose sides the rules replace, marked when the rules are drawn.
  const ruled: [HTMLElement, string][] = [];
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
      if (sides.length > 0) ruled.push([cell, sides.join(' ')]);
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
  writes.push(() => {
    for (const [cell, sides] of ruled) cell.setAttribute(RULES_ATTR, sides);
    const marked = ruled.map(([cell]) => cell);
    if (ink.length === 0) return marked;
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute(INK_ATTR, '');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('width', String(face.width));
    svg.setAttribute('height', String(face.height));
    svg.style.cssText = 'position:absolute;left:0;top:0;overflow:visible;pointer-events:none';
    setHtml(svg, builtMarkup(ink.join('')));
    root.appendChild(svg);
    return marked;
  });
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
export function isFaceBox(el: HTMLElement, face: { width: number; height: number }): boolean {
  return (
    Math.abs(el.offsetWidth - face.width) <= MARKER_FACE_BODY_SLACK_PX &&
    Math.abs(el.offsetHeight - face.height) <= MARKER_FACE_BODY_SLACK_PX
  );
}

/** A part read for drawing, and the write that draws it. */
type PartInk = { part: FacePartDrawing; write: Write };

// An outlined HTML box: its marker outline in an <svg> laid over its border box, inside it so it scrolls and clips
// with it. A static box is not a containing block for the ink, so it keeps its plain border.
export function frameInk(
  el: HTMLElement,
  face: { width: number; height: number },
  seed: number,
  index: number,
  // The face's own box: a fill alone gives it a marker edge (a banner, a timer), as a border does.
  own = false,
  pen: Pen = 'marker',
): PartInk | null {
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
      svg.style.cssText = `position:absolute;left:${left}px;top:${top}px;overflow:visible;pointer-events:none${under ? ';z-index:-1' : ''}`;
      setHtml(svg, builtMarkup(part.svg));
      if (drawnAs) el.setAttribute(DRAWN_ATTR, drawnAs);
      el.appendChild(svg);
      return drawnAs ? el : null;
    },
  };
}

// An SVG shape: its marker drawing in a <g> straight after it, in its own coordinates (and its own transform).
export function shapeInk(
  el: SVGGeometryElement,
  face: { width: number; height: number },
  seed: number,
  index: number,
  pen: Pen = 'marker',
): PartInk | null {
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
  return {
    part,
    write: () => {
      const g = document.createElementNS(SVG_NS, 'g');
      g.setAttribute(INK_ATTR, '');
      const transform = el.getAttribute('transform');
      if (transform) g.setAttribute('transform', transform);
      setHtml(g, builtMarkup(part.svg));
      if (pen === 'marker') el.setAttribute(DRAWN_ATTR, part.role);
      el.after(g);
      return pen === 'marker' ? el : null;
    },
  };
}

// An SVG shape the pass reads (jsdom has no SVGGeometryElement, so it reads none there).
export function isSvgShape(el: Element): el is SVGGeometryElement {
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
