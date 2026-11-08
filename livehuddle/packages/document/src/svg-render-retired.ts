// A retired element in the export and the thumbnail (docs/specs/002-project-scope/not-in-livehuddle.md "Retired
// elements"): the placeholder card retired-placeholder.ts lays out, drawn at the element's position. The element's
// own colours, border and label styling are not read: the card is the same on every element, so it reads as
// "something livehuddle no longer has" rather than as content.

import type { CanvasSurface } from './colors';
import type { BoxedElement, Element } from './index';
import { RETIRED_PLACEHOLDER_COLOURS, retiredPlaceholderLayout } from './retired-placeholder';
import {
  RETIRED_ARROW_DASH,
  RETIRED_ARROW_OPACITY,
  RETIRED_ARROW_STROKE_WIDTH,
  retiredArrowCardOn,
  retiredArrowEnds,
  type RetiredArrowElement,
} from './retired-arrow';
import { text } from './svg-render-face-kit';
import { svgFace } from './svg-render-faces';
import { r2, xmlEscape } from './svg-render-primitives';

export function svgRetiredElement(
  el: Pick<BoxedElement, 'x' | 'y' | 'width' | 'height' | 'type' | 'label'> & {
    shape?: unknown;
    arrowEnds?: unknown;
  },
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

// A stored arrow (./retired-arrow, part 4 of the element engine): a faint dashed straight line between its resolved
// ends, and the placeholder card on its middle, as the canvas draws it.
export function svgRetiredArrow(
  arrow: RetiredArrowElement,
  elements: readonly Element[] | ReadonlyMap<string, Element>,
  surface: CanvasSurface = 'light',
  fontFamily?: string,
): string {
  const colours = RETIRED_PLACEHOLDER_COLOURS[surface];
  const ends = retiredArrowEnds(arrow, elements);
  const { from, to } = ends;
  const card = retiredArrowCardOn(ends);
  const line =
    `<line data-retired-arrow-line="" x1="${r2(from.x)}" y1="${r2(from.y)}" x2="${r2(to.x)}" y2="${r2(to.y)}"` +
    ` stroke="${xmlEscape(colours.stroke)}" stroke-width="${RETIRED_ARROW_STROKE_WIDTH}" stroke-dasharray="${RETIRED_ARROW_DASH}"` +
    ` stroke-opacity="${RETIRED_ARROW_OPACITY}" fill="none"/>`;
  const face = svgRetiredElement(
    {
      ...card,
      type: 'arrow',
      label: arrow.label,
      arrowEnds: arrow.arrowEnds,
    } as unknown as Parameters<typeof svgRetiredElement>[0],
    surface,
    fontFamily,
  );
  return `<g data-retired-arrow="">${line}${face}</g>`;
}
