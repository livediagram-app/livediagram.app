// A retired element in the export and the thumbnail (docs/specs/002-project-scope/not-in-livehuddle.md "Retired
// elements"): the placeholder card retired-placeholder.ts lays out, drawn at the element's position. The element's
// own colours, border and label styling are not read: the card is the same on every element, so it reads as
// "something livehuddle no longer has" rather than as content.

import type { CanvasSurface } from './colors';
import type { BoxedElement } from './index';
import { RETIRED_PLACEHOLDER_COLOURS, retiredPlaceholderLayout } from './retired-placeholder';
import { text } from './svg-render-face-kit';
import { svgFace } from './svg-render-faces';
import { r2, xmlEscape } from './svg-render-primitives';

export function svgRetiredElement(
  el: BoxedElement & { type: 'shape' },
  surface: CanvasSurface = 'light',
  fontFamily?: string,
): string {
  const colours = RETIRED_PLACEHOLDER_COLOURS[surface];
  const card = retiredPlaceholderLayout(el);
  const w = Math.max(0, el.width - card.inset * 2);
  const h = Math.max(0, el.height - card.inset * 2);
  const outline =
    `<rect x="${r2(el.x + card.inset)}" y="${r2(el.y + card.inset)}" width="${r2(w)}" height="${r2(h)}"` +
    ` rx="${r2(Math.max(0, card.radius - card.inset))}" fill="${xmlEscape(colours.fill)}"` +
    ` stroke="${xmlEscape(colours.stroke)}" stroke-width="${card.strokeWidth}"` +
    ` stroke-dasharray="${card.dash.join(' ')}"/>`;
  const words = card.lines
    .map((line) =>
      text(el.x + el.width / 2, el.y + line.baseline, line.text, {
        size: line.size,
        weight: line.weight,
        color: colours.ink,
        anchor: 'middle',
        ...(line.opacity !== 1 ? { opacity: line.opacity } : {}),
      }),
    )
    .join('');
  return outline + svgFace(words, fontFamily);
}
