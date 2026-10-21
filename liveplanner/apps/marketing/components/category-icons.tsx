import { Glyph, type IconProps } from '@liveplanner/ui';
import type { ReactElement } from 'react';

// One glyph per feature category (docs/specs/019-marketing/marketing-site.md), shown beside each
// landing beat's name. Drawn on the shared chrome Glyph (16-unit viewBox, stroke
// in currentColor) so they sit with the rest of the site's icons. Each draws
// what the category is ABOUT; category-icons.test.ts pins one per
// LANDING_SECTIONS id, none shared.

type Icon = (props: IconProps) => ReactElement;

const glyph =
  (paths: ReactElement): Icon =>
  ({ size = 14, ...rest }) => (
    <Glyph size={size} {...rest}>
      {paths}
    </Glyph>
  );

export const CATEGORY_ICONS: Record<string, Icon> = {
  // Collaboration: two people.
  collaboration: glyph(
    <>
      <circle cx="6" cy="5.5" r="2.25" />
      <path d="M2 13.5c.4-2.4 2-3.75 4-3.75s3.6 1.35 4 3.75" />
      <path d="M10.5 3.5a2.25 2.25 0 0 1 0 4.25M11.75 9.9c1.2.5 2 1.7 2.25 3.6" />
    </>,
  ),
  // Boards and dashboards: three columns of cards.
  plan: glyph(
    <>
      <rect x="1.5" y="2" width="3.5" height="5" rx=".75" />
      <rect x="1.5" y="9" width="3.5" height="3.5" rx=".75" />
      <rect x="6.25" y="2" width="3.5" height="7.5" rx=".75" />
      <rect x="11" y="2" width="3.5" height="3.5" rx=".75" />
    </>,
  ),
  // Sheets: a grid of cells, its header row filled.
  sheets: glyph(
    <>
      <rect x="1.5" y="2.5" width="13" height="11" rx="1" />
      <path d="M1.5 6h13M1.5 9.75h13M6 2.5v11M10.25 2.5v11" />
    </>,
  ),
  // Forms: a clipboard with a ticked line and a box.
  forms: glyph(
    <>
      <rect x="3" y="2.5" width="10" height="12" rx="1" />
      <path d="M6 2.5v-1h4v1M5.25 6.5l1 1 1.75-2M9.5 6.75h2M5.25 10.5h6.5v2h-6.5z" />
    </>,
  ),
};
