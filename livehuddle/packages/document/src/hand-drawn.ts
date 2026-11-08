// The hand-drawn finishes (docs/specs/008-canvas/finish.md "Sketch", "Marker") behind one door: an element's body
// in whichever pen its finish draws with, Sketch's pencil (sketch-element.ts) or Marker's felt-tip
// (marker-element.ts). The canvas and every export call these, so the two pens cannot drift apart between them.
import { finishDrawsBodyByHand, type Finish } from './finish';
import type { BoxedElement } from './index';
import { markerElementPaint } from './marker-element';
import { handDrawnImagePaint } from './drawn-outline-finish';
import { sketchElementPaint } from './sketch-element';

/** An element's hand-drawn body: the drawing (`drawing.pen` says whose), and the width and dash its outline takes. */
export type HandDrawnPaint =
  | NonNullable<ReturnType<typeof sketchElementPaint>>
  | NonNullable<ReturnType<typeof markerElementPaint>>;

/** An element's body in its hand-drawn finish, or null when its finish draws it as it is. */
export function handDrawnElementPaint(
  el: BoxedElement,
  finish: Finish,
  fill: string,
  // Something sits on this shape (sketch-backdrop.ts): a solid fill, never shading.
  backdrop = false,
): HandDrawnPaint | null {
  // A sticky's paper is never redrawn by Marker (finishDrawsBodyByHand), but it is coloured in.
  if (finish === 'marker' && el.type === 'sticky') return markerElementPaint(el, fill, backdrop);
  if (!finishDrawsBodyByHand(finish, el.type)) return null;
  if (el.type === 'image') return handDrawnImagePaint(el, finish);
  return finish === 'marker'
    ? markerElementPaint(el, fill, backdrop)
    : sketchElementPaint(el, finish, fill, backdrop);
}
