// The shared kit the headless face renderers draw with (docs/specs/020-import-export/export-fidelity.md):
// the text mark, and the one-line fit and line clamp the faces' words take. Split out of svg-render-faces.ts so the
// faces and the drawings made outside this package (re-exported from ./index) write text the same way.

import type { BoxedElement } from './index';
import { r2, xmlEscape } from './svg-render-primitives';

export type Face = BoxedElement & { type: 'shape' };

const BODY_PX = 11;

// Every text mark below leaves its face to the group the caller wraps these
// in (see `svgFace`), so the element's own typeface reaches all of them
// without being threaded through twenty-odd call sites. A card exported in a
// different face to the one on the canvas is this branch's bug in smaller
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
    // Struck through: a done step, a finished action.
    strike?: boolean;
    // Letter spacing in em, as the canvas's tracking-[...] classes set it.
    tracking?: number;
  },
): string =>
  `<text x="${r2(x)}" y="${r2(y)}" font-size="${o.size ?? BODY_PX}"` +
  ` font-weight="${o.weight ?? 400}" fill="${xmlEscape(o.color)}"` +
  `${o.anchor && o.anchor !== 'start' ? ` text-anchor="${o.anchor}"` : ''}` +
  `${o.opacity !== undefined ? ` opacity="${o.opacity}"` : ''}` +
  `${o.strike ? ' text-decoration="line-through"' : ''}` +
  `${o.tracking ? ` letter-spacing="${o.tracking}em"` : ''}>` +
  `${xmlEscape(o.uppercase ? body.toUpperCase() : body)}</text>`;

// The advance estimate the wrapping below works to: a character is about
// half an em wide in the faces the canvas ships.
const CHAR_EM = 0.52;

/** `body` on one line that fits `width` at `size`px, cut with an ellipsis when
 *  it runs on: the export's version of the canvas's `truncate`. `em` is the
 *  per-character advance, wider for uppercase or bold text. */
export function fitLine(body: string, width: number, size: number, em = CHAR_EM): string {
  const fits = Math.max(1, Math.floor(width / (size * em)));
  const flat = body.replace(/\s+/g, ' ').trim();
  return flat.length <= fits ? flat : `${flat.slice(0, Math.max(0, fits - 1)).trimEnd()}…`;
}

/** Break `body` into at most `max` lines that fit `width` at `size`px (an
 *  estimate of the face's advance), the last one ending in an ellipsis when
 *  the text runs on: the export's version of the canvas's line clamp. */
export function wrapLines(body: string, width: number, size: number, max: number): string[] {
  const perLine = Math.max(8, Math.floor(width / (size * CHAR_EM)));
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
  // Against the words joined as the lines join them: against the raw body, a double space or a line break counted as
  // text that ran on, and a card that fitted ended in a false ellipsis.
  const used = lines.join(' ').length;
  if (lines.length === max && used < words.join(' ').length) {
    lines[max - 1] = `${lines[max - 1]!.slice(0, perLine - 1).trimEnd()}…`;
  }
  // A single word longer than a line (a URL, a long name) is cut too, rather
  // than running out of the card.
  return lines.map((l) => (l.length > perLine ? `${l.slice(0, perLine - 1).trimEnd()}…` : l));
}

// mixHex lives in color-wash.ts, a leaf, so leaf modules can ramp colours at load; re-exported here for its callers.
export { mixHex } from '@liveworkspace/model-core/color-wash';
