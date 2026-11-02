// What Inspect reads off the canvas (docs/specs/007-editor/wireframe-pages.md "Inspect"): the element, the page and
// screen it is on (the origin its position is measured from), its neighbours on that page, and the measured lines
// the canvas draws. Shared by the overlay and the panel, so the two never disagree. Each call is one pass over the
// tab's elements; the callers run it when the selection, the hover or the elements change, never per pointer
// sample.
import {
  inspectElement,
  inspectNumber,
  isBoxed,
  neighbourSpacing,
  pageScreenRect,
  pageSurface,
  pairSpacing,
  rowPageAt,
  type BoxedElement,
  type Element,
  type InspectRect,
  type InspectSpec,
  type LaidOutPage,
  type SpacingLine,
  type Finish,
} from '@livedesign/design';

export type InspectTarget = {
  el: BoxedElement;
  rect: InspectRect;
  page: LaidOutPage | null;
  // The screen of the page it is on (a wireframe page's), or the sheet; null off every page.
  screen: InspectRect | null;
};

const rectOf = (el: BoxedElement): InspectRect => ({
  x: el.x,
  y: el.y,
  width: el.width,
  height: el.height,
});

const centre = (el: BoxedElement) => ({ x: el.x + el.width / 2, y: el.y + el.height / 2 });

/** The boxed element with this id, and where it is. Null for an arrow, an unknown id or none. */
export function inspectTarget(
  id: string | null,
  elements: readonly Element[],
  pages: readonly LaidOutPage[],
): InspectTarget | null {
  if (!id) return null;
  const el = elements.find((e) => e.id === id);
  if (!el || !isBoxed(el)) return null;
  const page = rowPageAt(pages, centre(el)) ?? null;
  return { el, rect: rectOf(el), page, screen: page ? pageScreenRect(page) : null };
}

/** The other boxed elements on the target's page (or, off every page, off every page), in tab order. */
export function inspectNeighbours(
  target: InspectTarget,
  elements: readonly Element[],
  pages: readonly LaidOutPage[],
): BoxedElement[] {
  const out: BoxedElement[] = [];
  for (const el of elements) {
    if (el.id === target.el.id || !isBoxed(el)) continue;
    if ((rowPageAt(pages, centre(el)) ?? null) === target.page) out.push(el);
  }
  return out;
}

/** A spacing line, and what it is measured to (an element, or the screen's edge). */
export type InspectLine = SpacingLine & { toElement: BoxedElement | null };

const SPACING_ORDER = ['top', 'right', 'bottom', 'left'] as const;
const SPACING_NAME = { top: 'Top', right: 'Right', bottom: 'Bottom', left: 'Left' } as const;

/** The spacing as Copy Values writes it, a `Spacing <Side>: <distance>` line per side measured, in the panel's
 *  order (docs/specs/007-editor/wireframe-pages.md "The Inspect panel": every value it shows). */
export function inspectSpacingText(lines: readonly InspectLine[]): string {
  return SPACING_ORDER.flatMap((side) => {
    const line = lines.find((l) => l.side === side);
    return line ? [`Spacing ${SPACING_NAME[side]}: ${inspectNumber(line.distance)}`] : [];
  }).join('\n');
}

/** The selected element's spacing to its neighbours: what the canvas draws and the panel lists. */
export function inspectNeighbourLines(
  target: InspectTarget,
  elements: readonly Element[],
  pages: readonly LaidOutPage[],
): InspectLine[] {
  const neighbours = inspectNeighbours(target, elements, pages);
  return neighbourSpacing(target.rect, neighbours.map(rectOf), target.screen).map((line) => ({
    ...line,
    toElement: line.target === 'screen' ? null : neighbours[line.target]!,
  }));
}

/** What the canvas measures: between the selected and the hovered when both are set and differ, else the spacing
 *  round whichever is set (the selected first). */
export function inspectCanvasLines(
  selected: InspectTarget | null,
  hovered: InspectTarget | null,
  elements: readonly Element[],
  pages: readonly LaidOutPage[],
): InspectLine[] {
  if (selected && hovered && selected.el.id !== hovered.el.id) {
    return pairSpacing(selected.rect, hovered.rect).map((l) => ({ ...l, toElement: hovered.el }));
  }
  const one = selected ?? hovered;
  return one ? inspectNeighbourLines(one, elements, pages) : [];
}

/** The target measured from its screen's top-left, drawn as its page draws it. */
export function inspectTargetSpec(
  target: InspectTarget,
  tab: { font?: string; finish?: Finish },
): InspectSpec {
  return inspectElement(target.el, {
    origin: target.screen ? { x: target.screen.x, y: target.screen.y } : { x: 0, y: 0 },
    tabFont: tab.font,
    tabFinish: tab.finish,
    surface: (target.page && pageSurface(target.page)) ?? 'light',
  });
}
