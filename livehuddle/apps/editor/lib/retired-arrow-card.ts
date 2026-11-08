// A stored arrow's placeholder (docs/specs/002-project-scope/not-in-livehuddle.md "The element engine", part 4;
// docs/specs/002-project-scope/blueprints/element-engine.md D21): a faint dashed straight line between its resolved
// ends, with the placeholder card centred on the line's middle. The card is drawn as a boxed element (a retired one,
// so every renderer draws its placeholder face): the canvas through the boxed element view, the image exports and
// the Map through svgBoxed. Nothing here writes to the arrow.

import {
  RETIRED_ARROW_CARD_HEIGHT,
  RETIRED_ARROW_CARD_WIDTH,
  RETIRED_ARROW_DASH,
  RETIRED_ARROW_OPACITY,
  RETIRED_ARROW_STROKE_WIDTH,
  RETIRED_PLACEHOLDER_COLOURS,
  retiredArrowEnds,
  r2,
  svgBoxed,
  xmlEscape,
  type BoxedElement,
  type CanvasSurface,
  type Element,
  type Point,
  type RetiredArrowElement,
  type Tab,
} from '@livehuddle/document';

/** The card as a boxed element: the arrow's own fields (its label, comments, link, note and action for the
 *  indicators, its heads for its name) at the card's box, centred on the line's middle. */
export function retiredArrowCardElement(
  arrow: RetiredArrowElement,
  ends: { from: Point; to: Point },
): BoxedElement {
  return {
    ...arrow,
    x: (ends.from.x + ends.to.x) / 2 - RETIRED_ARROW_CARD_WIDTH / 2,
    y: (ends.from.y + ends.to.y) / 2 - RETIRED_ARROW_CARD_HEIGHT / 2,
    width: RETIRED_ARROW_CARD_WIDTH,
    height: RETIRED_ARROW_CARD_HEIGHT,
  } as unknown as BoxedElement;
}

/** The placeholder as SVG markup: the dashed line, then the card. Ends resolve against `elements`. */
export function svgRetiredArrowMarkup(
  arrow: RetiredArrowElement,
  elements: readonly Element[] | ReadonlyMap<string, unknown>,
  opts: { surface: CanvasSurface; tabFont?: Tab['font']; tabFinish?: Tab['finish'] },
): string {
  const ends = retiredArrowEnds(arrow, elements);
  const { from, to } = ends;
  const line =
    `<line data-retired-arrow-line="" x1="${r2(from.x)}" y1="${r2(from.y)}" x2="${r2(to.x)}" y2="${r2(to.y)}"` +
    ` stroke="${RETIRED_PLACEHOLDER_COLOURS[opts.surface].stroke}" stroke-width="${RETIRED_ARROW_STROKE_WIDTH}"` +
    ` stroke-dasharray="${RETIRED_ARROW_DASH}" stroke-opacity="${RETIRED_ARROW_OPACITY}" fill="none"/>`;
  const card = svgBoxed(retiredArrowCardElement(arrow, ends), {
    surface: opts.surface,
    tabFont: opts.tabFont,
    tabFinish: opts.tabFinish,
  });
  return `<g data-retired-arrow="${xmlEscape(arrow.id)}">${line}${card}</g>`;
}
