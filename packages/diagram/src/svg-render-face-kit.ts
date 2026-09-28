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
  // The Q&A board, the Idea box and the Comment and Action panels reflow
  // rather than scale (docs/specs/012-collaboration/qa-board.md, idea-box.md, comment-pin.md, action-panel.md): a bigger board shows more rows at the same size, on the
  // canvas and so in the export too.
  const scale =
    el.shape === 'qa-board' ||
    el.shape === 'idea-box' ||
    el.shape === 'comment-pin' ||
    el.shape === 'action-card'
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

// ── Marks for the behaviour cards' modern look (docs/specs/020-import-export/export-fidelity.md) ──────────

/** A person as a disc: their initials on their colour, or, with no name to
 *  go on (a Done check's or an Estimate's opaque key), a neutral disc with a
 *  head-and-shoulders mark. `ring` separates overlapping discs in a stack. */
export function personDisc(
  cx: number,
  cy: number,
  r: number,
  color: string,
  person?: { initials: string; fill: string },
  ring?: string,
): string {
  const edge = ring
    ? ` stroke="${xmlEscape(ring)}" stroke-width="${r2(Math.max(1.5, r * 0.2))}"`
    : '';
  if (person) {
    return (
      `<circle cx="${r2(cx)}" cy="${r2(cy)}" r="${r2(r)}" fill="${xmlEscape(person.fill)}"${edge}/>` +
      text(cx, cy + r * 0.36, person.initials, {
        size: r * 0.9,
        weight: 600,
        color: '#ffffff',
        anchor: 'middle',
      })
    );
  }
  return (
    `<circle cx="${r2(cx)}" cy="${r2(cy)}" r="${r2(r)}" fill="${xmlEscape(color)}" fill-opacity="0.14"${edge}/>` +
    `<circle cx="${r2(cx)}" cy="${r2(cy - r * 0.22)}" r="${r2(r * 0.3)}" fill="${xmlEscape(color)}" fill-opacity="0.45"/>` +
    `<path d="M ${r2(cx - r * 0.52)} ${r2(cy + r * 0.62)} a ${r2(r * 0.52)} ${r2(r * 0.46)} 0 0 1 ${r2(r * 1.04)} 0 z" fill="${xmlEscape(color)}" fill-opacity="0.45"/>`
  );
}

/** A check mark centred at (cx, cy), `size` across. */
export function checkMark(cx: number, cy: number, size: number, color: string, width = 2): string {
  const u = size / 16;
  const p = (x: number, y: number) => `${r2(cx + (x - 8) * u)} ${r2(cy + (y - 8) * u)}`;
  return `<path d="M ${p(3.5, 8.5)} L ${p(6.5, 11.5)} L ${p(12.5, 4.5)}" fill="none" stroke="${xmlEscape(color)}" stroke-width="${r2(width)}" stroke-linecap="round" stroke-linejoin="round"/>`;
}

/** A padlock centred at (cx, cy), `size` across. */
export function lockMark(cx: number, cy: number, size: number, color: string): string {
  const u = size / 16;
  const x = (v: number) => r2(cx + (v - 8) * u);
  const y = (v: number) => r2(cy + (v - 8) * u);
  return (
    `<rect x="${x(3.5)}" y="${y(7)}" width="${r2(9 * u)}" height="${r2(6.5 * u)}" rx="${r2(1.5 * u)}" fill="none" stroke="${xmlEscape(color)}" stroke-width="${r2(1.5 * u)}"/>` +
    `<path d="M ${x(5.5)} ${y(7)} V ${y(5)} a ${r2(2.5 * u)} ${r2(2.5 * u)} 0 0 1 ${r2(5 * u)} 0 V ${y(7)}" fill="none" stroke="${xmlEscape(color)}" stroke-width="${r2(1.5 * u)}"/>`
  );
}

/** One of the Temperature check's faces (TEMPERATURE_FACE_MOUTHS), centred at
 *  (cx, cy), `size` across, value 1..5. */
export function moodFace(
  cx: number,
  cy: number,
  size: number,
  value: number,
  color: string,
  mouths: readonly string[],
): string {
  const u = size / 16;
  const mouth = mouths[Math.min(4, Math.max(0, value - 1))]!;
  return (
    `<g transform="translate(${r2(cx - 8 * u)} ${r2(cy - 8 * u)}) scale(${r2(u)})" fill="none" stroke="${xmlEscape(color)}" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">` +
    `<circle cx="8" cy="8" r="6.4"/>` +
    `<circle cx="5.9" cy="6.6" r=".75" fill="${xmlEscape(color)}" stroke="none"/>` +
    `<circle cx="10.1" cy="6.6" r=".75" fill="${xmlEscape(color)}" stroke="none"/>` +
    `<path d="${mouth}"${value === 5 ? ` fill="${xmlEscape(color)}" fill-opacity="0.25"` : ''}/>` +
    `</g>`
  );
}

/** A soft radial glow of `color` from a corner of the box (0..1 fractions),
 *  as the Reveal zone and the Idea box paint behind their content. The id
 *  must be unique in the document, so pass the element's. */
export function glow(
  id: string,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
  at: { cx: number; cy: number },
  opacity: number,
  rx = 0,
): string {
  const gid = `glow-${xmlEscape(id)}`;
  return (
    `<defs><radialGradient id="${gid}" cx="${at.cx}" cy="${at.cy}" r="1">` +
    `<stop offset="0" stop-color="${xmlEscape(color)}" stop-opacity="${opacity}"/>` +
    `<stop offset="0.6" stop-color="${xmlEscape(color)}" stop-opacity="0"/>` +
    `</radialGradient></defs>` +
    `<rect x="${r2(x)}" y="${r2(y)}" width="${r2(w)}" height="${r2(h)}" rx="${r2(rx)}" fill="url(#${gid})"/>`
  );
}

/** Break `body` into at most `max` lines that fit `width` at `size`px (an
 *  estimate of the face's advance), the last one ending in an ellipsis when
 *  the text runs on: the export's version of the canvas's line clamp. */
export function wrapLines(body: string, width: number, size: number, max: number): string[] {
  const perLine = Math.max(8, Math.floor(width / (size * 0.52)));
  const words = body.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length <= perLine) {
      line = next;
      continue;
    }
    if (line) lines.push(line);
    line = word;
    if (lines.length === max) break;
  }
  if (line && lines.length < max) lines.push(line);
  const used = lines.join(' ').length;
  if (lines.length === max && used < body.trim().length) {
    lines[max - 1] = `${lines[max - 1]!.slice(0, perLine - 1).trimEnd()}…`;
  }
  return lines;
}
