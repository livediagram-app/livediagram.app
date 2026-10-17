// A sequence diagram element's picture (docs/specs/009-elements/sequence-diagram.md): the shared `layoutSequence` drawn
// by the headless renderer, nested as an <svg> fitted into the element's box. The canvas face shows the same markup, so
// the two agree.

import type { Finish } from './finish';
import type { BoxedElement, Element, ShapeElement } from './index';
import { sequenceDiagramOf } from './sequence-element';
import { layoutSequence } from './sequence-layout';
import { renderElementsToSvg } from './svg-render';
import { r2, xmlEscape } from './svg-render-primitives';
import { themeColourFields } from './themes';

/** What the picture is drawn in (docs/specs/009-elements/sequence-diagram.md "Look"): the element's own resolved
 *  colours, face and finish, so it wears its tab's theme like every other element. Each part left out draws as the
 *  renderer's default for the paper. */
export type SequenceLook = {
  /** The paper it sits on: the element's fill. */
  paper?: string;
  /** The participants' outlines, activation bars and message lines: the element's stroke (the theme's accent). */
  stroke?: string;
  /** Every word on it: the element's text colour (the theme's ink). */
  ink?: string;
  /** The font stack its words are set in: the element's resolved face (its own, the tab's, or its finish's). */
  fontFamily?: string;
  /** The finish its boxes and lines are drawn in. */
  finish?: Finish;
};

const cache = new Map<string, string>();
const CACHE_MAX = 64;
const DEFAULT_PAPER = '#ffffff';

// The look's colours written onto each laid-out part it has a slot for, as a new element on a themed tab takes them:
// only where the layout left the colour unset, so a note keeps its own and a sticky its paper.
function inked(elements: Element[], look: SequenceLook, paper: string): Element[] {
  if (!look.stroke && !look.ink) return elements;
  const value = { fillColor: paper, strokeColor: look.stroke, textColor: look.ink } as const;
  return elements.map((el) => {
    const patch: Record<string, string> = {};
    for (const { element: field } of themeColourFields(el)) {
      const v = value[field];
      if (v && (el as Record<string, unknown>)[field] === undefined) patch[field] = v;
    }
    // A message's words are words like the rest (docs/specs/009-elements/sequence-diagram.md "Colours"): an arrow
    // themes only its line, and a caption with no colour of its own takes the line's, the pale accent.
    if (el.type === 'arrow' && el.label && look.ink && el.textColor === undefined) {
      patch.textColor = look.ink;
    }
    return Object.keys(patch).length ? { ...el, ...patch } : el;
  });
}

/** The diagram's own <svg> (natural size, no background), drawn in `look` on its paper, built once per set of rows
 *  and look. */
export function sequenceDrawing(el: ShapeElement, look: SequenceLook = {}): string {
  const paper = look.paper ?? DEFAULT_PAPER;
  const key = JSON.stringify([
    el.sequenceParticipants,
    el.sequenceMessages,
    el.sequenceNumbered,
    paper,
    look.stroke,
    look.ink,
    look.fontFamily,
    look.finish,
  ]);
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  let n = 0;
  const elements = inked(
    layoutSequence(sequenceDiagramOf(el), { makeId: () => `seq-${n++}` }),
    look,
    paper,
  );
  // Rendered on the paper so its ink reads on it, then the paper rect (the first child) taken out: the element's
  // own box is the paper. The finish draws its lines (Sketch's hand-drawn boxes, Professional's square corners).
  let svg = renderElementsToSvg(
    {
      id: 'seq',
      name: 'seq',
      elements,
      ...(look.finish ? { finish: look.finish } : {}),
    },
    { padding: 12, background: paper },
  ).replace(/^(<svg[^>]*>)<rect [^>]*\/>/, '$1');
  // Every word in the element's face: the renderer writes one `font-family` per run of text, each the default.
  if (look.fontFamily) {
    const face = ` font-family="${xmlEscape(look.fontFamily)}"`;
    svg = svg.replace(/ font-family="[^"]*"/g, face);
  }
  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value!);
  cache.set(key, svg);
  return svg;
}

/** The picture placed in the element's box (for an export), scaled to fit with its aspect kept. */
export function svgSequencePicture(
  el: BoxedElement & { type: 'shape' },
  look: SequenceLook = {},
): string {
  const drawing = sequenceDrawing(el, look);
  const open = drawing.indexOf('>');
  const viewBox = /viewBox="([^"]+)"/.exec(drawing.slice(0, open))?.[1] ?? '0 0 1 1';
  const inner = drawing.slice(open + 1, drawing.lastIndexOf('</svg>'));
  return (
    `<svg x="${r2(el.x)}" y="${r2(el.y)}" width="${r2(el.width)}" height="${r2(el.height)}" viewBox="${viewBox}"` +
    ` preserveAspectRatio="xMidYMid meet">${inner}</svg>`
  );
}
