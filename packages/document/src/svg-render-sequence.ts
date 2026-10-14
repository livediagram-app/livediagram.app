// A sequence diagram element's picture (docs/specs/009-elements/sequence-diagram.md): the shared `layoutSequence` drawn
// by the headless renderer, nested as an <svg> fitted into the element's box. The canvas face shows the same markup, so
// the two agree.

import type { BoxedElement, ShapeElement } from './index';
import { sequenceDiagramOf } from './sequence-element';
import { layoutSequence } from './sequence-layout';
import { renderElementsToSvg } from './svg-render';
import { r2 } from './svg-render-primitives';

const cache = new Map<string, string>();
const CACHE_MAX = 64;

/** The diagram's own <svg> (natural size, no background), inked for the `paper` it sits on (the element's fill),
 *  built once per set of rows and paper. */
export function sequenceDrawing(el: ShapeElement, paper = '#ffffff'): string {
  const key = JSON.stringify([
    el.sequenceParticipants,
    el.sequenceMessages,
    el.sequenceNumbered,
    paper,
  ]);
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  let n = 0;
  const elements = layoutSequence(sequenceDiagramOf(el), { makeId: () => `seq-${n++}` });
  // Rendered on the paper so its ink reads on it, then the paper rect (the first child) taken out: the element's
  // own box is the paper.
  const svg = renderElementsToSvg({ id: 'seq', name: 'seq', elements } as never, {
    padding: 12,
    background: paper,
  }).replace(/^(<svg[^>]*>)<rect [^>]*\/>/, '$1');
  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value!);
  cache.set(key, svg);
  return svg;
}

/** The picture placed in the element's box (for an export), scaled to fit with its aspect kept. */
export function svgSequencePicture(el: BoxedElement & { type: 'shape' }, paper?: string): string {
  const drawing = sequenceDrawing(el as ShapeElement, paper);
  const open = drawing.indexOf('>');
  const viewBox = /viewBox="([^"]+)"/.exec(drawing.slice(0, open))?.[1] ?? '0 0 1 1';
  const inner = drawing.slice(open + 1, drawing.lastIndexOf('</svg>'));
  return (
    `<svg x="${r2(el.x)}" y="${r2(el.y)}" width="${r2(el.width)}" height="${r2(el.height)}" viewBox="${viewBox}"` +
    ` preserveAspectRatio="xMidYMid meet">${inner}</svg>`
  );
}
