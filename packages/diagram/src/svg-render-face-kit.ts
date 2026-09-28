// The shared kit the headless face renderers draw with (docs/specs/020-import-export/export-fidelity.md):
// the card frame every Collaborate panel shares, its text / pill / rule marks,
// and the marks the behaviour cards' modern look needs in an export (people as
// initial discs, the Temperature check's faces, status glyphs, accent glows).
// Split out of svg-render-faces.ts so the collab and behaviour faces can each
// live in their own module.

import { SHAPE_DEFAULT_SIZE } from './shape-factory';
import type { BoxedElement } from './index';
import { r2, xmlEscape } from './svg-render-primitives';

export type Face = BoxedElement & { type: 'shape' };

export const PAD_X = 16;
export const PAD_Y = 14;
export const TITLE_PX = 13;
export const BODY_PX = 11;

// Every text mark below leaves its face to the group the caller wraps these
// in (see `svgFace`), so the element's own typeface reaches all of them
// without being threaded through twenty-odd call sites. A card exported in a
// different face to the one on the board is this branch's bug in smaller
// type.

export const text = (
  x: number,
  y: number,
  body: string,
  o: {
    size?: number;
    weight?: number;
    color: string;
    anchor?: 'start' | 'middle' | 'end';
    opacity?: number;
    uppercase?: boolean;
  },
): string =>
  `<text x="${r2(x)}" y="${r2(y)}" font-size="${o.size ?? BODY_PX}"` +
  ` font-weight="${o.weight ?? 400}" fill="${xmlEscape(o.color)}"` +
  `${o.anchor && o.anchor !== 'start' ? ` text-anchor="${o.anchor}"` : ''}` +
  `${o.opacity !== undefined ? ` opacity="${o.opacity}"` : ''}>` +
  `${xmlEscape(o.uppercase ? body.toUpperCase() : body)}</text>`;

export const pill = (
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
  opacity = 0.12,
): string =>
  `<rect x="${r2(x)}" y="${r2(y)}" width="${r2(w)}" height="${r2(h)}" rx="${r2(h / 2)}" fill="${xmlEscape(color)}" opacity="${opacity}"/>`;

export const rule = (x1: number, y: number, x2: number, color: string, opacity = 0.18): string =>
  `<path d="M ${r2(x1)} ${r2(y)} L ${r2(x2)} ${r2(y)}" stroke="${xmlEscape(color)}" stroke-width="1" opacity="${opacity}"/>`;

/** The card frame every Collaborate panel shares: the title, its status line,
 *  and the design-unit box the body is laid out in. */
export function collabCard(
  el: Face,
  title: string,
  aside: string | undefined,
  color: string,
  body: (w: number, h: number) => string,
): string {
  const design = SHAPE_DEFAULT_SIZE[el.shape] ?? { width: el.width, height: el.height };
  // The Q&A board and the Idea box reflow rather than scale (docs/specs/012-collaboration/qa-board.md,
  // idea-box.md): a bigger board shows more rows at the same size, on the
  // canvas and so in the export too.
  const scale =
    el.shape === 'qa-board' || el.shape === 'idea-box'
      ? 1
      : Math.min(el.width / design.width, el.height / design.height);
  // The inner box in design units, so a card larger than its default still
  // paints edge to edge rather than leaving a band of bare card.
  const w = el.width / scale;
  const h = el.height / scale;
  const head =
    text(PAD_X, PAD_Y + TITLE_PX, title, { size: TITLE_PX, weight: 600, color }) +
    (aside
      ? text(w - PAD_X, PAD_Y + TITLE_PX, aside, {
          size: 10,
          weight: 500,
          color,
          anchor: 'end',
          opacity: 0.55,
          uppercase: true,
        })
      : '');
  return (
    `<g transform="translate(${r2(el.x)} ${r2(el.y)}) scale(${r2(scale)})">` +
    head +
    body(w, h) +
    `</g>`
  );
}

/** The footer's action pills, which say what the card DOES. */
export function footerPills(
  x: number,
  y: number,
  labels: readonly string[],
  color: string,
): string {
  let cx = x;
  return labels
    .map((value) => {
      const w = value.length * 5.6 + 18;
      const out =
        pill(cx, y, w, 18, color, 0.14) +
        text(cx + w / 2, y + 12.5, value, { size: 10, weight: 600, color, anchor: 'middle' });
      cx += w + 8;
      return out;
    })
    .join('');
}
