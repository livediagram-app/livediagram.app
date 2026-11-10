// Slides that prove a point (docs/specs/007-editor/pages-mode.md "Slide layouts", docs/specs/009-elements/quote.md and
// comparison-tables.md "Templates"): a Testimonial (Content), two customers' words in quote cards, and a Pricing Table
// (Data), plans compared in ticks and crosses with the recommended one highlighted. Pure builders on the slide kit, in
// units of the slide's height.
import { createTable, type Element, type TableElement } from '@livedocuments/document';
import type { Kit } from './page-layout-kit';
import { columns, slideHeading, slideType } from './slide-layout-kit';

const QUOTES = [
  [
    'We cut our weekly planning meeting from an hour to fifteen minutes.',
    'Priya Shah',
    'Head of Delivery, Northwind',
  ],
  [
    'The first tool the whole company opened without being asked to.',
    'Marcus Lee',
    'COO, Bluebird',
  ],
] as const;

/** Two testimonials side by side, each a quote card with its speaker's portrait, name and role. */
export function testimonialSlide(k: Kit): Element[] {
  const { width: W, height: H } = k.box;
  const { u } = k;
  const head = slideHeading(k, 'What our customers say');
  const top = head.top + u * 2;
  const h = H - top - u * 4;
  return [
    ...head.els,
    ...columns(W, QUOTES.length, u * 6).map(({ at, size }, i) => {
      const [words, name, role] = QUOTES[i]!;
      return k.shape('quote', at, top, size, h, {
        label: words,
        pageTitle: name,
        pageSubtitle: role,
        cardMedia: 'initial',
        ...slideType(k, 5),
        textBold: true,
      });
    }),
  ];
}

/** A comparison table filling a box: features down the side, plans across, `recommended` highlighted. */
function comparisonTable(
  k: Kit,
  x: number,
  y: number,
  w: number,
  h: number,
  rows: readonly (readonly string[])[],
  recommended: number,
): TableElement {
  const cols = rows[0]?.length ?? 1;
  const first = Math.round(w * (cols > 3 ? 0.34 : 0.4));
  return {
    ...createTable(0, 0),
    x: Math.round(k.box.x + x),
    y: Math.round(k.box.y + y),
    width: Math.round(w),
    height: Math.round(h),
    cells: rows.map((r) => [...r]),
    colWidths: [first, ...Array.from({ length: cols - 1 }, () => null)],
    headerRow: true,
    headerColumn: false,
    zebra: true,
    textSize: 'lg',
    cellStyles: rows.map((r, ri) =>
      r.map((_, c) => (c === 0 && ri > 0 ? { alignX: 'left' } : null)),
    ),
    highlightColumn: recommended,
  };
}

const PRICING = [
  ['', 'Free', 'Pro', 'Enterprise'],
  ['Price per seat', '£0', '£8', 'Talk to us'],
  ['Unlimited decks', '✓', '✓', '✓'],
  ['Brand themes', '✗', '✓', '✓'],
  ['Presenter view', '✓', '✓', '✓'],
  ['Audit log', '✗', '✗', '✓'],
] as const;

/** Plans compared feature by feature, the recommended plan's column highlighted. */
export function pricingTableSlide(k: Kit): Element[] {
  const { width: W, height: H } = k.box;
  const { u } = k;
  const head = slideHeading(
    k,
    'Choose your plan',
    'Every plan includes offline mode and the editor.',
  );
  const top = head.top + u * 2;
  return [...head.els, comparisonTable(k, 0, top, W, H - top - u * 4, PRICING, 2)];
}
