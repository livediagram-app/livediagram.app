import { CoverPage } from './hero-infographic-cover';
import { NumbersPage } from './hero-infographic-numbers';
import { SHEET } from './hero-infographic-parts';
import { TimelinePage } from './hero-infographic-timeline';

// The hero's Infographic window (docs/specs/019-marketing/marketing-site.md "Hero"): the Year in
// Review template laid out in Pages mode (docs/specs/007-editor/pages-mode.md "The pages"),
// three A4 pages in a row, each with its name row above and its pager below, as the editor shows
// them. The cover lands first (the year set huge, the title, a harbour picture, a sticker), then
// the numbers page (four tinted stat tiles, a chart card whose bars grow and whose ring fills,
// selected by a teammate), then the timeline (a rail drawn through five months). On a phone the
// cover and the numbers page stack, as a phone scrolls. Each piece arrives at its own --d delay
// (hero-scenes/pages.css).

// The article window (hero-article-page.tsx) shares this row geometry: its pages sit where this
// window's used to.

// The article's page: A4 portrait at the mock's scale (210 x 297).
export const PAGE = { x: 85, y: -24, w: 210, h: 297 };

// The row: three pages with a gutter, starting just past the window's left edge, by less than the
// cover's margin, so the overview's thumbnail (a 600 by 400 crop) still shows the cover's
// content; on a phone two pages stack.
const GUTTER = 22;
const PAGES = 3;
const ROW_X = -10;
const ROW_Y = -34;
const PORTRAIT_X = 86;
const PORTRAIT_Y = -22;
const PORTRAIT_GAP = 44;

export function InfographicPages({ portrait = false }: { portrait?: boolean }) {
  if (portrait) {
    return (
      <>
        <CoverPage x={PORTRAIT_X} y={PORTRAIT_Y} of={PAGES} />
        <NumbersPage x={PORTRAIT_X} y={PORTRAIT_Y + SHEET.h + PORTRAIT_GAP} of={PAGES} />
      </>
    );
  }
  const step = SHEET.w + GUTTER;
  return (
    <>
      <CoverPage x={ROW_X} y={ROW_Y} of={PAGES} />
      <NumbersPage x={ROW_X + step} y={ROW_Y} of={PAGES} />
      <TimelinePage x={ROW_X + step * 2} y={ROW_Y} of={PAGES} />
    </>
  );
}
