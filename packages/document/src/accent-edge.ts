// The accent edge (docs/specs/008-canvas/accent-edge.md): a coloured bar along the left, top or bottom of a box
// shape, clipped to its outline. Pure geometry + the export's markup, so the canvas overlay and every export draw
// the same bar from the same numbers.
//
// A LEAF module (types only from './index'), so the renderers can import it without walking the barrel.

import { clamp, type Rect } from './geometry-primitives';
import type { Element, ShapeElement } from './index';
import { r2, xmlEscape } from './svg-render-primitives';

export type AccentEdge = 'left' | 'top' | 'bottom';

export const ACCENT_EDGES: readonly AccentEdge[] = ['left', 'top', 'bottom'];

// The box shapes whose outline has a straight edge to lay a bar along.
const ACCENT_EDGE_SHAPES: ReadonlySet<string> = new Set(['square', 'stadium', 'card', 'mind-node']);

const ACCENT_EDGE_MIN_PX = 3;
const ACCENT_EDGE_MAX_PX = 6;
const ACCENT_EDGE_SHARE = 0.06;

export function isAccentEdge(v: unknown): v is AccentEdge {
  return v === 'left' || v === 'top' || v === 'bottom';
}

export function supportsAccentEdge(el: { type: string; shape?: string }): boolean {
  return el.type === 'shape' && el.shape !== undefined && ACCENT_EDGE_SHAPES.has(el.shape);
}

/** The edge an element draws: its own when its kind takes one and the value is known, else none. */
export function resolvedAccentEdge(el: Element): AccentEdge | null {
  if (el.type !== 'shape' || !supportsAccentEdge(el)) return null;
  return isAccentEdge(el.accentEdge) ? el.accentEdge : null;
}

/** The bar's thickness in element px: a share of the shorter side, held between 3 and 6. */
export function accentEdgeThickness(width: number, height: number): number {
  return clamp(Math.min(width, height) * ACCENT_EDGE_SHARE, ACCENT_EDGE_MIN_PX, ACCENT_EDGE_MAX_PX);
}

/** The bar in the inner box (inside the border), origin at its top-left. The thickness follows the element's
 *  own size, so a border change never changes the bar. */
export function accentEdgeRect(
  edge: AccentEdge,
  width: number,
  height: number,
  thickness: number = accentEdgeThickness(width, height),
): Rect {
  const t = Math.min(thickness, edge === 'left' ? width : height);
  if (edge === 'left') return { x: 0, y: 0, width: t, height };
  if (edge === 'top') return { x: 0, y: 0, width, height: t };
  return { x: 0, y: height - t, width, height: t };
}

/** The bar's colour: its own, else the border's as drawn. */
export function accentEdgeColour(el: ShapeElement, drawnStroke: string): string {
  return el.accentEdgeColor ?? drawnStroke;
}

/**
 * The export's bar: a rect clipped to the inner box's rounded outline. `radius` is the outer corner radius the box
 * is drawn with and `borderWidth` its border, so the clip follows the inside of the border exactly as the canvas's
 * `overflow: hidden` inside a CSS border does. Empty when the element draws no edge.
 */
export function svgAccentEdge(
  el: ShapeElement,
  o: { stroke: string; borderWidth: number; radius: number },
): string {
  const edge = resolvedAccentEdge(el);
  if (!edge) return '';
  const bw = Math.max(0, o.borderWidth);
  const x = el.x + bw;
  const y = el.y + bw;
  const w = Math.max(0, el.width - bw * 2);
  const h = Math.max(0, el.height - bw * 2);
  if (w === 0 || h === 0) return '';
  const rx = Math.max(0, Math.min(o.radius - bw, Math.min(w, h) / 2));
  const bar = accentEdgeRect(edge, w, h, accentEdgeThickness(el.width, el.height));
  const id = `lvd-ae-${el.id.replace(/[^A-Za-z0-9_-]/g, '')}`;
  return (
    `<clipPath id="${id}"><rect x="${r2(x)}" y="${r2(y)}" width="${r2(w)}" height="${r2(h)}" rx="${r2(rx)}"/></clipPath>` +
    `<rect x="${r2(x + bar.x)}" y="${r2(y + bar.y)}" width="${r2(bar.width)}" height="${r2(bar.height)}"` +
    ` fill="${xmlEscape(accentEdgeColour(el, o.stroke))}" clip-path="url(#${id})"/>`
  );
}

/** Set (or clear, with `null`) the edge on an element that takes one; any other element comes back unchanged. */
export function withAccentEdge<T extends Element>(el: T, edge: AccentEdge | null): T {
  if (el.type !== 'shape' || !supportsAccentEdge(el)) return el;
  const next = { ...el } as T & { accentEdge?: AccentEdge };
  if (edge) next.accentEdge = edge;
  else delete next.accentEdge;
  return next;
}

/** Set (or clear, with `null`, back to the border's colour) the edge's own colour, on an element that takes one. */
export function withAccentEdgeColor<T extends Element>(el: T, colour: string | null): T {
  if (el.type !== 'shape' || !supportsAccentEdge(el)) return el;
  const next = { ...el } as T & { accentEdgeColor?: string };
  if (colour) next.accentEdgeColor = colour;
  else delete next.accentEdgeColor;
  return next;
}
